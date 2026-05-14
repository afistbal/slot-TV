import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useEpisodeFrameQueueStore } from './episodeFrameQueueStore';

type Ep = { id: number; episode: number };

/**
 * 叠在竖滑容器内、**标题栏（h-16）下方**：按剧集顺序展示**已入队**的首帧（`framesById` 有多少格展示多少格，不铺全剧）。
 */
export function EpisodeFrameQueueOverlay({
    episodes,
    activeListIndex,
}: {
    episodes: Ep[];
    activeListIndex: number;
}) {
    const framesById = useEpisodeFrameQueueStore((s) => s.framesById);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    /** 仅保留本剧且在 store 里已有首帧的集，顺序与正片列表一致 */
    const queuedEpisodes = useMemo(
        () => episodes.filter((e) => Boolean(framesById[e.id])),
        [episodes, framesById],
    );

    useEffect(() => {
        const row = episodes[activeListIndex];
        if (!row || !framesById[row.id]) {
            return;
        }
        const el = itemRefs.current.get(row.id);
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [activeListIndex, episodes, framesById]);

    if (episodes.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'pointer-events-none absolute right-0 top-16 z-[50] flex justify-center px-2',
                /** 与 PC 视频区左上角 `.video-player-pc-close-btn` 错开，避免内层 `pointer-events-auto` 条盖住返回 */
                'left-[88px]',
            )}
            aria-hidden
        >
            <div
                className={cn(
                    /** 整块卡片勿 `pointer-events-auto`，否则半透明区会盖住下层「取消静音」等；仅缩略图横条可点 */
                    'pointer-events-none max-w-[min(100%,28rem)] rounded-lg border border-white/15',
                    'bg-black/75 px-2 py-1.5 shadow-lg backdrop-blur-sm',
                )}
            >
                <div className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-white/50">
                    首帧队列（{queuedEpisodes.length}）
                    <span className="mt-0.5 block normal-case text-[9px] text-white/35">
                        仅展示已入队首帧；滑集播放成功即入队（跨域无 CORS 时无法截）
                    </span>
                </div>
                <div
                    className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto overflow-y-hidden py-0.5 [scrollbar-width:thin]"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {queuedEpisodes.length === 0 ? (
                        <div className="min-h-14 min-w-[8rem] px-2 py-2 text-center text-[10px] leading-snug text-white/40">
                            队列为空，播放某一集并截帧成功后将出现在此
                        </div>
                    ) : (
                        queuedEpisodes.map((row) => {
                            const src = framesById[row.id];
                            const isActive = row.id === episodes[activeListIndex]?.id;
                            if (!src) {
                                return null;
                            }
                            return (
                                <div
                                    key={row.id}
                                    ref={(node) => {
                                        if (node) {
                                            itemRefs.current.set(row.id, node);
                                        } else {
                                            itemRefs.current.delete(row.id);
                                        }
                                    }}
                                    className={cn(
                                        'flex w-11 shrink-0 flex-col items-center gap-0.5 rounded border transition-colors',
                                        isActive
                                            ? 'border-amber-400/90 bg-white/10'
                                            : 'border-white/15 bg-black/40',
                                    )}
                                >
                                    <div className="relative h-14 w-full overflow-hidden rounded-t bg-black/80">
                                        <img
                                            src={src}
                                            alt=""
                                            className="h-full w-full object-cover"
                                            draggable={false}
                                        />
                                    </div>
                                    <span className="pb-0.5 text-[9px] leading-none font-medium text-white/80">
                                        {row.episode}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
