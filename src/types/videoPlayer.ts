export interface IPlayerData {
    info: {
        id: number;
        title: string;
        image: string;
        favorite: number;
        is_favorite: number;
        introduction: string;
    };
    tags: {
        name: string;
        unique_id: string;
    }[];
    episodes: {
        id: number;
        episode: number;
        vip: number;
        locked: number;
    }[];
}

export interface IPlayerEpisode {
    id: number;
    episode: number;
    /** 单地址（兼容旧接口） */
    video: string;
    /** 多 CDN / 多线路，与 douyin `play_addr.url_list` 一致；优先于 `video` */
    video_urls?: string[];
    subtitle: string;
    lock: boolean;
    unlock_coins: number;
    can_unlock: boolean;
}
