import type { TData } from '@/api';
import { create } from 'zustand';

interface ISearch {
    loading: boolean;
    list: TData[];
    page: number;
    more: boolean;
    /** movie 接口返回的总条数（分页用） */
    totalCount: number;
    perPage: number;
    listScopeKey: string;
    scrollTop: number;
    keyword: string;
    tag: string;
    tags: TData[];
    categories: TData[];
    categoryId: string;
    setLoading: (loading: boolean) => void;
    setList: (list: TData[]) => void;
    setPage: (page: number) => void;
    setMore: (more: boolean) => void;
    setPaginationMeta: (totalCount: number, perPage: number) => void;
    setListScopeKey: (listScopeKey: string) => void;
    setScrollTop: (scrollTop: number) => void;
    setKeyword: (keyword: string) => void;
    setTag: (tag: string) => void;
    setTags: (tags: TData[]) => void;
    setCategories: (categories: TData[]) => void;
    setCategoryId: (categoryId: string) => void;
    setCategoryResults: (payload: {
        categoryId: string;
        tags: TData[];
        list: TData[];
        totalCount: number;
        perPage: number;
        more: boolean;
        listScopeKey: string;
    }) => void;
}

export const useSearchStore = create<ISearch>((set) => ({
    loading: true,
    list: [],
    /** 须从 1 开始：触底时 setPage(page+1) 若为 0→1 会走「重置」分支清空列表并 scrollTop=0，导致滚到底突然跳回顶并重复请求 page=1 */
    page: 1,
    more: true,
    totalCount: 0,
    perPage: 24,
    listScopeKey: '',
    scrollTop: 0,
    keyword: '',
    tag: '',
    tags: [],
    categories: [],
    categoryId: '',
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
    setPaginationMeta: (totalCount: number, perPage: number) =>
        set({ totalCount, perPage: perPage > 0 ? perPage : 24 }),
    setListScopeKey: (listScopeKey: string) => set({ listScopeKey }),
    setScrollTop: (scrollTop: number) => set({ scrollTop }),
    setKeyword: (keyword: string) => set({ keyword }),
    setTag: (tag: string) => set({ tag }),
    setTags: (tags: TData[]) => set({ tags }),
    setCategories: (categories: TData[]) => set({ categories }),
    setCategoryId: (categoryId: string) => set({ categoryId }),
    setCategoryResults: (payload) =>
        set({
            categoryId: payload.categoryId,
            tags: payload.tags,
            tag: '',
            keyword: '',
            page: 1,
            list: payload.list,
            totalCount: payload.totalCount,
            perPage: payload.perPage > 0 ? payload.perPage : 24,
            more: payload.more,
            listScopeKey: payload.listScopeKey,
            loading: false,
            scrollTop: 0,
        }),
}));
