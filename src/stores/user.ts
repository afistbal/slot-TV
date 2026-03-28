import { create } from 'zustand'

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
  setBalance: (balance) => set({ balance }),
  signin: (info) => set({ signed: true, info }),
  signout: () => set({ signed: false, info: undefined }),
  update: (info) => set({ info: { ...get().info, ...info } }),
  isAnonymous: () => {
    const data = get();
    return data.signed && data.info!['anonymous'] === 1
  },
  isVIP: () => get().signed && get().info!['is_vip'] as boolean,
  isAdmin: () => get().signed && get().info!['admin'] as number > 0,
}));