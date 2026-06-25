/**
 * 抖音H5滑动与播放逻辑分析.md §2.5 / §3
 * 切条播放：唯一入口 scheduleActivePlay — setTimeout(() => play())
 */
import Player from 'xgplayer';
import Mp4Plugin from 'xgplayer-mp4';
import 'xgplayer/dist/index.min.css';

import { consumeChainAutoplay } from '../feed/chainAutoplay';
import { feedDbg } from '../feed/feedDebugLog';
import { markCodedPlay, markProgPause } from '../feed/feedPlayAttribution';
import { feedVideoMp4FromPlayer } from '../feed/feedVideoMp4Log';
import { isUserAudioUnlocked, isUserGestureActive } from '../feed/userGesturePlay';
import { playIosChainWithSound } from '../playback/iosChainPlayback';
import { readMutedPreference } from '../controls/mutePreference';
import { isCrossOriginMediaUrl } from '../media/isCrossOriginMediaUrl';
import { detectPlatform } from '../platform/detectPlatform';
import { pickPlaybackMode } from '../playback/pickPlaybackMode';
import { getMp4PluginConfig } from '../playback/bufferConfig';
import type { PlaybackMode } from '../types';

export type CreateXgPlayerOptions = {
    el: HTMLElement;
    url: string;
    autoplay?: boolean;
    hasPreload?: boolean;
    forceNative?: boolean;
    fullscreenTarget?: HTMLElement | null;
};

export type XgPlayerHandle = {
    player: Player;
    mode: PlaybackMode;
    destroy: () => void;
};

let playGeneration = 0;
let userHoldPause = false;
let iosChainWantPlay = false;

export function cancelScheduledActivePlay() {
    playGeneration += 1;
    iosChainWantPlay = false;
}

export function isIosChainWantPlay() {
    return iosChainWantPlay;
}

export function setIosChainWantPlay(value: boolean) {
    iosChainWantPlay = value;
}

export function setUserHoldPause(value: boolean) {
    userHoldPause = value;
}

export function isUserHoldPause() {
    return userHoldPause;
}

function applyMuted(player: Player, muted: boolean) {
    const video = player.video as HTMLVideoElement | undefined;
    if (video) video.muted = muted;
    const xg = player as Player & { muted?: boolean };
    if (xg.muted !== undefined) xg.muted = muted;
}

export function createXgPlayer(options: CreateXgPlayerOptions): XgPlayerHandle {
    const platform = detectPlatform();
    const mode = pickPlaybackMode({
        isIOS: platform.isIOS,
        mseSupported: platform.mseSupported,
        hasPreload: options.hasPreload ?? false,
        forceNative: options.forceNative,
        crossOriginMedia: isCrossOriginMediaUrl(options.url),
    });

    const useMse = mode === 'mse';
    const autoplayMuted = readMutedPreference();

    const player = new Player({
        el: options.el,
        url: options.url,
        width: '100%',
        height: '100%',
        /** fixed：不让 resize() 按视频比例撑出 1180px 宽根节点（横屏在 375 容器内被 overflow 裁切） */
        fitVideoSize: 'fixed',
        videoFillMode: 'auto',
        /** 起播统一走 scheduleActivePlay，避免 xgplayer 内部 play() 抛未捕获 NotAllowedError */
        autoplay: false,
        autoplayMuted,
        playsinline: true,
        'webkit-playsinline': true,
        controls: false,
        loop: false,
        closeFocusVideoFocus: true,
        closePlayVideoFocus: true,
        closeVideoPreventDefault: true,
        closeVideoStopPropagation: true,
        cssFullscreen: false,
        fullscreenTarget: options.fullscreenTarget ?? options.el,
        /** start：中间按钮改由 FeedCenterPlayButton + icon_play1（对标 ForYou） */
        ignores: ['poster', 'definition', 'mobile', 'progress', 'time', 'play', 'volume', 'start', 'replay'],
        plugins: useMse ? [Mp4Plugin] : [],
        mp4plugin: useMse ? getMp4PluginConfig() : undefined,
    });

    if (player.video) {
        applyMuted(player, autoplayMuted);
    }

    return {
        player,
        mode,
        destroy: () => {
            try {
                player.destroy();
            } catch {
                /* ignore */
            }
        },
    };
}

function playErrorName(err: unknown): string {
    return err instanceof Error ? err.name : String(err);
}

function isRetriablePlayError(err: unknown): boolean {
    const name = playErrorName(err);
    return name === 'NotAllowedError' || name === 'AbortError';
}

function restoreMuteAfterIosAutoplay(player: Player, gen: number) {
    if (!detectPlatform().isIOS) return;
    if (readMutedPreference()) return;
    applyMuted(player, false);
    feedDbg('unmute', { gen });
    const video = player.video as HTMLVideoElement | undefined;
    if (!video) return;
    requestAnimationFrame(() => {
        if (gen !== playGeneration) return;
        if (!video.paused) return;
        feedDbg('unmute stalled', { gen });
        applyMuted(player, true);
        void video.play().catch(() => undefined);
    });
}

function watchPlayStalled(player: Player, gen: number, forceMute: boolean) {
    const video = player.video as HTMLVideoElement | undefined;
    if (!video || !detectPlatform().isIOS) return;
    window.setTimeout(() => {
        if (gen !== playGeneration || userHoldPause) return;
        if (!video.paused) return;
        const wantSound = !readMutedPreference() && isUserAudioUnlocked();
        feedDbg('stalled retry', { gen, wantSound });
        applyMuted(player, wantSound ? false : forceMute || readMutedPreference());
        void video.play().catch(() => undefined);
    }, 300);
}

