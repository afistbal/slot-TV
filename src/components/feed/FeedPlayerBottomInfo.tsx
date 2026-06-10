import type { MouseEvent } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';

import Forward from '@/components/Forward';
import { cn } from '@/lib/utils';
import { getBackendTagDisplayText } from '@/lib/normalizePlayerTags';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';

/** 与 `IPlayerData.tags` / foryou feed 接口 tags 对齐 */
export type FeedPlayerBottomInfoTag = {
    name: string;
    unique_id: string;
    local_label?: string;
};

export type FeedPlayerBottomInfoProps = {
    title: string;
    introduction?: string | null;
    /** 有值时在简介行前展示 Ep.N | */
    episodeNo?: number | null;
    tags?: FeedPlayerBottomInfoTag[];
    /** 默认 3 */
    maxTags?: number;
    /** 点击标题/简介区（打开 PC 侧栏或 H5 抽屉） */
    onOpenIntroduction?: () => void;
    className?: string;
};

const DEFAULT_MAX_TAGS = 3;

/**
 * Feed 播放页底栏剧名 / 集数 / 简介 / 标签（PC、H5 共用 DOM 与 `video-vertical.scss` 样式）。
 * 仅展示层，传值即可；进度条等控制条由外层播放器自行拼接。
 */
export function FeedPlayerBottomInfo({
    title,
    introduction,
    episodeNo,
    tags = [],
    maxTags = DEFAULT_MAX_TAGS,
    onOpenIntroduction,
    className,
}: FeedPlayerBottomInfoProps) {
    const epLabel = episodeNo != null && episodeNo > 0 ? episodeNo : null;
    const visibleTags = tags.slice(0, Math.max(0, maxTags));
    const introText = String(introduction ?? '').trim();

    return (
        <div
            className={cn('video-player-h5-info', className)}
            onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onOpenIntroduction?.();
            }}
        >
            <div className="video-player-h5-title-row">
                <span className="video-player-h5-title">{title}</span>
                <Forward className="video-player-h5-title-chevron w-4 h-4 shrink-0" />
            </div>
            <div className="video-player-h5-desc">
                {epLabel != null ? (
                    <>
                        <span className="video-player-h5-ep">
                            <FormattedMessage id="wallet_episode_short" values={{ n: epLabel }} />
                        </span>
                        <span className="video-player-h5-desc-sep" aria-hidden="true">
                            {' | '}
                        </span>
                    </>
                ) : null}
                <span className="video-player-h5-desc-text">
                    {introText ? introText : <FormattedMessage id="no_introduction_available" />}
                </span>
            </div>
            {visibleTags.length > 0 ? (
                <div
                    className="video-player-h5-tags swiper-no-swiping"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {visibleTags.map((tag) => (
                        <Link
                            key={tag.unique_id}
                            to={videoIntroTagSearchPath(tag)}
                            className="video-player-h5-tag"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {getBackendTagDisplayText(tag)}
                        </Link>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
