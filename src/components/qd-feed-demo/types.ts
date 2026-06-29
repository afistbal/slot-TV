/** Demo 列表项 — 字段对齐 QD video page 的 e$ 条目（url / id / pic） */
export type QdFeedDemoItem = {
    id: string;
    url: string;
    pic: string;
    num: number;
    /** QD: subtitleUrlList，Demo 可为空 */
    subtitleUrlList?: Array<{
        id: string;
        subtitleUrl: string;
        languageCode: string;
    }>;
};

export type QdVerticalFeedHandle = {
    /** QD: 9085 L503 scrollTo */
    scrollTo: (index: number) => void;
    /** QD: 9085 L508 scrollToNoAnimation */
    scrollToNoAnimation: (index: number) => void;
};
