/**
 * `GET foryou` → `d.data[]`
 * 推荐池 + 普通池混排；单条含剧 id、推荐集 ep_id、成片 video/subtitle。
 */
export interface IForYouFeedTag {
    /** 接口 `source_tag_name`，用于 `movie?tag=` 筛选 */
    name: string;
    unique_id: string;
}

export interface IForYouFeedItem {
    id: number;
    /** 如 `recommend` / `n` / `a` / `b` 等混排槽位 */
    slot?: string[];
    title: string;
    image: string;
    introduction?: string;
    ep_id: number;
    /** 当前推荐集序号 */
    episode?: number;
    /** 总集数（接口字段 `total_episodes`） */
    episodes?: number;
    video: string;
    subtitle: string;
    tags: IForYouFeedTag[];
    is_favor?: boolean;
    favor?: number;
    /** @deprecated 兼容旧字段 */
    favorite?: number;
    is_favorite?: number;
}

export interface IForYouListPayload {
    data: IForYouFeedItem[];
    count: number;
    current_page?: number;
    per_page?: number;
    has_more?: boolean;
}
