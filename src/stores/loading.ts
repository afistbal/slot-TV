import { create } from 'zustand'

interface ILoading {
  status: boolean,
  show: () => void,
  hide: () => void,
}

export const useLoadingStore = create<ILoading>((set) => ({
  status: false,
  show: () => set({ status: true }),
  hide: () => set({ status: false }),
}));