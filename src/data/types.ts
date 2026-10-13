import type { TaskList } from '../models/task-list';
import type { Task } from '../models/task';
import type { Habit } from '../models/habit';

export type Records = { tasks: Task[]; habits: Habit[]; lists?: TaskList[] };
export type Mutation = {
  mutationId: string; entity: 'tasks' | 'habits' | 'lists'; id: string;
  action: 'create' | 'import' | 'patch' | 'delete' | 'day';
  item?: Task | Habit | TaskList;
  patch?: Partial<Task> | Partial<Habit> | Partial<TaskList>;
  day?: string; done?: boolean;
};
export type SyncStatus = 'loading' | 'local' | 'syncing' | 'synced' | 'pending' | 'error';
export type DataSnapshot = Records & { ready: boolean; status: SyncStatus; pending: number; error: string | null };
