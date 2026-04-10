import type { TData } from '@/api';

/** /my-list/history 观看历史（仅 skipRemoteApi 等离线场景） */
export const offlineHistoryList: TData[] = [
    { id: 2001, movie_id: 9002, image: '1015/400/600', title: '海上黎明', episodes: 20, is_favorite: 1 },
    { id: 2002, movie_id: 9003, image: '1025/400/600', title: '星空下的约定', episodes: 10, is_favorite: 0 },
    { id: 2003, movie_id: 9021, image: '1038/400/600', title: '头号焦点', episodes: 18, is_favorite: 1 },
    { id: 2004, movie_id: 9105, image: '1049/300/450', title: '无声告白', episodes: 6, is_favorite: 0 },
];
