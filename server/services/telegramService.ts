import { getPool } from '../db';

/**
 * Utility to get current date and time strictly in UTC+7 (Asia/Bangkok, Phnom Penh, Indochina Time)
 * regardless of host machine, Docker container, or cloud server OS timezone (e.g. UTC on production).
 */
export function getNowInUtcPlus7(baseDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  });

  const parts = formatter.formatToParts(baseDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);
  const dayName = partMap.weekday; // e.g. "Monday", "Tuesday", etc.

  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const dayOfWeek = dayMap[dayName] ?? 0;

  const hoursStr = String(hour).padStart(2, '0');
  const minutesStr = String(minute).padStart(2, '0');
  const secondsStr = String(second).padStart(2, '0');
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');

  const timeStr = `${hoursStr}:${minutesStr}`;
  const dateStr = `${year}-${monthStr}-${dayStr}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    dayName,
    timeStr,
    dateStr,
    formattedIsoLike: `${dateStr}T${hoursStr}:${minutesStr}:${secondsStr}+07:00`,
  };
}

export function escapeTelegramHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function splitTelegramMessage(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = maxLength;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks;
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<{ ok: boolean; message?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, message: 'Telegram Bot Token and Chat ID are required.' };
  }
  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  const chunks = splitTelegramMessage(text, 3900);

  try {
    for (const chunk of chunks) {
      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
      });
      let data: any = await res.json();

      // Fallback: If Telegram rejects HTML formatting entities, retry in plain text
      if (!data.ok && typeof data.description === 'string' && data.description.toLowerCase().includes('entities')) {
        console.warn(`[Telegram API] HTML parse failed (${data.description}). Retrying message as plain text...`);
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cleanChatId,
            text: stripHtmlTags(chunk),
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(10000),
        });
        data = await res.json();
      }

      if (!data.ok) {
        console.warn(`[Telegram API Error] chat_id=${cleanChatId} code=${data.error_code} description="${data.description}"`);
        return { ok: false, message: data.description || 'Telegram API rejected message' };
      }
      if (chunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    return { ok: true };
  } catch (err: any) {
    console.error(`[Telegram Network Error]:`, err.message);
    return { ok: false, message: err.message || 'Network error reaching Telegram API' };
  }
}

export function stripHtmlTags(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPlatformEmoji(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case 'youtube': return '🔴';
    case 'figma': return '🎨';
    case 'google-drive':
    case 'google-docs':
    case 'google-sheets':
    case 'google-slides': return '📁';
    case 'github':
    case 'gitlab': return '🐙';
    case 'notion': return '📝';
    case 'loom': return '📹';
    case 'slack': return '💬';
    case 'trello': return '📋';
    case 'canva':
    case 'miro': return '📐';
    case 'linear':
    case 'jira': return '⚡';
    default: return '🔗';
  }
}

/**
 * Dispatches a real-time notification to the configured Telegram bot whenever a task moves to "Ready Review" or "Completed".
 */
export async function notifyTelegramTaskStatusUpdate(
  pool: any,
  task: any,
  status: 'Ready Review' | 'Completed' | string,
  actorName?: string
): Promise<void> {
  if (!task) return;
  const normStatus = (status || '').trim();
  const isReadyReview = normStatus.toLowerCase() === 'ready review' || normStatus.toLowerCase() === 'ready for review';
  const isCompleted = normStatus.toLowerCase() === 'completed';

  if (!isReadyReview && !isCompleted) return;

  try {
    // Resilient lookup: works whether or not columns exist yet and regardless of ID
    const settingsRes = await pool.query(
      `SELECT * FROM telegram_settings ORDER BY (CASE WHEN id = 'default' THEN 0 ELSE 1 END), created_at DESC LIMIT 1`
    );
    const row = settingsRes.rows[0] || {};
    const botToken = (row.bot_token || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim();
    const chatId = (row.chat_id || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!botToken || !chatId) {
      console.warn(`[Telegram Alert] Skipped "${normStatus}" alert for task "${task.title}": Telegram Bot Token or Chat ID is not configured (checked DB and .env).`);
      return;
    }

    if (isReadyReview && (row.notify_ready_review === false || row.notify_ready_review === 'false')) {
      console.log(`[Telegram Alert] Skipped "Ready Review" alert: notify_ready_review is disabled in settings.`);
      return;
    }
    if (isCompleted && (row.notify_completed === false || row.notify_completed === 'false')) {
      console.log(`[Telegram Alert] Skipped "Completed" alert: notify_completed is disabled in settings.`);
      return;
    }

    // Resolve project name if missing
    let projectName = task.projectName || '';
    if (!projectName && task.projectId) {
      const pRes = await pool.query('SELECT name FROM projects WHERE id = $1', [task.projectId]);
      if (pRes.rowCount > 0) projectName = pRes.rows[0].name;
    }
    if (!projectName) projectName = 'General Project';

    // Resolve assignee name if missing
    let assigneeName = task.assigneeName || '';
    if (!assigneeName && task.assigneeId) {
      const mRes = await pool.query(
        `SELECT COALESCE(tm.name, u.name) AS name 
         FROM team_members tm 
         FULL OUTER JOIN users u ON u.member_id = tm.id 
         WHERE tm.id = $1 OR u.member_id = $1 
         LIMIT 1`,
        [task.assigneeId]
      );
      if (mRes.rowCount > 0 && mRes.rows[0].name) {
        assigneeName = mRes.rows[0].name;
      }
    }
    if (!assigneeName) assigneeName = 'Unassigned';

    const priorityEmojis: Record<string, string> = {
      Urgent: '🔴',
      High: '🟠',
      Medium: '🟡',
      Low: '🟢',
    };
    const pEmoji = priorityEmojis[task.priority] || '🟡';
    const dueDateFormatted = task.dueDate || 'No due date';

    let descPreview = '';
    const cleanDesc = stripHtmlTags(task.description || '');
    if (cleanDesc) {
      const maxLen = 220;
      const truncated = cleanDesc.length > maxLen ? cleanDesc.slice(0, maxLen) + '...' : cleanDesc;
      descPreview = `\n📝 <b>Scope / Notes:</b>\n<i>${escapeTelegramHtml(truncated)}</i>\n`;
    }

    let linksPreview = '';
    const rawLinks = Array.isArray(task.links) ? task.links : [];
    const validLinks = rawLinks.filter((l: any) => l && typeof l.url === 'string' && l.url.trim().length > 0);
    if (validLinks.length > 0) {
      const lines = validLinks.map((l: any) => {
        const icon = getPlatformEmoji(l.platform);
        const title = escapeTelegramHtml(l.title || l.platform || 'Attached Link');
        const url = escapeTelegramHtml(l.url.trim());
        return `  ${icon} <a href="${url}">${title}</a>`;
      });
      linksPreview = `\n🔗 <b>Attached Deliverables:</b>\n${lines.join('\n')}\n`;
    }

    const header = isCompleted
      ? `🎉 <b>TASK COMPLETED</b>`
      : `📋 <b>TASK READY FOR REVIEW</b>`;

    const actorLine = isCompleted
      ? `🏁 <b>Completed by:</b> ${escapeTelegramHtml(actorName || 'Team Member')}`
      : `✍️ <b>Moved by:</b> ${escapeTelegramHtml(actorName || 'Team Member')}`;

    const message = [
      header,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📌 <b>Deliverable:</b> <b>${escapeTelegramHtml(task.title || 'Untitled Task')}</b>`,
      `📁 <b>Project:</b> ${escapeTelegramHtml(projectName)}`,
      `👤 <b>Assignee:</b> ${escapeTelegramHtml(assigneeName)}`,
      `⚡ <b>Priority:</b> ${pEmoji} ${escapeTelegramHtml(task.priority || 'Medium')}`,
      `📅 <b>Due Date:</b> ${escapeTelegramHtml(dueDateFormatted)}`,
      actorLine,
      descPreview,
      linksPreview,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `<i>🚀 UX/UI Management Dashboard • Instant Alert</i>`,
    ].filter(Boolean).join('\n');

    console.log(`[Telegram Alert] Sending "${isCompleted ? 'Completed' : 'Ready Review'}" alert for task "${task.title}" to chat ${chatId}...`);
    const sendRes = await sendTelegramMessage(botToken, chatId, message);
    if (sendRes.ok) {
      console.log(`[Telegram Alert] Successfully delivered "${isCompleted ? 'Completed' : 'Ready Review'}" alert for task "${task.title}" to chat ${chatId}`);
    } else {
      console.warn(`[Telegram Alert] Could not deliver alert to chat ${chatId}: ${sendRes.message}`);
    }
  } catch (err: any) {
    console.error('[Telegram Alert Exception]:', err.message);
  }
}

