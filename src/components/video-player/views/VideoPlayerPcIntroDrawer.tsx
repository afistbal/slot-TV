import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import Image from '@/components/Image';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';
import { getBackendTagDisplayText } from '@/lib/normalizePlayerTags';
import { useMovieTagLabelsReady } from '@/lib/movieTagLabels';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import type { RefObject } from 'react';
import { getTagDisplayText } from '../videoPlayerUtils';
import { VideoPlayerPcDrawerCloseButton } from './VideoPlayerPcDrawerCloseButton';
import { VideoPlayerPcRightDrawer } from './VideoPlayerPcRightDrawer';

export type VideoPlayerPcIntroDrawerProps = {
    open: boolean;
    entered: boolean;
    onClose: () => void;
    anchorRef: RefObject<HTMLElement | null>;
    data: IPlayerData;
    episode: IPlayerEpisode | undefined;
    staticBase: string;
    /** For You：仅用接口 tags 字段，不走 tag-labels */
    tagsFromBackendOnly?: boolean;
    /** 最多展示的 tag 数量，超出截断 */
    maxTags?: number;
};

export function VideoPlayerPcIntroDrawer({
    open,
    entered,
    onClose,
    anchorRef,
    data,
    staticBase,
    tagsFromBackendOnly = false,
    maxTags,
}: VideoPlayerPcIntroDrawerProps) {
    const tagLabel = tagsFromBackendOnly ? getBackendTagDisplayText : getTagDisplayText;
    const visibleTags = maxTags != null ? data.tags.slice(0, maxTags) : data.tags;
    useMovieTagLabelsReady();
    return (
        <VideoPlayerPcRightDrawer
            open={open}
            entered={entered}
            onClose={onClose}
            anchorRef={anchorRef}
            ariaLabel="Introduction"
            className="video-pc-right-drawer--intro"
            showPanelClose={false}
        >
            <div className="video-pc-intro-drawer__scroll">
                <div className="video-pc-intro-drawer__header">
                    <div className="video-pc-intro-drawer__poster shrink-0">
                        <Image
                            height={1.3325}
                            src={`${staticBase}/${data.info.image}`}
                            alt={data.info.title}
                        />
                    </div>
                    <VideoPlayerPcDrawerCloseButton onClose={onClose} tabIndex={open ? 0 : -1} />
                </div>
                <div className="video-pc-intro-drawer__title-row">
                    <h2 className="video-pc-intro-drawer__title">{data.info.title}</h2>
                </div>
                <div className="video-pc-intro-drawer__body">
                    {data.info.introduction ? (
                        <p className="video-pc-intro-drawer__desc">
                            <span>{data.info.introduction}</span>
                        </p>
                    ) : (
                        <p className="video-pc-intro-drawer__text">
                            <FormattedMessage id="no_introduction_available" />
                        </p>
                    )}
                </div>
                {visibleTags.length > 0 && (
                    <div className="video-pc-intro-drawer__tags">
                        {visibleTags.map((v) => (
                            <Link
                                key={v.unique_id}
                                to={videoIntroTagSearchPath(v)}
                                className="video-pc-intro-drawer__tag"
                                onClick={onClose}
                            >
                                {tagLabel(v)}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </VideoPlayerPcRightDrawer>
    );
}
