import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useState,
    type MouseEvent,
} from 'react';

import type { ShareAction } from './videoPlayerConstants';
import { VideoPlayerH5CommerceDrawers } from '@/components/video-player/VideoPlayerH5CommerceDrawers';
import { VideoPlayerPcCommerceDialogs } from '@/components/video-player/VideoPlayerPcCommerceDialogs';
import type { IPlayerEpisode } from '@/types/videoPlayer';

export type VideoPlayerVipCommerceHandle = {
    openVip: () => void;
    closeVip: () => void;
    toggleVip: (ev?: MouseEvent) => void;
};

type ShareProps = {
    shareOpen: boolean;
    onShareOpenChange: (open: boolean) => void;
    shareEmbedCode: string;
    shareShowControls: boolean;
    onToggleShareShowControls: () => void;
    onClearShareEmbedCode?: () => void;
    posterUrl: string;
    title: string;
    introduction?: string;
    onShareAction: (action: ShareAction) => void | Promise<void>;
    onCopyEmbedCode: () => void | Promise<void>;
};

export type VideoPlayerVipCommerceProps = {
    variant: 'h5' | 'pc';
    /** ????row id???????? */
    episodeRowId: number;
    /**
     * ???????????/VIP ??????     * ????????vdemo ??`isVDemoEpisodeLocked(activeRow)`??     * ??true ??`viewerIsVip === false` ?????? VIP/??????     */
    locked: boolean;
    episode?: IPlayerEpisode;
    viewerIsVip: boolean;
    onPaySuccessEpisodeDetail: (episode: IPlayerEpisode) => void;
} & ShareProps;

export const VideoPlayerVipCommerce = forwardRef<
    VideoPlayerVipCommerceHandle,
    VideoPlayerVipCommerceProps
>(function VideoPlayerVipCommerce(
    {
        variant,
        episodeRowId,
        locked,
        episode,
        viewerIsVip,
        onPaySuccessEpisodeDetail,
        shareOpen,
        onShareOpenChange,
        shareEmbedCode,
        shareShowControls,
        onToggleShareShowControls,
        onClearShareEmbedCode,
        posterUrl,
        title,
        introduction = '',
        onShareAction,
        onCopyEmbedCode,
    },
    ref,
) {
    const [vip, setVip] = useState(false);

    const openVip = useCallback(() => {
        setVip(true);
    }, []);

    const closeVip = useCallback(() => {
        setVip(false);
    }, []);

    const toggleVip = useCallback(
        (ev?: MouseEvent) => {
            ev?.preventDefault();
            ev?.stopPropagation();
            if (viewerIsVip) {
                return;
            }
            setVip((open) => !open);
        },
        [viewerIsVip],
    );

    useImperativeHandle(ref, () => ({ openVip, closeVip, toggleVip }), [
        openVip,
        closeVip,
        toggleVip,
    ]);

    useEffect(() => {
        setVip(false);
    }, [episodeRowId]);

    /** ??VIP ?????? ??????rs-shopping ??????????? VIP ??????*/
    useEffect(() => {
        if (viewerIsVip) {
            setVip(false);
            return;
        }
        setVip(locked);
    }, [locked, episodeRowId, episode?.id, episode?.lock, viewerIsVip]);

    const handlePaySuccess = useCallback(
        (detail: IPlayerEpisode) => {
            setVip(false);
            onPaySuccessEpisodeDetail(detail);
        },
        [onPaySuccessEpisodeDetail],
    );

    const vipHeaderEpisodeUnlockCoins = episode?.unlock_coins;

    if (variant === 'pc') {
        return (
            <VideoPlayerPcCommerceDialogs
                vip={vip}
                onVipOpenChange={setVip}
                onVipEmbedClose={closeVip}
                embedVideoEpisodeRowId={episodeRowId}
                onEmbedPaySuccessEpisodeDetail={handlePaySuccess}
                vipHeaderEpisodeUnlockCoins={vipHeaderEpisodeUnlockCoins}
                shareOpen={shareOpen}
                onShareOpenChange={onShareOpenChange}
                shareEmbedCode={shareEmbedCode}
                shareShowControls={shareShowControls}
                onToggleShareShowControls={onToggleShareShowControls}
                posterUrl={posterUrl}
                title={title}
                introduction={introduction}
                onShareAction={onShareAction}
                onCopyEmbedCode={onCopyEmbedCode}
            />
        );
    }

    return (
        <VideoPlayerH5CommerceDrawers
            vip={vip}
            onVipOpenChange={setVip}
            onVipEmbedClose={closeVip}
            embedVideoEpisodeRowId={episodeRowId}
            onEmbedPaySuccessEpisodeDetail={handlePaySuccess}
            vipHeaderEpisodeUnlockCoins={vipHeaderEpisodeUnlockCoins}
            shareOpen={shareOpen}
            onShareOpenChange={onShareOpenChange}
            shareEmbedCode={shareEmbedCode}
            shareShowControls={shareShowControls}
            onToggleShareShowControls={onToggleShareShowControls}
            onClearShareEmbedCode={onClearShareEmbedCode ?? (() => undefined)}
            posterUrl={posterUrl}
            title={title}
            onShareAction={onShareAction}
            onCopyEmbedCode={onCopyEmbedCode}
        />
    );
});
