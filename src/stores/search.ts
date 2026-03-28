import type { TData } from '@/api';
import { create } from 'zustand';

interface ISearch {
    loading: boolean;
    list: TData[];
    page: number;
    more: boolean;
    scrollTop: number;
    keyword: string;
    tag: string;
    tags: TData[];
    setLoading: (loading: boolean) => void;
    setList: (list: TData[]) => void;
    setPage: (page: number) => void;
    setMore: (more: boolean) => void;
    setScrollTop: (scrollTop: number) => void;
    setKeyword: (keyword: string) => void;
    setTag: (tag: string) => void;
    setTags: (tags: TData[]) => void;
}

export const useSearchStore = create<ISearch>((set) => ({
    loading: true,
    list: [],
    page: 0,
    more: true,
    scrollTop: 0,
    keyword: '',
    tag: '',
    tags: [],
    setLoading: (loading: boolean) => set({ loading }),
    setList: (list: TData[]) => set({ list }),
    setPage: (page: number) => {
        if (page === 1) {
            set({ page, list: [], more: true, loading: true, scrollTop: 0, });
        } else {
            set({ page });
        }
    },
    setMore: (more: boolean) => set({ more }),
    setScrollTop: (scrollTop: number) => set({ scrollTop }),
    setKeyword: (keyword: string) => set({ keyword }),
    setTag: (tag: string) => set({ tag }),
    setTags: (tags: TData[]) => set({ tags }),
}));
