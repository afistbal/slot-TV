import type { QdFeedDemoItem } from '@/components/qd-feed-demo/types';

/** 公开测试 MP4 — 仅 Demo 用 */
const SAMPLES = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
] as const;

const POSTER =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg';

export const qdFeedDemoItems: QdFeedDemoItem[] = SAMPLES.map((url, i) => ({
    id: String(9001 + i),
    url,
    pic: POSTER,
    num: i + 1,
    subtitleUrlList: [],
}));
