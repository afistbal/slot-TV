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
import { useVideoRetentionCommerce } from '@/components/video-retention-promo/VideoRetentionPromo';
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
    /** 当前集 episodes 行 id（movie/info） */
    episodeRowId: number;
    /**
     * 当前集是否锁定（展示锁层 / 禁播）。
     * vdemo 侧传 `isVDemoEpisodeLocked(activeRow)`；
     * 为 true 且 `viewerIsVip === false` 时展示 VIP/解锁入口。
     */
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

    const retention = useVideoRetentionCommerce({
        variant,
        viewerIsVip,
        vip,
        onVipOpenChange: setVip,
        episodeRowId,
    });

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

    /** 非 VIP 且 locked 时自动弹出 rs-shopping；VIP 或解锁后关闭；挽留进行中不抢弹 */
    useEffect(() => {
        if (viewerIsVip) {
            setVip(false);
            return;
        }
        if (retention.promoActive) {
            return;
        }
        setVip(locked);
    }, [locked, episodeRowId, viewerIsVip, retention.promoActive]);

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
                retention={retention}
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
            retention={retention}
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
