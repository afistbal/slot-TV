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
    /** 须从 1 开始：触底时 setPage(page+1) 若为 0→1 会走「重置」分支清空列表并 scrollTop=0，导致滚到底突然跳回顶并重复请求 page=1 */
    page: 1,
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
