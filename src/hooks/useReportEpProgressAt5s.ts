import { useEffect, useRef } from 'react';
import type Player from 'xgplayer';

import { getFeedPlayerById } from '@/components/douyin-feed-player';
import { getPlayerCurrentTime } from '@/components/douyin-feed-player/controls/playerControlsApi';
import { reportMovieEpProgress, saveMovieEpProgress } from '@/lib/reportMovieEpProgress';
import { touchLuckyWatchStreak } from '@/api/lucky';
import { useLuckyStore } from '@/stores/lucky';
import { skipRemoteApi } from '@/env';

const REPORT_THRESHOLD_SEC = 5;
const WATCH_STREAK_THRESHOLD_SEC = 3;
const MAX_ATTACH_ATTEMPTS = 300;
const currentLocalDay = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

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
        let lastSavedAt = 0;
        let lastStreakAt = 0;
        let streakDoneDay = '';
        let saving = false;
        let claimingStreak = false;
        let attachedPlayer: Player | null = null;

        const claimWatchStreak = async (player: Player) => {
            if (skipRemoteApi || claimingStreak || disposed) return;
            const currentTime = getPlayerCurrentTime(player);
            const today = currentLocalDay();
            const now = Date.now();
            if (currentTime < WATCH_STREAK_THRESHOLD_SEC || streakDoneDay === today || now - lastStreakAt < 5000) return;
            claimingStreak = true;
            lastStreakAt = now;
            try {
                // 到达门槛立即请求奖励，不让观看进度保存结果阻断 coin。
                const result = await touchLuckyWatchStreak();
                if (!result.pending) streakDoneDay = today;
                useLuckyStore.getState().setProgressError('');
            } catch (reason) {
                useLuckyStore.getState().setProgressError(reason instanceof Error ? reason.message : String(reason));
            } finally {
                claimingStreak = false;
            }
        };

        const saveForRewards = async (player: Player, final = false) => {
            if (skipRemoteApi || saving || disposed && !final) return;
            const currentTime = getPlayerCurrentTime(player);
            const now = Date.now();
            if (currentTime < WATCH_STREAK_THRESHOLD_SEC || !final && now - lastSavedAt < 60000) return;
            saving = true; lastSavedAt = now;
            try {
                await saveMovieEpProgress({ movie_id: movieId, ep_id: epId, ep_no: epNo, duration: Math.floor(currentTime), completed: false });
                useLuckyStore.getState().setProgressError('');
            } catch (reason) {
                useLuckyStore.getState().setProgressError(reason instanceof Error ? reason.message : String(reason));
            } finally { saving = false; }
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
            reportMovieEpProgress({
                movie_id: movieId,
                ep_id: epId,
                ep_no: epNo,
                duration: Math.floor(currentTime),
                completed: false,
            });
        };

        const attach = (player: Player) => {
            attachedPlayer = player;
            const onTime = () => {
                maybeReport(player);
                if (getPlayerCurrentTime(player) >= WATCH_STREAK_THRESHOLD_SEC) {
                    void claimWatchStreak(player);
                    void saveForRewards(player);
                }
            };
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
                void claimWatchStreak(attachedPlayer);
                void saveForRewards(attachedPlayer, true);
            }
        };
        document.addEventListener('visibilitychange', onHidden);

        return () => {
            disposed = true;
            document.removeEventListener('visibilitychange', onHidden);
            if (attachedPlayer) void saveForRewards(attachedPlayer, true);
            cancelAnimationFrame(rafId);
            detach?.();
        };
    }, [movieId, epId, epNo, playerItemId, enabled]);
}
