import React from 'react';

export type PlatformType =
  | 'youtube'
  | 'figma'
  | 'google-drive'
  | 'google-docs'
  | 'google-sheets'
  | 'google-slides'
  | 'github'
  | 'gitlab'
  | 'notion'
  | 'loom'
  | 'trello'
  | 'slack'
  | 'miro'
  | 'canva'
  | 'linear'
  | 'zoom'
  | 'jira'
  | 'dropbox'
  | 'dribbble'
  | 'behance'
  | 'general';

export interface PlatformMeta {
  id: PlatformType;
  label: string;
  brandColor: string;
  bgLight: string;
  bgDark: string;
  badgeBorder: string;
}

/**
 * Normalizes input URL by trimming and adding https:// protocol if missing
 */
export function normalizeUrl(input: string): string {
  let trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Checks if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts a clean hostname for display (e.g. 'figma.com')
 */
export function extractHostname(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

/**
 * Detects the platform based on URL hostname and pathname
 */
export function detectPlatform(url: string): PlatformMeta {
  if (!url || !url.trim()) {
    return {
      id: 'general',
      label: 'Website Link',
      brandColor: '#64748b',
      bgLight: 'bg-slate-100 text-slate-700',
      bgDark: 'dark:bg-slate-800 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-slate-700',
    };
  }

  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.toLowerCase();

    // 1. YouTube
    if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
      return {
        id: 'youtube',
        label: 'YouTube',
        brandColor: '#FF0000',
        bgLight: 'bg-red-50 text-red-700',
        bgDark: 'dark:bg-red-950/50 dark:text-red-300',
        badgeBorder: 'border-red-200 dark:border-red-800/60',
      };
    }

    // 2. Figma
    if (host === 'figma.com' || host.endsWith('.figma.com')) {
      return {
        id: 'figma',
        label: 'Figma',
        brandColor: '#F24E1E',
        bgLight: 'bg-purple-50 text-purple-700',
        bgDark: 'dark:bg-purple-950/50 dark:text-purple-300',
        badgeBorder: 'border-purple-200 dark:border-purple-800/60',
      };
    }

    // 3. Google Services
    if (host === 'docs.google.com') {
      if (path.startsWith('/spreadsheets')) {
        return {
          id: 'google-sheets',
          label: 'Google Sheets',
          brandColor: '#0F9D58',
          bgLight: 'bg-emerald-50 text-emerald-700',
          bgDark: 'dark:bg-emerald-950/50 dark:text-emerald-300',
          badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
        };
      }
      if (path.startsWith('/presentation')) {
        return {
          id: 'google-slides',
          label: 'Google Slides',
          brandColor: '#F4B400',
          bgLight: 'bg-amber-50 text-amber-700',
          bgDark: 'dark:bg-amber-950/50 dark:text-amber-300',
          badgeBorder: 'border-amber-200 dark:border-amber-800/60',
        };
      }
      return {
        id: 'google-docs',
        label: 'Google Docs',
        brandColor: '#4285F4',
        bgLight: 'bg-blue-50 text-blue-700',
        bgDark: 'dark:bg-blue-950/50 dark:text-blue-300',
        badgeBorder: 'border-blue-200 dark:border-blue-800/60',
      };
    }

    if (host === 'drive.google.com') {
      return {
        id: 'google-drive',
        label: 'Google Drive',
        brandColor: '#1FA463',
        bgLight: 'bg-emerald-50 text-emerald-700',
        bgDark: 'dark:bg-emerald-950/50 dark:text-emerald-300',
        badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
      };
    }

    if (host === 'sheets.google.com') {
      return {
        id: 'google-sheets',
        label: 'Google Sheets',
        brandColor: '#0F9D58',
        bgLight: 'bg-emerald-50 text-emerald-700',
        bgDark: 'dark:bg-emerald-950/50 dark:text-emerald-300',
        badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
      };
    }

    // 4. GitHub
    if (host === 'github.com' || host === 'gist.github.com') {
      return {
        id: 'github',
        label: 'GitHub',
        brandColor: '#24292F',
        bgLight: 'bg-slate-100 text-slate-800',
        bgDark: 'dark:bg-slate-800 dark:text-slate-200',
        badgeBorder: 'border-slate-300 dark:border-slate-700',
      };
    }

    // 5. GitLab
    if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
      return {
        id: 'gitlab',
        label: 'GitLab',
        brandColor: '#FC6D26',
        bgLight: 'bg-orange-50 text-orange-700',
        bgDark: 'dark:bg-orange-950/50 dark:text-orange-300',
        badgeBorder: 'border-orange-200 dark:border-orange-800/60',
      };
    }

    // 6. Notion
    if (host === 'notion.so' || host === 'notion.site' || host.endsWith('.notion.site')) {
      return {
        id: 'notion',
        label: 'Notion',
        brandColor: '#000000',
        bgLight: 'bg-neutral-100 text-neutral-900',
        bgDark: 'dark:bg-neutral-800 dark:text-neutral-100',
        badgeBorder: 'border-neutral-300 dark:border-neutral-700',
      };
    }

    // 7. Loom
    if (host === 'loom.com' || host.endsWith('.loom.com')) {
      return {
        id: 'loom',
        label: 'Loom',
        brandColor: '#625DF5',
        bgLight: 'bg-indigo-50 text-indigo-700',
        bgDark: 'dark:bg-indigo-950/50 dark:text-indigo-300',
        badgeBorder: 'border-indigo-200 dark:border-indigo-800/60',
      };
    }

    // 8. Trello
    if (host === 'trello.com') {
      return {
        id: 'trello',
        label: 'Trello',
        brandColor: '#0079BF',
        bgLight: 'bg-sky-50 text-sky-700',
        bgDark: 'dark:bg-sky-950/50 dark:text-sky-300',
        badgeBorder: 'border-sky-200 dark:border-sky-800/60',
      };
    }

    // 9. Slack
    if (host === 'slack.com' || host.endsWith('.slack.com')) {
      return {
        id: 'slack',
        label: 'Slack',
        brandColor: '#4A154B',
        bgLight: 'bg-amber-50 text-amber-800',
        bgDark: 'dark:bg-amber-950/50 dark:text-amber-300',
        badgeBorder: 'border-amber-200 dark:border-amber-800/60',
      };
    }

    // 10. Miro
    if (host === 'miro.com') {
      return {
        id: 'miro',
        label: 'Miro',
        brandColor: '#FFD02F',
        bgLight: 'bg-yellow-50 text-yellow-800',
        bgDark: 'dark:bg-yellow-950/50 dark:text-yellow-300',
        badgeBorder: 'border-yellow-200 dark:border-yellow-800/60',
      };
    }

    // 11. Canva
    if (host === 'canva.com') {
      return {
        id: 'canva',
        label: 'Canva',
        brandColor: '#00C4CC',
        bgLight: 'bg-teal-50 text-teal-700',
        bgDark: 'dark:bg-teal-950/50 dark:text-teal-300',
        badgeBorder: 'border-teal-200 dark:border-teal-800/60',
      };
    }

    // 12. Linear
    if (host === 'linear.app') {
      return {
        id: 'linear',
        label: 'Linear',
        brandColor: '#5E6AD2',
        bgLight: 'bg-indigo-50 text-indigo-700',
        bgDark: 'dark:bg-indigo-950/50 dark:text-indigo-300',
        badgeBorder: 'border-indigo-200 dark:border-indigo-800/60',
      };
    }

    // 13. Zoom
    if (host === 'zoom.us' || host.endsWith('.zoom.us')) {
      return {
        id: 'zoom',
        label: 'Zoom',
        brandColor: '#2D8CFF',
        bgLight: 'bg-blue-50 text-blue-700',
        bgDark: 'dark:bg-blue-950/50 dark:text-blue-300',
        badgeBorder: 'border-blue-200 dark:border-blue-800/60',
      };
    }

    // 14. Jira / Atlassian / Confluence
    if (host.endsWith('.atlassian.net') || host === 'jira.com' || host === 'confluence.com') {
      return {
        id: 'jira',
        label: 'Atlassian Jira',
        brandColor: '#0052CC',
        bgLight: 'bg-blue-50 text-blue-700',
        bgDark: 'dark:bg-blue-950/50 dark:text-blue-300',
        badgeBorder: 'border-blue-200 dark:border-blue-800/60',
      };
    }

    // 15. Dropbox
    if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
      return {
        id: 'dropbox',
        label: 'Dropbox',
        brandColor: '#0061FE',
        bgLight: 'bg-sky-50 text-sky-700',
        bgDark: 'dark:bg-sky-950/50 dark:text-sky-300',
        badgeBorder: 'border-sky-200 dark:border-sky-800/60',
      };
    }

    // 16. Dribbble
    if (host === 'dribbble.com') {
      return {
        id: 'dribbble',
        label: 'Dribbble',
        brandColor: '#EA4C89',
        bgLight: 'bg-pink-50 text-pink-700',
        bgDark: 'dark:bg-pink-950/50 dark:text-pink-300',
        badgeBorder: 'border-pink-200 dark:border-pink-800/60',
      };
    }

    // 17. Behance
    if (host === 'behance.net') {
      return {
        id: 'behance',
        label: 'Behance',
        brandColor: '#1769FF',
        bgLight: 'bg-blue-50 text-blue-700',
        bgDark: 'dark:bg-blue-950/50 dark:text-blue-300',
        badgeBorder: 'border-blue-200 dark:border-blue-800/60',
      };
    }

    // General fallback with formatted domain
    const formattedDomain = host.charAt(0).toUpperCase() + host.slice(1);
    return {
      id: 'general',
      label: formattedDomain,
      brandColor: '#64748b',
      bgLight: 'bg-slate-100 text-slate-700',
      bgDark: 'dark:bg-slate-800 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-slate-700',
    };
  } catch {
    return {
      id: 'general',
      label: 'Website',
      brandColor: '#64748b',
      bgLight: 'bg-slate-100 text-slate-700',
      bgDark: 'dark:bg-slate-800 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-slate-700',
    };
  }
}

