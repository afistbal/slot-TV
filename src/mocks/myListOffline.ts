import type { TData } from '@/api';

/** /my-list/history 观看历史（skipRemoteApi 或开发环境接口为空时兜底） */
export const offlineHistoryList: TData[] = [
    { id: 2001, movie_id: 9002, image: '1015/400/600', title: '海上黎明', episodes: 20, is_favorite: 1 },
    { id: 2002, movie_id: 9003, image: '1025/400/600', title: '星空下的约定', episodes: 10, is_favorite: 0 },
    { id: 2003, movie_id: 9021, image: '1038/400/600', title: '头号焦点', episodes: 18, is_favorite: 1 },
    { id: 2004, movie_id: 9105, image: '1049/300/450', title: '无声告白', episodes: 6, is_favorite: 0 },
];

/** /my-list 收藏列表（skipRemoteApi 或开发环境接口为空时兜底） */
export const offlineFavoriteList: TData[] = [
    { id: 3001, movie_id: 8001, image: '1015/400/600', title: '都市迷情', episodes: 24, is_favorite: 1 },
    { id: 3002, movie_id: 8002, image: '1025/400/600', title: '逆风重逢', episodes: 12, is_favorite: 1 },
    { id: 3003, movie_id: 8003, image: '1038/400/600', title: '假面恋人', episodes: 16, is_favorite: 1 },
];
