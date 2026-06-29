import type { QdFeedDemoItem } from '@/components/qd-feed-demo/types';
import { resolveVideoPosterUrl } from '@/components/video-player/videoPlayerShareUrl';
import { foryouFeedItemKey } from '@/pages/user/ForDemo/lib/foryouFeedMerge';
import { resolveFeedVideoUrl } from '@/pages/user/ForDemo/lib/foryouFeedMedia';
import type { IForYouFeedItem } from '@/types/foryouFeed';

/** foryou 列表 → QD Demo 条目（url/pic/id 对齐 QD video page 的 e.url / e.pic / e.id） */
export function mapForyouToQdFeedItems(
    rows: IForYouFeedItem[],
    staticBase: string,
): QdFeedDemoItem[] {
    const items: QdFeedDemoItem[] = [];
    for (const row of rows) {
        const url = resolveFeedVideoUrl(row, staticBase);
        if (!url) continue;
        items.push({
            id: foryouFeedItemKey(row),
            url,
            pic: resolveVideoPosterUrl(staticBase, { image: row.image, id: row.id, is_rename: row.is_rename }, row.id),
            num: row.episode ?? 1,
            subtitleUrlList: [],
        });
    }
    return items;
}