/**
 * Suggests a default clean title based on URL and platform
 */
export function suggestTitle(url: string, platformMeta: PlatformMeta): string {
  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // If platform is Figma
    if (platformMeta.id === 'figma') {
      const fileIndex = pathParts.findIndex((p) => p === 'file' || p === 'design' || p === 'proto');
      if (fileIndex !== -1 && pathParts[fileIndex + 2]) {
        const rawName = decodeURIComponent(pathParts[fileIndex + 2]).replace(/[-_]+/g, ' ');
        return rawName.charAt(0).toUpperCase() + rawName.slice(1);
      }
      return 'Figma Design File';
    }

    // If platform is YouTube
    if (platformMeta.id === 'youtube') {
      return 'YouTube Video';
    }

    // If Google Docs / Sheets / Slides
    if (platformMeta.id === 'google-docs') return 'Google Document';
    if (platformMeta.id === 'google-sheets') return 'Google Spreadsheet';
    if (platformMeta.id === 'google-slides') return 'Google Presentation';
    if (platformMeta.id === 'google-drive') return 'Google Drive File';

    // If GitHub
    if (platformMeta.id === 'github' && pathParts.length >= 2) {
      return `${pathParts[0]}/${pathParts[1]}`;
    }

    // If last path part exists and has meaningful text
    if (pathParts.length > 0) {
      const lastPart = decodeURIComponent(pathParts[pathParts.length - 1])
        .replace(/\.[a-zA-Z0-9]+$/, '')
        .replace(/[-_]+/g, ' ');
      if (lastPart.length > 1 && lastPart.length < 50) {
        return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
      }
    }

    return platformMeta.label;
  } catch {
    return platformMeta.label;
  }
}

