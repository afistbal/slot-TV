/** 单条 Feed 视频（与业务 API 解耦） */
import type { MutableRefObject, ReactNode, RefObject } from 'react';

export type DouyinFeedVideoItem = {
    id: string | number;
    url: string;
    /** VTT 路径（必填字段；空字符串 = 本条无字幕） */
    subtitle: string;
};

export type PlaybackMode = 'mse' | 'native';

export type FeedNavigateDirection = 'next' | 'prev' | 'auto';

/** 壳层 PC 上下集 / 选集：须走 feed 内 syncActiveIndex，勿单独 scrollIntoView */
export type DouyinFeedNavigateHandle = {
    next: () => void;
    prev: () => void;
    goToIndex: (index: number) => void;
};

export type DouyinFeedPlayerProps = {
    items: DouyinFeedVideoItem[];
    /** config.static 等静态资源域名，用于拼接相对 video 路径 */
    mediaBaseUrl?: string;
    className?: string;
    /** 对标 MD §2.5：切条回调 */
    onIndexChange?: (index: number, direction: FeedNavigateDirection) => void;
    /** 对标 MD §2.6：是否预加载下一条（影响 isInitPlayer） */
    preloadNext?: boolean;
    /** 初始索引 */
    initialIndex?: number;
    /** iOS MD §9：MSE / native 模式切换回调 */
    onPlaybackModeChange?: (index: number, mode: PlaybackMode) => void;
    /** iOS MD §9：卡顿 / 降级原因回调 */
    onStall?: (index: number, reason: string) => void;
    /** 是否展示底部控制条（倍速/静音/下一集/全屏），默认 true */
    showControls?: boolean;
    /** 工具栏「下一集」是否展示（对标 foryou `video-player-h5-next`） */
    showNextEpisode?: boolean;
    /** 点击工具栏「下一集」 */
    onNextEpisode?: () => void;
    /** 底栏进度条之上（info / Watch Full 等），与 controls 共用同一 `video-player-h5-bottom` */
    controlsTopContent?: ReactNode;
    /** for-demo：固定 1.0x，隐藏倍速（/v-demo 等默认 false 仍可变速） */
    fixedPlaybackSpeed?: boolean;
    /** 容器全屏目标（`.video-fullscreen-target`） */
    fullscreenTargetRef?: RefObject<HTMLElement | null>;
    isDesktop?: boolean;
    /** 全屏 UI 显隐（壳层隐藏顶栏/侧栏） */
    onFullscreenUiChange?: (active: boolean) => void;
    /** 壳层 PC 导航：prev/next/选集须先 syncActiveIndex 再滚动 */
    feedNavigateRef?: MutableRefObject<DouyinFeedNavigateHandle | null>;
    /** 业务锁态：当前项无 URL 时展示黑底，避免误显示播放器 loading。 */
    isItemLocked?: (item: DouyinFeedVideoItem, index: number) => boolean;
};
export type PlayerSlotState = {
    index: number;
    item: DouyinFeedVideoItem;
    positionOffset: number;
    isActive: boolean;
    shouldInitPlayer: boolean;
};
