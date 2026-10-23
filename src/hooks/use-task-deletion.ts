import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/auth-provider';
import type { TaskDeleteScope } from '@/models/task';

type DeleteOptions = { scope?: TaskDeleteScope; day?: string };

export function useTaskDeletion(deleteTask: (id: string, options?: DeleteOptions) => void) {
  const { session } = useAuth();
  const owner = session?.user.id ?? 'guest';
  const [removed, setRemoved] = useState<{ id: string; owner: string } | null>(null);
  const removedId = removed?.owner === owner ? removed.id : null;
  const deletion = useRef<{ timer: ReturnType<typeof setTimeout>; commit: () => void } | null>(null);
  useEffect(() => {
    return () => {
      const pending = deletion.current;
      deletion.current = null;
      if (pending) { clearTimeout(pending.timer); pending.commit(); }
    };
  }, [owner]);
  function removeTask(id: string, options?: DeleteOptions) {
    const scope = options?.scope ?? 'all';
    // Occurrence / future edits apply immediately; only full deletes get undo.
    if (scope !== 'all') {
      const previous = deletion.current;
      if (previous) { clearTimeout(previous.timer); previous.commit(); deletion.current = null; setRemoved(null); }
      deleteTask(id, options);
      return;
    }
    const previous = deletion.current;
    if (previous) { clearTimeout(previous.timer); previous.commit(); }
    setRemoved({ id, owner });
    const commit = () => deleteTask(id, { scope: 'all' });
    const timer = setTimeout(() => {
      deletion.current = null;
      commit();
      setRemoved(null);
    }, 8000);
    deletion.current = { timer, commit };
  }
  function undoDelete() {
    if (!deletion.current) return;
    clearTimeout(deletion.current.timer);
    deletion.current = null;
    setRemoved(null);
  }
  return { removedId, removeTask, undoDelete };
}
