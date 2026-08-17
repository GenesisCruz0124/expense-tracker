import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const BUDGET_CHANNEL_ID = 'budget-alerts';
const BILL_CHANNEL_ID = 'bill-reminders';
const PERMISSION_TIMEOUT_MS = 8000;

/** Fallback used when a permission call hangs — "undetermined" lets the caller retry later. */
const UNDETERMINED_PERMISSION: Notifications.PermissionResponse = {
  status: Notifications.PermissionStatus.UNDETERMINED,
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

/**
 * `expo-notifications` permission calls can hang indefinitely on devices/emulators without a
 * system permission-prompt UI (e.g. Android AVDs lacking Play Services) — the promise neither
 * resolves nor rejects, which would otherwise freeze launch on the "Setting up your data…"
 * screen with no error to surface. Racing against a timeout guarantees a result either way.
 */
function withPermissionTimeout(promise: Promise<Notifications.PermissionResponse>): Promise<Notifications.PermissionResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(UNDETERMINED_PERMISSION), PERMISSION_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(UNDETERMINED_PERMISSION);
      },
    );
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Registers the Android notification channels budget alerts and bill reminders post to (required on Android 8+). */
export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(BUDGET_CHANNEL_ID, {
    name: 'Budget alerts',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(BILL_CHANNEL_ID, {
    name: 'Bill reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await withPermissionTimeout(Notifications.getPermissionsAsync());
  return status;
}

export async function requestNotificationPermissions(): Promise<Notifications.PermissionStatus> {
  const existing = await withPermissionTimeout(Notifications.getPermissionsAsync());
  if (existing.status === 'granted') return existing.status;

  const { status } = await withPermissionTimeout(Notifications.requestPermissionsAsync());
  return status;
}

/**
 * Fires an immediate local notification (trigger: null) — there's no future "due time" to
 * schedule against here, since the alert condition (spend crossing a threshold) is only
 * knowable when we evaluate it, which we do opportunistically on launch / after mutations.
 */
export async function presentBudgetAlert(title: string, body: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: BUDGET_CHANNEL_ID } : null,
  });
}

/**
 * Fires an immediate local notification for an upcoming or overdue bill (trigger: null) —
 * evaluated opportunistically on launch via `checkBillReminders`, same as budget alerts.
 */
export async function presentBillReminder(title: string, body: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: BILL_CHANNEL_ID } : null,
  });
}
