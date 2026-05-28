/**
 * `GET foryou` → `d.data[]`
 * 推荐池 + 普通池混排；单条含剧 id、推荐集 ep_id、成片 video/subtitle。
 */
export interface IForYouFeedItem {
    id: number;
    /** 如 `recommend` / `n` / `a` / `b` 等混排槽位 */
    slot?: string[];
    title: string;
    image: string;
    ep_id: number;
    video: string;
    subtitle: string;
    tags: string[];
    is_favor?: boolean;
    favor?: number;
    /** 当前推荐集序号（`GET foryou` 返回） */
    episode?: number;
    /** 总集数（`GET foryou` 返回） */
    episodes?: number;
    introduction?: string;
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
