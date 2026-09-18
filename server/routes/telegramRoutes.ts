import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { requireAdmin } from '../middleware/auth';
import {
  getNowInUtcPlus7,
  sendTelegramMessage,
  generateTelegramWeeklyReport,
} from '../services/telegramService';

const router = Router();

// GET /api/telegram/settings (admin only)
router.get('/settings', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM telegram_settings ORDER BY (CASE WHEN id = 'default' THEN 0 ELSE 1 END), created_at DESC LIMIT 1`
    );
    const utc7 = getNowInUtcPlus7();
    const serverCurrentDay = utc7.dayName;
    const serverCurrentTime = utc7.timeStr;
    const serverTimezone = 'UTC+7 (Asia/Bangkok)';

    const row = result.rows[0] || {};
    const envToken = (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim();
    const envChat = (process.env.TELEGRAM_CHAT_ID || '').trim();

    const rawToken = (row.bot_token || envToken || '').trim();
    const hasToken = rawToken.length > 0;
    const botTokenMasked = hasToken
      ? `${rawToken.slice(0, 6)}••••••••${rawToken.slice(-4)}`
      : '';
    const chatId = (row.chat_id || envChat || '').trim();

    res.json({
      enabled: row.enabled !== undefined ? !!row.enabled : (hasToken && chatId.length > 0),
      notifyReadyReview: row.notify_ready_review !== false,
      notifyCompleted: row.notify_completed !== false,
      hasToken,
      botTokenMasked,
      chatId,
      sendDay: row.send_day || 'Monday',
      sendTime: row.send_time || '08:00',
      lastSentAt: row.last_sent_at || null,
      lastAutoSentDate: row.last_auto_sent_date || null,
      serverCurrentDay,
      serverCurrentTime,
      serverTimezone,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/settings (admin only)
router.post('/settings', requireAdmin, async (req: Request, res: Response) => {
  const { botToken, chatId, enabled, notifyReadyReview, notifyCompleted, sendDay, sendTime } = req.body;
  try {
    const pool = getPool();

    // Ensure columns exist on legacy database schemas
    await pool.query(`
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS notify_ready_review BOOLEAN DEFAULT true;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS notify_completed BOOLEAN DEFAULT true;
    `).catch(() => {});

    let query: string;
    let params: any[];

    const effectiveChatId = (chatId || '').trim();
    const isEnabled = enabled !== undefined ? !!enabled : true;
    const isNotifyReview = notifyReadyReview !== false;
    const isNotifyCompleted = notifyCompleted !== false;
    const effectiveDay = sendDay || 'Monday';
    const effectiveTime = sendTime || '08:00';

    if (botToken !== undefined && botToken.trim().length > 0) {
      query = `
        INSERT INTO telegram_settings (id, bot_token, chat_id, enabled, notify_ready_review, notify_completed, send_day, send_time, last_auto_sent_date, updated_at)
        VALUES ('default', $1, $2, $3, $4, $5, $6, $7, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          bot_token = EXCLUDED.bot_token,
          chat_id = EXCLUDED.chat_id,
          enabled = EXCLUDED.enabled,
          notify_ready_review = EXCLUDED.notify_ready_review,
          notify_completed = EXCLUDED.notify_completed,
          send_day = EXCLUDED.send_day,
          send_time = EXCLUDED.send_time,
          last_auto_sent_date = NULL,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, chat_id AS "chatId", enabled, notify_ready_review AS "notifyReadyReview", notify_completed AS "notifyCompleted", send_day AS "sendDay", send_time AS "sendTime", last_sent_at AS "lastSentAt", last_auto_sent_date AS "lastAutoSentDate"
      `;
      params = [botToken.trim(), effectiveChatId, isEnabled, isNotifyReview, isNotifyCompleted, effectiveDay, effectiveTime];
    } else {
      // Upsert: update existing or insert row 'default' with existing/env token
      const existing = await pool.query(`SELECT id, bot_token FROM telegram_settings WHERE id = 'default' LIMIT 1`);
      if (existing.rowCount === 0) {
        const envToken = (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim();
        query = `
          INSERT INTO telegram_settings (id, bot_token, chat_id, enabled, notify_ready_review, notify_completed, send_day, send_time, last_auto_sent_date, updated_at)
          VALUES ('default', $1, $2, $3, $4, $5, $6, $7, NULL, CURRENT_TIMESTAMP)
          RETURNING id, chat_id AS "chatId", enabled, notify_ready_review AS "notifyReadyReview", notify_completed AS "notifyCompleted", send_day AS "sendDay", send_time AS "sendTime", last_sent_at AS "lastSentAt", last_auto_sent_date AS "lastAutoSentDate"
        `;
        params = [envToken, effectiveChatId, isEnabled, isNotifyReview, isNotifyCompleted, effectiveDay, effectiveTime];
      } else {
        query = `
          UPDATE telegram_settings
          SET 
            chat_id = COALESCE($1, chat_id),
            enabled = COALESCE($2, enabled),
            notify_ready_review = COALESCE($3, notify_ready_review),
            notify_completed = COALESCE($4, notify_completed),
            send_day = COALESCE($5, send_day),
            send_time = COALESCE($6, send_time),
            last_auto_sent_date = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = 'default'
          RETURNING id, chat_id AS "chatId", enabled, notify_ready_review AS "notifyReadyReview", notify_completed AS "notifyCompleted", send_day AS "sendDay", send_time AS "sendTime", last_sent_at AS "lastSentAt", last_auto_sent_date AS "lastAutoSentDate"
        `;
        params = [effectiveChatId, isEnabled, isNotifyReview, isNotifyCompleted, effectiveDay, effectiveTime];
      }
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/test (admin only)
router.post('/test', requireAdmin, async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  try {
    const pool = getPool();
    let token = botToken?.trim();
    let chat = chatId?.trim();

    if (!token || !chat) {
      const dbSettings = await pool.query(
        `SELECT * FROM telegram_settings ORDER BY (CASE WHEN id = 'default' THEN 0 ELSE 1 END), created_at DESC LIMIT 1`
      );
      if (dbSettings.rowCount > 0) {
        if (!token) token = dbSettings.rows[0].bot_token;
        if (!chat) chat = dbSettings.rows[0].chat_id;
      }
      if (!token) token = (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim();
      if (!chat) chat = (process.env.TELEGRAM_CHAT_ID || '').trim();
    }

    if (!token || !chat) {
      return res.status(400).json({ error: 'Both Telegram Bot Token and Chat ID are required to send a test message.' });
    }

    const testMsg = `🚀 <b>Telegram Connection Verified!</b>\n\nYour Project Management Dashboard is now connected to Telegram.\n\n📅 <b>Schedule:</b> Automated Weekly Reports will be sent every Monday at the configured time.`;
    const sendResult = await sendTelegramMessage(token, chat, testMsg);

    if (!sendResult.ok) {
      return res.status(400).json({ error: sendResult.message });
    }

    res.json({ success: true, message: 'Test message sent successfully to Telegram!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-report (admin only)
router.post('/send-report', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM telegram_settings ORDER BY (CASE WHEN id = 'default' THEN 0 ELSE 1 END), created_at DESC LIMIT 1`
    );
    const row = result.rows[0] || {};
    const bot_token = (row.bot_token || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim();
    const chat_id = (row.chat_id || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!bot_token || !chat_id) {
      return res.status(400).json({ error: 'Telegram is not configured yet. Please configure your Bot Token and Chat ID first.' });
    }

    const reportText = await generateTelegramWeeklyReport(pool);
    const sendResult = await sendTelegramMessage(bot_token, chat_id, reportText);

    if (!sendResult.ok) {
      return res.status(400).json({ error: sendResult.message });
    }

    await pool.query(
      `UPDATE telegram_settings SET last_sent_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [row.id || 'default']
    );
    res.json({ success: true, message: 'Weekly Project Summary sent to Telegram successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
