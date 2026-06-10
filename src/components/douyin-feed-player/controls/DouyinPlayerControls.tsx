import { useEffect, useRef, type MouseEvent, type ReactNode, type TouchEvent } from 'react';
import { Minimize, Volume2, VolumeX } from 'lucide-react';
import type Player from 'xgplayer';

import nextEpisodeIcon from '@/assets/images/12164930-c692-11ef-a2d6-41216ff1602c.png';
import fullscreenIcon from '@/assets/video/icon_full@2x.png';
import { cn } from '@/lib/utils';

import '@/styles/video-vertical.scss';

import { useDouyinPlayerControlState } from './useDouyinPlayerControlState';

import './douyin-player-controls.scss';

type DouyinPlayerControlsProps = {
    player: Player | null;
    className?: string;
    showNextEpisode?: boolean;
    onNextEpisode?: () => void;
    /** info / Watch Full 等，拼在进度条之上（与 foryou 同一底栏容器） */
    topContent?: ReactNode;
    /** for-demo / For You：固定 1.0x，隐藏倍速按钮 */
    fixedPlaybackSpeed?: boolean;
};

function stopBubble(event: MouseEvent | TouchEvent) {
    event.stopPropagation();
}

export function DouyinPlayerControls({
    player,
    className,
    showNextEpisode = false,
    onNextEpisode,
    topContent,
    fixedPlaybackSpeed = false,
}: DouyinPlayerControlsProps) {
    const ctl = useDouyinPlayerControlState(player, { fixedPlaybackSpeed });
    const feedBottomLayout = Boolean(topContent);
    const progressScrubRef = useRef<HTMLDivElement | null>(null);

    const seekFromClientX = (clientX: number, rect: DOMRect) => {
        if (!rect.width) return;
        const ratio = (clientX - rect.left) / rect.width;
        ctl.onSeekRatio(Math.min(Math.max(ratio, 0), 1));
    };

    const seekFromScrubPointer = (clientX: number) => {
        const el = progressScrubRef.current;
        if (!el) return;
        seekFromClientX(clientX, el.getBoundingClientRect());
    };

    useEffect(() => {
        if (!ctl.progressDragging) return;

        const onMouseMove = (event: globalThis.MouseEvent) => {
            seekFromScrubPointer(event.clientX);
        };
        const onMouseUp = () => {
            ctl.setProgressDragging(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [ctl.progressDragging, ctl.onSeekRatio, ctl.setProgressDragging]);

    return (
        <div
            className={cn('douyin-player-controls video-player-root', className)}
            onClick={stopBubble}
            onTouchStart={stopBubble}
            onTouchEnd={stopBubble}
            onPointerDown={stopBubble}
            onPointerUp={stopBubble}
            onMouseDown={stopBubble}
        >
            <div
                className={cn(
                    'video-player-h5-bottom w-full',
                    !feedBottomLayout && 'video-player-h5-bottom--fullscreen',
                )}
            >
                {topContent}
                <div className="video-player-h5-progress-row">
                    <div
                        ref={progressScrubRef}
                        className="video-player-progress-scrub video-player-h5-progress-track-wrap swiper-no-swiping flex-1 flex items-center justify-center min-w-0"
                        data-vertical-swipe-ignore
                        onMouseDown={(e) => {
                            stopBubble(e);
                            ctl.setProgressDragging(true);
                            seekFromScrubPointer(e.clientX);
                        }}
                        onMouseEnter={() => ctl.setProgressHover(true)}
                        onMouseLeave={() => {
                            if (!ctl.progressDragging) {
                                ctl.setProgressHover(false);
                            }
                        }}
                        onTouchStart={(e) => {
                            stopBubble(e);
                            const touch = e.touches[0];
                            if (!touch) return;
                            ctl.setProgressDragging(true);
                            seekFromClientX(touch.clientX, e.currentTarget.getBoundingClientRect());
                        }}
                        onTouchMove={(e) => {
                            const touch = e.touches[0];
                            if (!touch || !ctl.progressDragging) return;
                            seekFromClientX(touch.clientX, e.currentTarget.getBoundingClientRect());
                        }}
                        onTouchEnd={() => ctl.setProgressDragging(false)}
                    >
                        <div className="video-player-progress-track w-full h-1 bg-white/50 rounded-full overflow-visible">
                            <div
                                className="bg-white/80 h-1 rounded-full relative"
                                style={{ width: `${ctl.progressRatio * 100}%` }}
                            >
                                <span
                                    className={cn(
                                        'video-player-progress-thumb',
                                        (ctl.progressHover || ctl.progressDragging) &&
                                            'video-player-progress-thumb--visible',
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="video-player-h5-toolbar">
                    <div className="video-player-h5-time">
                        {ctl.currentLabel} / {ctl.durationLabel}
                    </div>
                    <div className="video-player-h5-toolbar-actions">
                        {!fixedPlaybackSpeed ? (
                            <div
                                className="video-player-h5-speed"
                                onClick={(e) => {
                                    stopBubble(e);
                                    ctl.onCycleSpeed();
                                }}
                            >
                                {ctl.speedLabel}
                            </div>
                        ) : null}
                        <button
                            type="button"
                            data-vertical-swipe-ignore
                            className="video-player-h5-mute shrink-0 flex items-center justify-center border-0 bg-transparent p-0 text-white cursor-pointer"
                            onClick={(e) => {
                                stopBubble(e);
                                ctl.onToggleMute();
                            }}
                            aria-label={ctl.muted ? 'Unmute' : 'Mute'}
                        >
                            {ctl.muted ? (
                                <VolumeX className="w-5 h-5" aria-hidden />
                            ) : (
                                <Volume2 className="w-5 h-5" aria-hidden />
                            )}
                        </button>
                        {showNextEpisode ? (
                            <div
                                className="video-player-next-episode-trigger video-player-h5-next text-white flex items-center justify-center cursor-pointer"
                                onClick={(e) => {
                                    stopBubble(e);
                                    onNextEpisode?.();
                                }}
                            >
                                <img
                                    src={nextEpisodeIcon}
                                    alt="next episode"
                                    className="video-player-next-episode-icon"
                                />
                            </div>
                        ) : null}
                        <div
                            className="video-player-h5-fullscreen text-white flex shrink-0 items-center justify-center cursor-pointer"
                            onClick={(e) => {
                                stopBubble(e);
                                void ctl.onToggleFullscreen();
                            }}
                        >
                            {ctl.isFullscreen ? (
                                <Minimize className="w-5 h-5" aria-hidden />
                            ) : (
                                <img src={fullscreenIcon} alt="" className="w-5 h-5" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
