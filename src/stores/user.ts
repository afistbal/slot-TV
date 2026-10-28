import { create } from 'zustand'

import { getClientIsAnonymous } from '@/lib/clientIsAnonymous';

interface IUser {
  signed: boolean,
  info?: { [key: string]: unknown },
  balance: number,
  setBalance: (balance: number) => void,
  signin: (info: { [key: string]: unknown }) => void,
  signout: () => void,
  update: (info: { [key: string]: unknown }) => void,
  isAnonymous: () => boolean,
  isVIP: () => boolean,
  isAdmin: () => boolean,
}

export const useUserStore = create<IUser>((set, get) => ({
  signed: false,
  balance: -1,
  setBalance: (balance) => set({ balance: balance != null && String(balance).trim() !== '' && Number.isFinite(Number(balance)) ? Number(balance) : -1 }),
  signin: (info) => set((state) => ({ signed: true, info, balance: !state.signed || state.info?.id !== info.id ? -1 : state.balance })),
  signout: () => set({ signed: false, info: undefined, balance: -1 }),
  update: (info) => set({ info: { ...get().info, ...info } }),
  isAnonymous: () => get().signed && getClientIsAnonymous() === 1,
  isVIP: () => get().signed && get().info!['is_vip'] as boolean,
  isAdmin: () => get().signed && get().info!['admin'] as number > 0,
}));