// Backward-compatibility alias
export function notifyTelegramTaskReadyReview(pool: any, task: any, actorName?: string) {
  return notifyTelegramTaskStatusUpdate(pool, task, 'Ready Review', actorName);
}

export async function generateTelegramWeeklyReport(pool: any): Promise<string> {
  const [projectsRes, tasksRes, membersRes] = await Promise.all([
    pool.query('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM team_members ORDER BY name ASC'),
  ]);

  const projects = projectsRes.rows;
  const tasks = tasksRes.rows;
  const members = membersRes.rows;

  const utc7 = getNowInUtcPlus7();
  const dayIndexMap: Record<string, number> = {
    Sunday: 7, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
  };
  const isoDay = dayIndexMap[utc7.dayName] || 1;
  const monday = new Date(Date.UTC(utc7.year, utc7.month - 1, utc7.day));
  monday.setUTCDate(monday.getUTCDate() - (isoDay - 1) - 7);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const periodLabel = `${fmt(monday)} – ${fmt(friday)}`;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === 'Completed').length;
  const blockedTasks = tasks.filter((t: any) => t.status === 'Blocked').length;
  const overallRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  let text = `📊 <b>WEEKLY PROJECT STATUS REPORT</b>\n`;
  text += `📅 <b>Working Week:</b> ${periodLabel} (Mon – Fri)\n`;
  text += `⏰ <b>Generated:</b> ${utc7.dateStr} ${utc7.timeStr} (UTC+7)\n`;
  text += `📈 <b>Overall Completion:</b> ${overallRate}% (${completedTasks}/${totalTasks} Tasks)\n`;
  if (blockedTasks > 0) {
    text += `⚠️ <b>Blocked Items:</b> ${blockedTasks} (Attention Needed)\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  projects.forEach((p: any, idx: number) => {
    const pTasks = tasks.filter((t: any) => t.project_id === p.id);
    const pDraft = pTasks.filter((t: any) => t.status === 'Draft');
    const pCompleted = pTasks.filter((t: any) => t.status === 'Completed');
    const pInProgress = pTasks.filter((t: any) => t.status === 'In Progress');
    const pReadyReview = pTasks.filter((t: any) => t.status === 'Ready Review' || t.status === 'Pending');
    const pBlocked = pTasks.filter((t: any) => t.status === 'Blocked');
    const pOther = pTasks.filter((t: any) => !['Draft', 'Completed', 'In Progress', 'Ready Review', 'Pending', 'Blocked'].includes(t.status));
    const pPercent = pTasks.length > 0 ? Math.round((pCompleted.length / pTasks.length) * 100) : 0;

    const statusEmoji = p.status === 'Completed' ? '✅' : p.status === 'Blocked' ? '🛑' : p.status === 'Draft' ? '📝' : '🚀';

    text += `${idx + 1}. ${statusEmoji} <b>${escapeTelegramHtml(p.name.toUpperCase())}</b>\n`;
    text += `   • <b>Status:</b> ${escapeTelegramHtml(p.status)} | <b>Progress:</b> ${pPercent}%\n`;
    if (p.client) {
      text += `   • <b>Client:</b> ${escapeTelegramHtml(p.client)}\n`;
    }

    // 1. Done / Completed tasks (All)
    if (pCompleted.length > 0) {
      text += `   • <b>Done:</b>\n`;
      pCompleted.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ✓ ${escapeTelegramHtml(t.title)} (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 2. In Progress tasks (All)
    if (pInProgress.length > 0) {
      text += `   • <b>In Progress:</b>\n`;
      pInProgress.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ⏳ ${escapeTelegramHtml(t.title)} [In Progress] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 3. Ready Review tasks (All)
    if (pReadyReview.length > 0) {
      text += `   • <b>Ready Review:</b>\n`;
      pReadyReview.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     📋 ${escapeTelegramHtml(t.title)} [Ready Review] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 4. Blocked tasks (All)
    if (pBlocked.length > 0) {
      text += `   • <b>Blocked:</b>\n`;
      pBlocked.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     ⚠️ ${escapeTelegramHtml(t.title)} [Blocked] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 5. Draft tasks (All)
    if (pDraft.length > 0) {
      text += `   • <b>Draft:</b>\n`;
      pDraft.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     📝 ${escapeTelegramHtml(t.title)} [Draft] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    // 6. Other custom statuses (if any exist)
    if (pOther.length > 0) {
      text += `   • <b>Other:</b>\n`;
      pOther.forEach((t: any) => {
        const assignee = members.find((m: any) => m.id === t.assignee_id)?.name || 'Unassigned';
        text += `     • ${escapeTelegramHtml(t.title)} [${escapeTelegramHtml(t.status)}] (${escapeTelegramHtml(assignee)})\n`;
      });
    }

    if (pTasks.length === 0) {
      text += `   • <i>No tasks</i>\n`;
    }

    text += `\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<i>Sent automatically by Project Management Dashboard</i>`;
  return text;
}

// Background Automated Telegram Scheduler
export function startTelegramWeeklyScheduler(): void {
  console.log('[Telegram Scheduler] Automated Telegram weekly report scheduler initialized (Timezone: UTC+7 / Asia/Bangkok).');

  setInterval(async () => {
    try {
      const pool = getPool();
      const res = await pool.query('SELECT * FROM telegram_settings WHERE id = $1', ['default']);
      if (res.rowCount === 0) return;

      const settings = res.rows[0];
      if (!settings.enabled || !settings.bot_token || !settings.chat_id) return;

      const utc7 = getNowInUtcPlus7();
      const currentDayName = utc7.dayName; // e.g. "Monday"
      const targetDay = settings.send_day || 'Monday';

      // Day check: matches if Daily/Everyday OR if day name matches (case-insensitive)
      const isDaily = targetDay.toLowerCase() === 'daily' || targetDay.toLowerCase() === 'everyday';
      const isScheduledDay = isDaily || currentDayName.toLowerCase() === targetDay.toLowerCase();
      if (!isScheduledDay) return;

      const todayDateStr = utc7.dateStr; // e.g. "2026-09-08"

      // Avoid duplicate auto-send if already sent on this calendar date in UTC+7
      if (settings.last_auto_sent_date === todayDateStr) {
        return;
      }

      const currentTime = utc7.timeStr; // "HH:MM" in UTC+7
      const targetTime = settings.send_time || '08:00';

      // Check if current time has reached or passed the target time
      if (currentTime < targetTime) return;

      // Calculate time difference in minutes between current and target
      const [currH, currM] = currentTime.split(':').map(Number);
      const [targetH, targetM] = targetTime.split(':').map(Number);
      const diffMinutes = (currH * 60 + currM) - (targetH * 60 + targetM);

      // Only catch up if within 180 minutes (3 hours) of the target time
      if (diffMinutes > 180) {
        return;
      }

      console.log(`[Telegram Scheduler UTC+7] Scheduled trigger matched: ${currentDayName} ${currentTime} (Target: ${targetDay} ${targetTime}, diff: ${diffMinutes}m). Dispatching automated report...`);
      const reportText = await generateTelegramWeeklyReport(pool);
      const sendRes = await sendTelegramMessage(settings.bot_token, settings.chat_id, reportText);

      if (sendRes.ok) {
        console.log(`[Telegram Scheduler UTC+7] Auto-report sent successfully to Telegram chat ${settings.chat_id}.`);
        await pool.query(
          'UPDATE telegram_settings SET last_sent_at = CURRENT_TIMESTAMP, last_auto_sent_date = $1 WHERE id = $2',
          [todayDateStr, 'default']
        );
      } else {
        console.error('[Telegram Scheduler UTC+7] Failed to send report to Telegram:', sendRes.message);
      }
    } catch (err: any) {
      console.error('[Telegram Scheduler UTC+7 Exception]:', err.message);
    }
  }, 15000);
}

