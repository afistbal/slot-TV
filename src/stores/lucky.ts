import { create } from 'zustand';

type LuckyState = {
    badge: number | null;
    tasks: unknown | undefined;
    tasksSession: string;
    tasksUpdatedAt: number;
    progressError: string;
    revision: number;
    setBadge: (badge: number | null) => void;
    setTasks: (tasks: unknown, session: string, badge: number | null) => void;
    clearTasks: () => void;
    setProgressError: (message: string) => void;
    invalidate: () => void;
};
export const useLuckyStore = create<LuckyState>(set => ({
    badge: null, tasks: undefined, tasksSession: '', tasksUpdatedAt: 0, progressError: '', revision: 0,
    setBadge: badge => set({ badge }),
    setTasks: (tasks, tasksSession, badge) => set({ tasks, tasksSession, tasksUpdatedAt: Date.now(), badge }),
    clearTasks: () => set({ tasks: undefined, tasksSession: '', tasksUpdatedAt: 0, badge: null }),
    setProgressError: progressError => set({ progressError }),
    invalidate: () => set(state => ({ tasksUpdatedAt: 0, revision: state.revision + 1 })),
}));
