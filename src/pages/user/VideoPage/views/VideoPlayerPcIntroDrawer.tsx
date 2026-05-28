import { ChevronRight } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import Image from '@/components/Image';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';
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
};

export function VideoPlayerPcIntroDrawer({
    open,
    entered,
    onClose,
    anchorRef,
    data,
    episode,
    staticBase,
}: VideoPlayerPcIntroDrawerProps) {
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
                {data.tags.length > 0 && (
                    <div className="video-pc-intro-drawer__tags">
                        {data.tags.map((v) => (
                            <Link
                                key={v.name}
                                to={videoIntroTagSearchPath(v)}
                                className="video-pc-intro-drawer__tag"
                                onClick={onClose}
                            >
                                {getTagDisplayText(v)}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </VideoPlayerPcRightDrawer>
    );
}
