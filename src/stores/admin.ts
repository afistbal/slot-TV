import type { TData } from '@/api';
import { create } from 'zustand'

interface IPagenation {
    loading: boolean,
    list: TData[],
    page: number,
    keyword: string,
    more: boolean,
    total: number,
    scrollTop: number,
    setLoading: (loading: boolean) => void,
    setList: (list: TData[]) => void,
    setPage: (page: number) => void,
    setKeyword: (keyword: string) => void,
    setMore: (more: boolean) => void,
    setTotal: (total: number) => void,
    setScrollTop: (scrollTop: number) => void,
}

export const useMovieListStore = create<IPagenation & { language: string, setLanguage: (language: string) => void }>((set) => ({
    loading: true,
    list: [],
    language: 'en',
    page: 0,
    keyword: '',
    more: true,
    total: 0,
    scrollTop: 0,
    setLoading: (loading) => set({ loading }),
    setList: (list) => set({ list }),
    setLanguage: (language: string) => set({ language, loading: true, page: 0, total: 0, more: true, list: [], scrollTop: 0, }),
    setPage: (page) => set({ page }),
    setKeyword: (keyword) => {
        set({ keyword, loading: true, page: 0, total: 0, more: true, list: [], scrollTop: 0, });
    },
    setMore: (more) => set({ more }),
    setTotal: (total) => set({ total }),
    setScrollTop: (scrollTop) => set({ scrollTop }),
}));

export const useUserListStore = create<IPagenation & { type: number, setType: (type: number) => void }>((set) => ({
    loading: true,
    list: [],
    type: 0,
    page: 0,
    keyword: '',
    more: true,
    total: 0,
    scrollTop: 0,
    setLoading: (loading) => set({ loading }),
    setList: (list) => set({ list }),
    setType: (type: number) => set({ type, loading: true, page: 0, total: 0, more: true, scrollTop: 0, list: [] }),
    setPage: (page) => set({ page }),
    setKeyword: (keyword) => {
        set({ keyword, loading: true, page: 0, total: 0, more: true, scrollTop: 0, list: [] });
    },
    setMore: (more) => set({ more }),
    setTotal: (total) => set({ total }),
    setScrollTop: (scrollTop) => set({ scrollTop }),
}));


export const useOrderListStore = create<IPagenation>((set) => ({
    loading: true,
    list: [],
    page: 0,
    keyword: '',
    more: true,
    total: 0,
    scrollTop: 0,
    setLoading: (loading) => set({ loading }),
    setList: (list) => set({ list }),
    setPage: (page) => set({ page }),
    setKeyword: (keyword) => {
        set({ keyword, loading: true, page: 0, more: true, list: [] });
    },
    setMore: (more) => set({ more }),
    setTotal: (total) => set({ total }),
    setScrollTop: (scrollTop) => set({ scrollTop }),
}));