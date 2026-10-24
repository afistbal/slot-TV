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
        let attachedPlayer: Player | null = null;
        let lastReportedDuration = -1;

        const reportCurrentProgress = (player: Player, allowBeforeThreshold = false) => {
            const currentTime = getPlayerCurrentTime(player);
            if (!Number.isFinite(currentTime) || currentTime <= 0) return;
            if (!allowBeforeThreshold && currentTime < REPORT_THRESHOLD_SEC) return;

            const duration = Math.floor(currentTime);
            if (duration === lastReportedDuration) return;
            lastReportedDuration = duration;
            reportMovieEpProgress({
                movie_id: movieId,
                ep_id: epId,
                ep_no: epNo,
                duration,
                completed: false,
            });
        };

        const maybeReport = (player: Player) => {
            if (reportedRef.current || disposed) {
                return;
            }
            const currentTime = getPlayerCurrentTime(player);
            if (currentTime < REPORT_THRESHOLD_SEC) {
                return;
            }
            reportedRef.current = true;
            reportCurrentProgress(player);
        };

        const attach = (player: Player) => {
            attachedPlayer = player;
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
        const onHidden = () => {
            if (document.visibilityState === 'hidden' && attachedPlayer) {
                reportCurrentProgress(attachedPlayer, true);
            }
        };
        document.addEventListener('visibilitychange', onHidden);

        return () => {
            document.removeEventListener('visibilitychange', onHidden);
            if (attachedPlayer) {
                reportCurrentProgress(attachedPlayer, true);
            }
            disposed = true;
            cancelAnimationFrame(rafId);
            detach?.();
        };
    }, [movieId, epId, epNo, playerItemId, enabled]);
}
