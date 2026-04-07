import type { IPlayerEpisode } from '@/types/videoPlayer';

// 公网稳定的测试视频（避免 gtv-videos-bucket 403）
const SAMPLE_MP4 = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4';

export type OfflineEpisodePageData = {
    title: string;
    serial: number;
    plot: string;
    episode: IPlayerEpisode;
    likeCount: number;
    collectCount: number;
    totalEpisodes: number;
    /** 当前集解锁价格（金币） */
    unlockPrice: number;
    /** 当前用户金币余额 */
    coinBalance: number;
};

const OFFLINE_EPISODES: Record<string, OfflineEpisodePageData> = {
    'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb': {
        title: '田園情緣',
        serial: 2,
        plot:
            '在《田園情緣》第二集中，娜塔莉的痛苦持續，他們試圖為自己的行為辯解。然而，反駁只會讓事情變得更糟，他們立刻把她趕了出去。茫然的她前往鄉間，去見她神秘的丈夫。就在這時，一輛拖拉機駛來，一名男子跳下。那是誰，他的意圖是什麼？',
        episode: {
            id: 2,
            episode: 2,
            // 你指定的 HLS(m3u8) 测试源
            video: 'https://v-mps.crazymaplestudios.com/vod-112094/20ad17f462f471f0bfa85114c0db0102/d4cb2380932d4708b88aafcba0f604be-5a5f8f7839d63e04a7051032c9dde3c0-hd.m3u8',
            subtitle: '',
            lock: false,
            unlock_coins: 12,
            can_unlock: false,
        },
        likeCount: 32,
        collectCount: 191,
        totalEpisodes: 98,
        unlockPrice: 12,
        coinBalance: 0,
    },
};

export function offlineEpisodePage(slug: string): OfflineEpisodePageData {
    // slug 可能是编码后的，也可能是已解码的；这里统一用 encodeURIComponent 做 key
    const encoded = slug.includes('%') ? slug : encodeURIComponent(slug);
    return (
        OFFLINE_EPISODES[encoded] ?? {
            title: '离线演示',
            serial: 1,
            plot: '离线模式：这里是 episodes 详情页的占位情节文案。接入接口后会显示真实内容。',
            episode: {
                id: 1,
                episode: 1,
                video: SAMPLE_MP4,
                subtitle: '',
                lock: false,
                unlock_coins: 0,
                can_unlock: false,
            },
            likeCount: 0,
            collectCount: 0,
            totalEpisodes: 50,
            unlockPrice: 0,
            coinBalance: 0,
        }
    );
}

