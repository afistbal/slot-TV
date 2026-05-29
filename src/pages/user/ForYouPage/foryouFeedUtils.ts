import type { IForYouFeedItem } from '@/types/foryouFeed';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';

export function buildPlayerDataFromFeedItem(item: IForYouFeedItem): IPlayerData {
    const epNo = item.episode ?? 1;
    const favor = item.favor ?? item.favorite ?? 0;
    const isFavor = item.is_favor === true || item.is_favorite === 1;
    return {
        info: {
            id: item.id,
            title: item.title,
            image: item.image,
            favorite: favor,
            is_favorite: isFavor ? 1 : 0,
            introduction: item.introduction ?? '',
        },
        tags: item.tags.map((t) => ({
            name: t.name,
            unique_id: t.unique_id,
        })),
        episodes: [
            {
                id: item.ep_id,
                episode: epNo,
                vip: 0,
                locked: 0,
            },
        ],
    };
}

export function buildEpisodeFromFeedItem(item: IForYouFeedItem): IPlayerEpisode {
    return {
        id: item.ep_id,
        episode: item.episode ?? 1,
        video: item.video,
        subtitle: item.subtitle ?? '',
        lock: false,
        unlock_coins: 0,
        can_unlock: false,
    };
}
