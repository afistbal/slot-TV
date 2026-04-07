import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';

/** 与 config.static 拼接封面，与首页离线 mock 一致 */
const POSTER = '1060/720/960';

const SAMPLE_MP4 =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

/** 任意 `/video/:id` 共用的详情假数据（不随 id 变化） */
export const offlinePlayerData: IPlayerData = {
    info: {
        id: 1,
        title: '离线演示 · 大屏预览',
        image: POSTER,
        favorite: 128,
        is_favorite: 0,
        introduction:
            '这是无后端环境下的占位文案。接入接口后将显示真实简介。示例视频来自公开测试源，仅用于本地开发与演示。',
    },
    tags: [
        { name: '剧情', unique_id: 'drama' },
        { name: '完结', unique_id: 'done' },
    ],
    episodes: [
        { id: 9201, episode: 1, vip: 0, locked: 0 },
        { id: 9202, episode: 2, vip: 0, locked: 0 },
        { id: 9203, episode: 3, vip: 0, locked: 0 },
    ],
};

export function offlinePlayerEpisode(episodeRowId: number): IPlayerEpisode {
    const row = offlinePlayerData.episodes.find((e) => e.id === episodeRowId);
    const num = row?.episode ?? 1;
    return {
        id: episodeRowId,
        episode: num,
        video: SAMPLE_MP4,
        subtitle: '',
        lock: false,
        unlock_coins: 0,
        can_unlock: false,
    };
}
