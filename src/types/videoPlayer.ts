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
    video: string;
    subtitle: string;
    lock: boolean;
    unlock_coins: number;
    can_unlock: boolean;
}
