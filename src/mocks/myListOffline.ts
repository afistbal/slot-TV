import type { TData } from '@/api';

/** /my-list 收藏 — 与首页假数据 id 可对上 */
export const offlineFavoriteList: TData[] = [
    { id: 1001, movie_id: 9001, image: '1011/400/600', title: '都市边缘', episodes: 12 },
    { id: 1002, movie_id: 9011, image: '1033/400/600', title: '极速追击', episodes: 24 },
    { id: 1003, movie_id: 9012, image: '1035/400/600', title: '午夜档案', episodes: 8 },
    { id: 1004, movie_id: 9101, image: '1044/300/450', title: '旧时光咖啡馆', episodes: 16 },
];

/** /my-list/history 观看历史 */
export const offlineHistoryList: TData[] = [
    { id: 2001, movie_id: 9002, image: '1015/400/600', title: '海上黎明', episodes: 20, is_favorite: 1 },
    { id: 2002, movie_id: 9003, image: '1025/400/600', title: '星空下的约定', episodes: 10, is_favorite: 0 },
    { id: 2003, movie_id: 9021, image: '1038/400/600', title: '头号焦点', episodes: 18, is_favorite: 1 },
    { id: 2004, movie_id: 9105, image: '1049/300/450', title: '无声告白', episodes: 6, is_favorite: 0 },
];
