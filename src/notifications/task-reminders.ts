import { Platform } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';
import { getTaskReminderAt, type Task } from '@/models/task';

const CHANNEL_ID = 'task-reminders';
type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null = null;
let notificationHandlerSet = false;
let notificationModuleUnavailable = false;

let queue = Promise.resolve();

export function synchronizeTaskReminders(tasks: Task[]) {
  const snapshot = tasks;
  queue = queue.catch(() => {}).then(() => reconcileTaskReminders(snapshot));
  return queue;
}

async function reconcileTaskReminders(tasks: Task[]) {
  // Expo Go's bundled native module can differ from the version required by this SDK.
  // Avoid importing expo-notifications there; the feature is enabled in our own native builds.
  if (Platform.OS === 'web' || Constants.appOwnership === AppOwnership.Expo) return;

  const desired = new Map<string, { task: Task; fireAt: number }>();
  const now = Date.now();
  for (const task of tasks) {
    if (task.completed) continue;
    const fireAt = getTaskReminderAt(task);
    if (fireAt !== null && Number.isFinite(fireAt) && fireAt > now) desired.set(task.id, { task, fireAt });
  }
  if (!desired.size && !notificationsModule) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de tareas',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
    });
  }

  const current = await Notifications.getAllScheduledNotificationsAsync();
  const tracked = current.filter((notification) => typeof notification.content.data?.taskId === 'string');
  const valid = new Map<string, string>();
  for (const notification of tracked) {
    const taskId = notification.content.data?.taskId as string;
    const desiredReminder = desired.get(taskId);
    const fireAt = Number(notification.content.data?.fireAt);
    const body = desiredReminder?.task.description || 'Tu tarea está por comenzar.';
    if (desiredReminder && fireAt === desiredReminder.fireAt && notification.content.title === desiredReminder.task.title && notification.content.body === body && !valid.has(taskId)) {
      valid.set(taskId, notification.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  const missing = [...desired.entries()].filter(([taskId]) => !valid.has(taskId));
  if (!missing.length) return;

  let permissions = await Notifications.getPermissionsAsync();
  const allowed = () => permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed() && permissions.status !== 'denied') permissions = await Notifications.requestPermissionsAsync();
  if (!allowed()) return;

  await Promise.all(missing.map(async ([taskId, { task, fireAt }]) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.description || 'Tu tarea está por comenzar.',
        sound: 'default',
        data: { taskId, fireAt },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }));
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (notificationModuleUnavailable) return null;
  try {
    notificationsModule ??= await import('expo-notifications');
    if (!notificationHandlerSet) {
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationHandlerSet = true;
    }
    return notificationsModule;
  } catch {
    // Expo Go builds can lack the native notifications module. Keep the app usable there.
    notificationModuleUnavailable = true;
    return null;
  }
}
