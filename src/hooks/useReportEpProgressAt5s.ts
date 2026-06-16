import { useEffect, useRef } from 'react';
import type Player from 'xgplayer';

import { getFeedPlayerById } from '@/components/douyin-feed-player';
import { getPlayerCurrentTime } from '@/components/douyin-feed-player/controls/playerControlsApi';
import { reportMovieEpProgress } from '@/lib/reportMovieEpProgress';

const REPORT_THRESHOLD_SEC = 5;
const MAX_ATTACH_ATTEMPTS = 300;

export function useReportEpProgressAt5s(options: {
    movieId: number;
    epId: number;
    epNo: number;
    playerItemId: string | number;
    enabled?: boolean;
}): void {
    const { movieId, epId, epNo, playerItemId, enabled = true } = options;
    const reportedRef = useRef(false);

    useEffect(() => {
        reportedRef.current = false;
    }, [movieId, epId, playerItemId]);

    useEffect(() => {
        if (!enabled || !movieId || !epId) {
            return;
        }

        let disposed = false;
        let detach: (() => void) | null = null;
        let rafId = 0;
        let attempts = 0;

        const maybeReport = (player: Player) => {
            if (reportedRef.current || disposed) {
                return;
            }
            const currentTime = getPlayerCurrentTime(player);
            if (currentTime < REPORT_THRESHOLD_SEC) {
                return;
            }
            reportedRef.current = true;
            reportMovieEpProgress({
                movie_id: movieId,
                ep_id: epId,
                ep_no: epNo,
                duration: Math.floor(currentTime),
                completed: false,
            });
        };

        const attach = (player: Player) => {
            const onTime = () => maybeReport(player);
            player.on('timeupdate', onTime);
            detach = () => player.off('timeupdate', onTime);
            maybeReport(player);
        };

        const tryAttach = () => {
            if (disposed || reportedRef.current) {
                return;
            }
            const player = getFeedPlayerById(playerItemId);
            if (!player) {
                if (attempts < MAX_ATTACH_ATTEMPTS) {
                    attempts += 1;
                    rafId = requestAnimationFrame(tryAttach);
                }
                return;
            }
            attach(player);
        };

        tryAttach();

        return () => {
            disposed = true;
            cancelAnimationFrame(rafId);
            detach?.();
        };
    }, [movieId, epId, epNo, playerItemId, enabled]);
}
