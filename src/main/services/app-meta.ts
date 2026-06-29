import { app } from 'electron';
import type { AppMeta, AppVersionInfo } from '../../shared/types.js';

const REPOSITORY_URL = 'https://github.com/Freakz2z/OpenStudy';
const RELEASES_URL = `${REPOSITORY_URL}/releases`;
const LATEST_RELEASE_API = 'https://api.github.com/repos/Freakz2z/OpenStudy/releases/latest';
const VERSION_CACHE_TTL_MS = 30 * 60 * 1000;

let cachedVersionInfo: AppVersionInfo | null = null;

function normalizeVersion(version: string): string[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((segment) => segment.replace(/\D+/g, ''))
    .filter(Boolean);
}

function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const l = Number(left[index] ?? '0');
    const r = Number(right[index] ?? '0');
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

export function getAppMeta(): AppMeta {
  return {
    name: app.getName(),
    version: app.getVersion(),
    repositoryUrl: REPOSITORY_URL,
    releasesUrl: RELEASES_URL,
  };
}

export async function checkLatestRelease(force = false): Promise<AppVersionInfo> {
  const now = Date.now();
  if (
    !force &&
    cachedVersionInfo &&
    now - cachedVersionInfo.checkedAt < VERSION_CACHE_TTL_MS
  ) {
    return cachedVersionInfo;
  }

  const currentVersion = app.getVersion();
  const fallbackReleaseUrl = `${RELEASES_URL}/latest`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `OpenStudy/${currentVersion}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
    };
    const latestVersion = payload.tag_name?.replace(/^v/i, '') ?? null;
    const releaseUrl = payload.html_url || fallbackReleaseUrl;
    const info: AppVersionInfo = {
      currentVersion,
      latestVersion,
      upToDate: latestVersion ? compareVersions(currentVersion, latestVersion) >= 0 : null,
      checkedAt: now,
      releaseUrl,
      error: null,
    };
    cachedVersionInfo = info;
    return info;
  } catch (error) {
    const info: AppVersionInfo = {
      currentVersion,
      latestVersion: null,
      upToDate: null,
      checkedAt: now,
      releaseUrl: fallbackReleaseUrl,
      error: error instanceof Error ? error.message : String(error),
    };
    cachedVersionInfo = info;
    return info;
  }
}
