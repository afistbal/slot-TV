import type { TData } from '@/api';
import { create } from 'zustand';


interface IItem {
    id: number,
    title: string,
    image: string,
}

export interface IData {
    top: IItem[],
    recommend: IItem[],
    rank: IItem[],
}

interface IHome {
    loading: boolean,
    list: TData[],
    page: number,
    more: boolean,
    scrollTop: number,
    data?: IData,
    current: number,
    setLoading: (loading: boolean) => void,
    setList: (list: TData[]) => void,
    setPage: (page: number) => void,
    setMore: (more: boolean) => void,
    setScrollTop: (scrollTop: number) => void,
    setData: (data: IData) => void,
    setCurrent: (current: number) => void,
}

export const useHomeStore = create<IHome>((set) => ({
    loading: true,
    list: [],
    page: 0,
    more: true,
    scrollTop: 0,
    data: undefined,
    carousel: undefined,
    current: 0,
    setLoading: (loading: boolean) => set({ loading }),
    setList: (list: TData[]) => set({ list }),
    setPage: (page: number) => set({ page }),
    setMore: (more: boolean) => set({ more }),
    setScrollTop: (scrollTop: number) => set({ scrollTop }),
    setData: (data: IData) => set({data}),
    setCurrent: (current: number) => set({current}),
}));