/**
 * Component that renders the official crisp vector logo for the platform
 */
export const PlatformLogo: React.FC<{
  platformId: PlatformType | string;
  url?: string;
  className?: string;
  size?: number;
}> = ({ platformId, url, className = '', size = 20 }) => {
  const [faviconError, setFaviconError] = React.useState(false);

  // 1. YouTube Official Logo
  if (platformId === 'youtube') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#FF0000" />
        <path d="M10 8.5L15.5 12L10 15.5V8.5Z" fill="white" />
      </svg>
    );
  }

  // 2. Figma Official 5-Blob Logo
  if (platformId === 'figma') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 38 57"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"
          fill="#1ABCFE"
        />
        <path
          d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"
          fill="#0ACF83"
        />
        <path
          d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"
          fill="#FF7262"
        />
        <path
          d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"
          fill="#F24E1E"
        />
        <path
          d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"
          fill="#A259FF"
        />
      </svg>
    );
  }

  // 3. Google Drive
  if (platformId === 'google-drive') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 87.3 78"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M6.6 66.85L32.8 21.5H86.2L60 66.85H6.6Z" fill="#0066DA" />
        <path d="M57.65 66.85L83.85 21.5L57.65 0L31.45 45.35L57.65 66.85Z" fill="#00AC47" />
        <path d="M31.45 45.35L6.6 66.85L0 55.45L24.85 12.35L31.45 45.35Z" fill="#EA4335" />
        <path d="M83.85 21.5H32.8L24.85 12.35L51.05 0L83.85 21.5Z" fill="#FFBA00" />
      </svg>
    );
  }

  // 4. Google Docs
  if (platformId === 'google-docs') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#4285F4" />
        <path d="M14 2V8H20L14 2Z" fill="#A1C2FA" />
        <path d="M16 13H8V11.5H16V13ZM16 16H8V14.5H16V16ZM12 19H8V17.5H12V19Z" fill="white" />
      </svg>
    );
  }

  // 5. Google Sheets
  if (platformId === 'google-sheets') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#0F9D58" />
        <path d="M14 2V8H20L14 2Z" fill="#87CEAC" />
        <path d="M7 11.5H17V18.5H7V11.5ZM8.5 13V14.5H11.5V13H8.5ZM12.5 13V14.5H15.5V13H12.5ZM8.5 15.5V17H11.5V15.5H8.5ZM12.5 15.5V17H15.5V15.5H12.5Z" fill="white" />
      </svg>
    );
  }

  // 6. Google Slides
  if (platformId === 'google-slides') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#F4B400" />
        <path d="M14 2V8H20L14 2Z" fill="#FCDA7B" />
        <rect x="7.5" y="11.5" width="9" height="7" rx="1" fill="white" />
      </svg>
    );
  }

  // 7. GitHub
  if (platformId === 'github') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`shrink-0 text-slate-800 dark:text-slate-100 ${className}`}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017C2 16.442 4.87 20.191 8.844 21.517C9.344 21.609 9.526 21.301 9.526 21.036C9.526 20.801 9.517 20.177 9.513 19.351C6.73 19.955 6.143 18.01 6.143 18.01C5.688 16.853 5.034 16.544 5.034 16.544C4.126 15.922 5.103 15.935 5.103 15.935C6.107 16.006 6.636 16.969 6.636 16.969C7.528 18.498 8.976 18.056 9.546 17.801C9.638 17.155 9.896 16.714 10.181 16.464C7.96 16.212 5.625 15.352 5.625 11.523C5.625 10.432 6.015 9.541 6.657 8.844C6.554 8.592 6.211 7.574 6.755 6.208C6.755 6.208 7.593 5.94 9.502 7.234C10.298 7.013 11.15 6.902 12 6.898C12.85 6.902 13.702 7.013 14.498 7.234C16.407 5.94 17.245 6.208 17.245 6.208C17.789 7.574 17.446 8.592 17.343 8.844C17.985 9.541 18.375 10.432 18.375 11.523C18.375 15.362 16.035 16.209 13.807 16.456C14.165 16.764 14.485 17.373 14.485 18.307C14.485 19.646 14.473 20.727 14.473 21.036C14.473 21.304 14.653 21.615 15.161 21.516C19.13 20.189 22 16.441 22 12.017C22 6.484 17.523 2 12 2Z"
        />
      </svg>
    );
  }

  // 8. GitLab
  if (platformId === 'gitlab') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M22.65 14.39L20.67 8.3C20.53 7.87 19.95 7.87 19.81 8.3L17.83 14.39H22.65Z" fill="#E24329" />
        <path d="M1.35 14.39L3.33 8.3C3.47 7.87 4.05 7.87 4.19 8.3L6.17 14.39H1.35Z" fill="#E24329" />
        <path d="M12 22.11L17.83 14.39H6.17L12 22.11Z" fill="#E24329" />
        <path d="M1.35 14.39L12 22.11L6.17 14.39H1.35Z" fill="#FC6D26" />
        <path d="M22.65 14.39L12 22.11L17.83 14.39H22.65Z" fill="#FC6D26" />
        <path d="M12 22.11L6.17 14.39L7.86 9.19C7.96 8.87 8.41 8.87 8.52 9.19L12 22.11Z" fill="#FCA326" />
        <path d="M12 22.11L17.83 14.39L16.14 9.19C16.04 8.87 15.59 8.87 15.48 9.19L12 22.11Z" fill="#FCA326" />
      </svg>
    );
  }

  // 9. Notion
  if (platformId === 'notion') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="4.5" fill="#000000" />
        <path
          d="M6.5 6.5L16.5 6L17.5 7.5V17L16 18L10 12V17.5H7V7.5L6.5 6.5Z"
          fill="white"
        />
        <path
          d="M10 8.5V11L14.5 15.5H16V8.5H14.5L11.5 8.5H10Z"
          fill="black"
        />
      </svg>
    );
  }

  // 10. Loom
  if (platformId === 'loom') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#625DF5" />
        <circle cx="12" cy="12" r="4.5" fill="white" />
        <path d="M12 3V7.5M12 16.5V21M3 12H7.5M16.5 12H21" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 11. Trello
  if (platformId === 'trello') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="4.5" fill="#0079BF" />
        <rect x="5.5" y="5.5" width="5.5" height="11" rx="1.5" fill="white" />
        <rect x="13" y="5.5" width="5.5" height="7.5" rx="1.5" fill="white" />
      </svg>
    );
  }

  // 12. Slack
  if (platformId === 'slack') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#4A154B" />
        <circle cx="9" cy="9" r="2" fill="#E01E5A" />
        <circle cx="15" cy="9" r="2" fill="#36C5F0" />
        <circle cx="15" cy="15" r="2" fill="#2EB67D" />
        <circle cx="9" cy="15" r="2" fill="#ECB22E" />
      </svg>
    );
  }

  // 13. Miro
  if (platformId === 'miro') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#FFD02F" />
        <path d="M8.5 7L6.5 17H8.5L10.5 7H8.5ZM12 7L10 17H12L14 7H12ZM15.5 7L13.5 17H15.5L17.5 7H15.5Z" fill="#050038" />
      </svg>
    );
  }

  // 14. Canva
  if (platformId === 'canva') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <circle cx="12" cy="12" r="11" fill="#00C4CC" />
        <path d="M12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // 15. Linear
  if (platformId === 'linear') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#5E6AD2" />
        <path d="M7 17L17 7M7 7L17 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 16. Zoom
  if (platformId === 'zoom') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#2D8CFF" />
        <rect x="6" y="8.5" width="8" height="7" rx="1.5" fill="white" />
        <path d="M14 11L18 8.5V15.5L14 13V11Z" fill="white" />
      </svg>
    );
  }

  // 17. Jira / Atlassian
  if (platformId === 'jira') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#0052CC" />
        <path d="M11.5 5.5V12.5C11.5 14.7 9.7 16.5 7.5 16.5H6.5V9.5C6.5 7.3 8.3 5.5 10.5 5.5H11.5Z" fill="white" fillOpacity="0.85" />
        <path d="M17.5 11.5V18.5H16.5C14.3 18.5 12.5 16.7 12.5 14.5V7.5H13.5C15.7 7.5 17.5 9.3 17.5 11.5Z" fill="white" />
      </svg>
    );
  }

  // 18. Dropbox
  if (platformId === 'dropbox') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#0061FE" />
        <path d="M8 7L12 9.5L8 12L4 9.5L8 7Z" fill="white" />
        <path d="M16 7L20 9.5L16 12L12 9.5L16 7Z" fill="white" />
        <path d="M8 17L12 14.5L8 12L4 14.5L8 17Z" fill="white" />
        <path d="M16 17L20 14.5L16 12L12 14.5L16 17Z" fill="white" />
      </svg>
    );
  }

  // 19. Dribbble
  if (platformId === 'dribbble') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <circle cx="12" cy="12" r="10" fill="#EA4C89" />
        <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.8" />
      </svg>
    );
  }

  // 20. Behance
  if (platformId === 'behance') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect width="24" height="24" rx="5" fill="#1769FF" />
        <path d="M7 8H10.5C11.6 8 12.5 8.9 12.5 10C12.5 10.7 12.1 11.3 11.5 11.7C12.4 12 13 12.8 13 13.8C13 15 12 16 10.8 16H7V8ZM8.8 9.5V11.2H10.4C10.9 11.2 11.3 10.8 11.3 10.3C11.3 9.9 10.9 9.5 10.4 9.5H8.8ZM8.8 12.7V14.5H10.6C11.1 14.5 11.5 14.1 11.5 13.6C11.5 13.1 11.1 12.7 10.6 12.7H8.8ZM15 9H18.5V10H15V9ZM16.8 11C18.2 11 19.2 12 19.2 13.5V14H15.5C15.6 14.7 16.2 15.2 17 15.2C17.6 15.2 18.1 14.9 18.3 14.4H19.2C18.9 15.5 18 16.2 17 16.2C15.4 16.2 14.3 15 14.3 13.5C14.3 12.1 15.4 11 16.8 11ZM18.1 13.1C18 12.5 17.5 12 16.8 12C16.1 12 15.6 12.5 15.5 13.1H18.1Z" fill="white" />
      </svg>
    );
  }

  // 21. General Fallback: Favicon with graceful SVG Globe fallback
  if (url && !faviconError) {
    const domain = extractHostname(url);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    return (
      <img
        src={faviconUrl}
        alt={domain}
        width={size}
        height={size}
        onError={() => setFaviconError(true)}
        className={`rounded-sm object-contain shrink-0 ${className}`}
      />
    );
  }

  // Fallback Globe / Link Icon
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-slate-500 dark:text-slate-400 shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
};

