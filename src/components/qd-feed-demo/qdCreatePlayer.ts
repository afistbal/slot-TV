/**
 * QD: 9085 L157–190 new Player({...})
 * 见 QUICKDRAMA-REFERENCE.md §功能4
 */
import Player from 'xgplayer';
import Mp4Plugin from 'xgplayer-mp4';
import TextTrack from 'xgplayer/es/plugins/track';
import 'xgplayer/dist/index.min.css';

import type { QdFeedDemoItem } from './types';
/** QD: s.READY / ENDED / PLAY — 9085 使用 73096 事件常量，运行时即 xgplayer 字符串事件名 */
export const QD_PLAYER_EVENTS = {
    READY: 'ready',
    ENDED: 'ended',
    PLAY: 'play',
    PLAYING: 'playing',
    PAUSE: 'pause',
} as const;

type QdPlayerWithPlugins = Player & {
    getPlugin?: (name: string) => unknown;
};

/** QD texttrack 配置结构 — 9085 L167–189 */
export type QdCreatePlayerOptions = {
    /** QD 用 id 找 DOM；也可显式传 el */
    el?: HTMLElement;
    videoId: string;
    url: string;
    poster: string;
    height?: number;
    controls?: boolean;
    loop?: boolean;
    /** QD: isRecommandPage → offsetBottom 25 vs 10 */
    isRecommandPage?: boolean;
    subtitleUrlList?: QdFeedDemoItem['subtitleUrlList'];
    /** 语言 code → 显示名；QD 用 lanuageList store */
    languageLabels?: Record<string, string>;
    defaultLanguage?: string;
};

export function createQdXgPlayer(options: QdCreatePlayerOptions): Player {
    const height = options.height ?? window.innerHeight;
    const subtitleList = (options.subtitleUrlList ?? []).map((item) => ({
        id: item.id,
        url: item.subtitleUrl,
        language: item.languageCode,
        text: options.languageLabels?.[item.languageCode] ?? item.languageCode,
        default: item.languageCode === options.defaultLanguage,
    }));

    return new Player({
        el: options.el,
        controls: options.controls ?? true,
        loop: options.loop ?? false,
        id: options.el ? undefined : `video-${options.videoId}`,
        url: options.url,
        height,
        width: window.innerWidth,
        // QD: 9085 L164 plugins: [c.$, u.A] → mp4 + texttrack
        plugins: [Mp4Plugin, TextTrack],
        poster: options.poster,
        fit: 'fix',
        playsinline: true,
        'x5-playsinline': true,
        'webkit-playsinline': true,
        texttrack: {
            isDefaultOpen: true,
            position: 'controlsRight',
            index: 1,
            style: {
                follow: true,
                mode: 'stroke',
                followBottom: 50,
                fitVideo: true,
                offsetBottom: options.isRecommandPage ? 25 : 10,
                baseSizeX: 49,
                baseSizeY: 28,
                minSize: 24,
                minMobileSize: 24,
                line: 'double',
                fontColor: '#fff',
            },
            closeText: {
                text: '不开启',
                iconText: '字幕',
            },
            list: subtitleList,
        },
    });
}

/** QD: 9085 L200–216 READY 后绑定控件 touch/click */
export function bindQdPlayerControlTouches(videoId: string) {
    const root = `#video-${videoId} `;

    document.querySelectorAll(`${root}.xgplayer-texttrack`).forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'auto';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    document.querySelectorAll(`${root}.xgplayer-playbackrate`).forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'auto';
        el.addEventListener('click', (evt) => {
            evt.stopPropagation();
            el.closest('.xgplayer')?.classList.remove('xgplayer-inactive');
        });
    });

    document.querySelectorAll(`${root}.xgplayer-progress`).forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'auto';
        const stop = (e: Event) => e.stopPropagation();
        el.addEventListener('touchstart', stop);
        el.addEventListener('touchmove', stop);
        el.addEventListener('touchend', stop);
    });
}

/** QD: 9085 L190–191 textTrack change → setMovieDefaultLanguage */
export function bindQdTextTrackChange(
    player: Player,
    onLanguageChange: (language: string) => void,
) {
    const textTrack = (player as QdPlayerWithPlugins).getPlugin?.('textTrack') as
        | { subTitles?: { on: (ev: string, cb: (e: { language: string }) => void) => void } }
        | undefined;
    textTrack?.subTitles?.on('change', (e) => {
        onLanguageChange(e.language);
    });
}

/** QD: 9085 L227–235 就绪后按 defaultLanguage 切字幕 */
export function switchQdDefaultSubtitle(
    player: Player,
    subtitleUrlList: QdFeedDemoItem['subtitleUrlList'],
    defaultLanguage: string | undefined,
) {
    if (!defaultLanguage || !subtitleUrlList?.length) return;
    const row = subtitleUrlList.find((s) => String(s.languageCode) === String(defaultLanguage));
    if (!row) return;
    const textTrack = (player as QdPlayerWithPlugins).getPlugin?.('textTrack') as
        | {
              subTitles?: {
                  switch: (o: { id: string; language: string }) => Promise<unknown>;
              };
          }
        | undefined;
    void textTrack?.subTitles
        ?.switch({ id: row.id, language: row.languageCode })
        .catch(() => undefined);
}
