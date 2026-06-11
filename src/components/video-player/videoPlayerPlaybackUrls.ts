import { resolveStaticMediaUrl } from '@/lib/resolveStaticMediaUrl';
import type { IPlayerEpisode } from '@/types/videoPlayer';

/** 解析为绝对 URL 列表，供多条 `<source type="video/mp4">` 容灾（对齐 douyin `play_addr.url_list`） */
export function resolveEpisodePlaybackUrls(d: IPlayerEpisode, staticBase: string): string[] {
    const raw: string[] =
        Array.isArray(d.video_urls) && d.video_urls.length > 0
            ? d.video_urls.map((u) => String(u))
            : d.video != null && String(d.video).trim() !== ''
              ? [String(d.video)]
              : [];
    return raw
        .map((videoStr) => resolveStaticMediaUrl(String(videoStr), staticBase))
        .filter(Boolean);
}
