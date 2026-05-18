import { SHORTS_DEMO_VIDEOS, type ShortsDemoVideoItem } from '../constants/shortsDemoVideos';

/** douyin `buildHomeShortsDemoAweme` 精简版：只保留 BaseVideo 消费字段 */
export type DemoAwemeItem = {
    type: 'recommend-video';
    aweme_id: string;
    desc: string;
    video: {
        play_addr: { url_list: string[] };
        cover: { url_list: string[] };
        poster?: string;
        duration?: number;
    };
};

function buildHomeShortsDemoAweme(demo: ShortsDemoVideoItem): DemoAwemeItem {
    const coverUrl = `https://picsum.photos/seed/yogo${demo.id}/720/1280.jpg`;
    return {
        type: 'recommend-video',
        aweme_id: `shorts-demo-${demo.id}`,
        desc: demo.title ?? `Short demo #${demo.id}`,
        video: {
            play_addr: { url_list: [demo.url] },
            cover: { url_list: [coverUrl] },
            poster: coverUrl,
        },
    };
}

export const DEMO_AWEME_FEED: DemoAwemeItem[] = SHORTS_DEMO_VIDEOS.map(buildHomeShortsDemoAweme);
