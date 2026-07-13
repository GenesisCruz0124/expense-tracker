import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const RELEASES_URL = 'https://api.github.com/repos/GenesisCruz0124/expense-tracker/releases/latest';
const PROVIDER_AUTHORITY = 'com.genesiscruz0124.expensetracker.provider';

export interface ReleaseInfo {
  tagName: string;
  downloadUrl: string;
  body: string;
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const a = l[i] ?? 0;
    const b = c[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

export function useAppUpdate() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

  async function checkForUpdate(): Promise<ReleaseInfo | null> {
    setChecking(true);
    try {
      const res = await fetch(RELEASES_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
      const json = await res.json();
      const tagName: string = json.tag_name ?? '';
      const apkAsset = (json.assets as { browser_download_url: string; name: string }[])?.find((a) =>
        a.name.endsWith('.apk'),
      );
      const downloadUrl: string = apkAsset?.browser_download_url ?? '';
      const body: string = json.body ?? '';

      if (!tagName || !downloadUrl) throw new Error('No APK asset found in latest release.');

      if (!isNewer(tagName, currentVersion)) return null;

      const info: ReleaseInfo = { tagName, downloadUrl, body };
      setRelease(info);
      return info;
    } finally {
      setChecking(false);
    }
  }

  async function downloadAndInstall(downloadUrl: string) {
    if (Platform.OS !== 'android') {
      Alert.alert('Not supported', 'In-app updates are only available on Android.');
      return;
    }
    setDownloading(true);
    setProgress(0);
    const dest = (FileSystem.cacheDirectory ?? '') + 'update.apk';
    try {
      const dl = FileSystem.createDownloadResumable(
        downloadUrl,
        dest,
        {},
        (p) => {
          setProgress(p.totalBytesExpectedToWrite > 0 ? p.totalBytesWritten / p.totalBytesExpectedToWrite : 0);
        },
      );
      const result = await dl.downloadAsync();
      if (!result?.uri) throw new Error('Download failed — no output file.');
      setProgress(1);

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: `content://${PROVIDER_AUTHORITY}/apk/update.apk`,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Something went wrong during the update.');
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }

  return { checking, downloading, progress, release, currentVersion, checkForUpdate, downloadAndInstall };
}