function runActivePlay(player: Player, gen: number, forceMute: boolean): Promise<void> {
    applyMuted(player, forceMute ? true : readMutedPreference());
    const video = player.video as HTMLVideoElement | undefined;
    if (forceMute && video) {
        video.addEventListener('playing', () => restoreMuteAfterIosAutoplay(player, gen), { once: true });
    }
    return player.play().then(() => {
        feedDbg('play ok', { gen, forceMute });
        feedVideoMp4FromPlayer('play ok mp4', player, { gen, forceMute });
        watchPlayStalled(player, gen, forceMute);
    });
}

function attemptChainSoundPlay(player: Player, gen: number): Promise<void> {
    const video = player.video as HTMLVideoElement | undefined;
    if (!video) return Promise.resolve();

    iosChainWantPlay = true;
    playIosChainWithSound(video, 'schedule');
    feedVideoMp4FromPlayer('chain schedule mp4', player, { gen });

    return new Promise<void>((resolve) => {
        if (!video.paused) {
            iosChainWantPlay = false;
            feedDbg('chain play ok', { gen });
            resolve();
            return;
        }
        const onPlaying = () => {
            video.removeEventListener('playing', onPlaying);
            if (gen !== playGeneration) {
                resolve();
                return;
            }
            iosChainWantPlay = false;
            feedDbg('chain play ok', { gen });
            feedVideoMp4FromPlayer('chain play ok mp4', player, { gen });
            resolve();
        };
        video.addEventListener('playing', onPlaying);
    });
}

function attemptActivePlay(
    player: Player,
    gen: number,
    forceMute: boolean,
    attempt: number,
    chainSound: boolean,
): Promise<void> {
    if (chainSound && detectPlatform().isIOS && !readMutedPreference()) {
        return attemptChainSoundPlay(player, gen);
    }

    return runActivePlay(player, gen, forceMute).catch((err: unknown) => {
        const name = playErrorName(err);
        if (name === 'NotAllowedError') {
            if (chainSound && detectPlatform().isIOS) {
                feedDbg('chain NotAllowed → muted retry', { gen });
                return attemptChainSoundPlay(player, gen);
            }
            feedDbg('play blocked until gesture', { gen });
            feedVideoMp4FromPlayer('play blocked mp4', player, { gen, err: name });
            return;
        }
        if (!isRetriablePlayError(err) || attempt >= 2 || gen !== playGeneration) {
            feedDbg('play rejected', { gen, err: name, attempt });
            feedVideoMp4FromPlayer('play rejected mp4', player, { gen, err: name, attempt });
            if (name === 'AbortError') return;
            throw err;
        }
        feedDbg('play retry', { gen, err: name, attempt: attempt + 1 });
        return new Promise<void>((resolve) => {
            window.setTimeout(resolve, 120 * (attempt + 1));
        }).then(() => {
            if (gen !== playGeneration) {
                feedDbg('play cancelled', { gen, current: playGeneration });
                return;
            }
            const retryForceMute =
                detectPlatform().isIOS &&
                !readMutedPreference() &&
                !isUserAudioUnlocked();
            return attemptActivePlay(player, gen, retryForceMute, attempt + 1, chainSound);
        });
    });
}

/** 等 slot 提交后再 play，避免下一条 mount 打断（iOS AbortError） */
function deferActivePlayExecute(fn: () => void, chainSound: boolean) {
    if (chainSound) {
        fn();
        return;
    }
    if (detectPlatform().isIOS) {
        requestAnimationFrame(() => {
            requestAnimationFrame(fn);
        });
        return;
    }
    window.setTimeout(fn, 0);
}

/** MD §2.5 L3180-3186：setTimeout(() => play())；iOS 已解锁有声则不再 forceMute */
export function scheduleActivePlay(player: Player) {
    if (userHoldPause) {
        feedDbg('schedule skip holdPause');
        return;
    }
    const chainSound = consumeChainAutoplay();
    const gen = ++playGeneration;
    const platform = detectPlatform();
    const gesture = isUserGestureActive();
    const wantUnmuted = !readMutedPreference();
    const audioUnlocked = isUserAudioUnlocked();
    /** 连播：有声走 muted bootstrap，不 forceMute */
    const forceMute = chainSound
        ? false
        : !gesture || (platform.isIOS && wantUnmuted && !audioUnlocked);
    const syncInGesture =
        !chainSound && platform.isIOS && wantUnmuted && audioUnlocked && gesture;
    feedDbg('schedule', {
        gen,
        gesture,
        muted: !wantUnmuted,
        audioUnlocked,
        forceMute,
        chainSound,
    });
    feedVideoMp4FromPlayer('schedule mp4', player, { gen, chainSound });

    const execute = () => {
        if (gen !== playGeneration) {
            feedDbg('play cancelled', { gen, current: playGeneration });
            return;
        }
        markCodedPlay(chainSound ? 'schedule-chain' : 'schedule');
        void attemptActivePlay(player, gen, forceMute, 0, chainSound).catch(() => undefined);
    };

    if (syncInGesture || chainSound) {
        execute();
    } else {
        deferActivePlayExecute(execute, chainSound);
    }
}

export type PausePlayerOptions = {
    keepScheduledPlay?: boolean;
};

export function pausePlayer(player: Player, opts?: PausePlayerOptions) {
    if (!opts?.keepScheduledPlay) {
        playGeneration += 1;
        iosChainWantPlay = false;
    }
    const keepScheduled = Boolean(opts?.keepScheduledPlay);
    const video = player.video as HTMLVideoElement | undefined;
    markProgPause(video, keepScheduled);
    feedDbg('pause', { gen: playGeneration, keepScheduled });
    feedVideoMp4FromPlayer('pause mp4', player, {
        gen: playGeneration,
        keepScheduled,
    });
    try {
        player.pause();
    } catch {
        /* ignore */
    }
}
