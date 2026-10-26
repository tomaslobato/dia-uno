import { Platform } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';
import type { Habit } from '@/models/habit';

const CHANNEL_ID = 'habit-reminders';
type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null = null;
let notificationHandlerSet = false;
let notificationModuleUnavailable = false;
let queue = Promise.resolve();

export function synchronizeHabitReminders(habits: Habit[]) {
  const snapshot = habits;
  queue = queue.catch(() => {}).then(() => reconcileHabitReminders(snapshot));
  return queue;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || Constants.appOwnership === AppOwnership.Expo) return false;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de hábitos',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  let permissions = await Notifications.getPermissionsAsync();
  const allowed = () => permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed() && permissions.status !== 'denied') permissions = await Notifications.requestPermissionsAsync();
  return allowed();
}

async function reconcileHabitReminders(habits: Habit[]) {
  if (Platform.OS === 'web' || Constants.appOwnership === AppOwnership.Expo) return;

  const desired = new Map<string, Habit>();
  for (const habit of habits) {
    if (habit.reminderTime) desired.set(habit.id, habit);
  }
  if (!desired.size && !notificationsModule) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de hábitos',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  const current = await Notifications.getAllScheduledNotificationsAsync();
  const tracked = current.filter((notification) => typeof notification.content.data?.habitId === 'string');
  const valid = new Map<string, string>();
  for (const notification of tracked) {
    const habitId = notification.content.data?.habitId as string;
    const habit = desired.get(habitId);
    const reminderTime = notification.content.data?.reminderTime;
    const body = habit?.description || 'Es momento de cumplir tu hábito.';
    if (habit && reminderTime === habit.reminderTime && notification.content.title === habit.name && notification.content.body === body && !valid.has(habitId)) {
      valid.set(habitId, notification.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  const missing = [...desired.entries()].filter(([habitId]) => !valid.has(habitId));
  if (!missing.length) return;

  let permissions = await Notifications.getPermissionsAsync();
  const allowed = () => permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed() && permissions.status !== 'denied') permissions = await Notifications.requestPermissionsAsync();
  if (!allowed()) return;

  await Promise.all(missing.map(async ([habitId, habit]) => {
    const [hour, minute] = (habit.reminderTime as string).split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: habit.name,
        body: habit.description || 'Es momento de cumplir tu hábito.',
        sound: 'default',
        data: { habitId, reminderTime: habit.reminderTime },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
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
    notificationModuleUnavailable = true;
    return null;
  }
}
