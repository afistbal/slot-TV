import { useDramaEngagement } from '@/hooks/useDramaEngagement';
import type { IForYouFeedItem } from '@/types/foryouFeed';

export function useForDemoEngagement(feedItem: IForYouFeedItem) {
    return useDramaEngagement({
        dramaId: feedItem.id,
        initialLiked: feedItem.is_like === true,
        initialLikeCount: feedItem.like,
    });
}
