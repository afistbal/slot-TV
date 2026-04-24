import type { TData } from '@/api';
import { create } from 'zustand';


export interface IItem {
    id: number,
    title: string,
    image: string,
    /** 新版 episodes 详情页 slug（优先用于跳转） */
    episodeSlug?: string,
    /** 播放量展示，对标镜像 `BookItem_playCount__klKNX` */
    views?: string,
    /** Continue Watching：当前集数 */
    currentEp?: number,
    /** Continue Watching：总集数 */
    totalEp?: number,
    /** Continue Watching：进度百分比（0-100） */
    progressPercent?: number,
    /** Continue Watching：显示播放遮罩 */
    showPlayMask?: boolean,
    /** 对齐镜像 DOM：是否渲染 data-report="expo" */
    showExpo?: boolean,
}

export interface IShelf {
    /** react-intl message id */
    titleMessageId: string,
    titleHref?: string,
    viewAllHref?: string,
    items: IItem[],
}

export interface IData {
    top: IItem[],
    recommend: IItem[],
    rank: IItem[],
    continueWatching?: IItem[],
    shelves?: IShelf[],
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
    setData: (data?: IData) => void,
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
    setData: (data?: IData) => set({ data }),
    setCurrent: (current: number) => set({current}),
}));