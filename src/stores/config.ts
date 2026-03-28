import { create } from 'zustand'

type IConfigObject = { [key: string]: unknown };

export interface IConfig {
    config: IConfigObject,
    setConfig: (config: IConfigObject) => void,
}

export const useConfigStore = create<IConfig>((set) => ({
    config: {},
    setConfig: (config) => set({ config }),
}));