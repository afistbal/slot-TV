import type { MouseEvent, TouchEvent } from 'react';
import { Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type Player from 'xgplayer';

import fullscreenIcon from '@/assets/video/icon_full@2x.png';
import { cn } from '@/lib/utils';

import '@/styles/video-vertical.scss';

import { useDouyinPlayerControlState } from './useDouyinPlayerControlState';

import './douyin-player-controls.scss';

type DouyinPlayerControlsProps = {
    player: Player | null;
    className?: string;
};

function stopBubble(event: MouseEvent | TouchEvent) {
    event.stopPropagation();
}

export function DouyinPlayerControls({ player, className }: DouyinPlayerControlsProps) {
    const ctl = useDouyinPlayerControlState(player);

    const seekFromClientX = (clientX: number, rect: DOMRect) => {
        if (!rect.width) return;
        const ratio = (clientX - rect.left) / rect.width;
        ctl.onSeekRatio(Math.min(Math.max(ratio, 0), 1));
    };

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
            <div className="video-player-h5-bottom video-player-h5-bottom--fullscreen">
                <div className="video-player-h5-progress-row">
                    <div
                        className="video-player-progress-scrub video-player-h5-progress-track-wrap flex-1 flex items-center justify-center min-w-0"
                        onMouseDown={(e) => {
                            stopBubble(e);
                            ctl.setProgressDragging(true);
                            seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
                        }}
                        onMouseMove={(e) => {
                            if (!ctl.progressDragging) return;
                            seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
                        }}
                        onMouseUp={() => ctl.setProgressDragging(false)}
                        onMouseEnter={() => ctl.setProgressHover(true)}
                        onMouseLeave={() => {
                            ctl.setProgressHover(false);
                            ctl.setProgressDragging(false);
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
                        <button
                            type="button"
                            className="video-player-h5-play shrink-0 flex items-center justify-center border-0 bg-transparent p-0 text-white cursor-pointer"
                            onClick={(e) => {
                                stopBubble(e);
                                void ctl.onTogglePlay();
                            }}
                            aria-label={ctl.playing ? 'Pause' : 'Play'}
                        >
                            {ctl.playing ? (
                                <Pause className="w-5 h-5" aria-hidden />
                            ) : (
                                <Play className="w-5 h-5" aria-hidden />
                            )}
                        </button>
                        <div
                            className="video-player-h5-speed"
                            onClick={(e) => {
                                stopBubble(e);
                                ctl.onCycleSpeed();
                            }}
                        >
                            {ctl.speedLabel}
                        </div>
                        <button
                            type="button"
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
