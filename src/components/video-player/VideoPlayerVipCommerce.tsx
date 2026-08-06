import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type MouseEvent,
} from 'react';

import type { ShareAction } from './videoPlayerConstants';
import { VideoPlayerH5CommerceDrawers } from '@/components/video-player/VideoPlayerH5CommerceDrawers';
import { VideoPlayerPcCommerceDialogs } from '@/components/video-player/VideoPlayerPcCommerceDialogs';
import { TikTokRewardedFallbackOverlay } from '@/components/video-player/TikTokRewardedFallbackOverlay';
import { useVideoRetentionCommerce } from '@/components/video-retention-promo/VideoRetentionPromo';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { isTikTokPlatform } from '@/platform';
import { isTikTokIapMode } from '@/lib/tiktokMonetization';
import {
    unlockTikTokEpisodeWithRewardedAd,
} from '@/lib/tiktokRewardedEpisodeUnlock';
import { toast } from 'sonner';

export type VideoPlayerVipCommerceHandle = {
    openVip: () => void;
    openRewardedAd: (episodeRowId?: number) => void;
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
    /** TikTok only: a prior episode must be unlocked before this one can show an ad. */
    tiktokEpisodeOrderBlocked?: boolean;
    /** Disable when the TikTok lock overlay is rendered inside the feed slide. */
    showTikTokLockedOverlay?: boolean;
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
        tiktokEpisodeOrderBlocked = false,
        showTikTokLockedOverlay = true,
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
    const rewardedAdBusyRef = useRef(false);
    const useTikTokIaa = variant === 'h5' && isTikTokPlatform() && !isTikTokIapMode();

    const retention = useVideoRetentionCommerce({
        variant,
        viewerIsVip,
        vip,
        onVipOpenChange: setVip,
        episodeRowId,
    });

    const showRewardedAd = useCallback(async (targetEpisodeRowId = episodeRowId) => {
        if (rewardedAdBusyRef.current || !targetEpisodeRowId) return;
        rewardedAdBusyRef.current = true;
        try {
            const result = await unlockTikTokEpisodeWithRewardedAd(targetEpisodeRowId);
            toast.success('Ad completed. Episode unlocked.', {
                id: 'tiktok-rewarded-ad',
            });
            onPaySuccessEpisodeDetail(result.episode);
        } catch (error) {
            // TikTok 锁定页本身就是失败/未解锁状态的反馈，不额外弹出错误提示。
            toast.dismiss('tiktok-rewarded-ad');
            console.warn('[TikTok ad unlock] Unlock attempt did not complete.', error);
        } finally {
            rewardedAdBusyRef.current = false;
        }
    }, [episodeRowId, onPaySuccessEpisodeDetail]);

    const openVip = useCallback(() => {
        if (useTikTokIaa) {
            if (tiktokEpisodeOrderBlocked) return;
            void showRewardedAd();
            return;
        }
        setVip(true);
    }, [showRewardedAd, tiktokEpisodeOrderBlocked, useTikTokIaa]);

    const closeVip = useCallback(() => {
        setVip(false);
    }, []);

    const openRewardedAd = useCallback(
        (targetEpisodeRowId?: number) => {
            if (!useTikTokIaa) return;
            void showRewardedAd(targetEpisodeRowId);
        },
        [showRewardedAd, useTikTokIaa],
    );

    const toggleVip = useCallback(
        (ev?: MouseEvent) => {
            ev?.preventDefault();
            ev?.stopPropagation();
            if (viewerIsVip) {
                return;
            }
            if (useTikTokIaa) {
                if (tiktokEpisodeOrderBlocked) return;
                void showRewardedAd();
                return;
            }
            setVip((open) => !open);
        },
        [showRewardedAd, tiktokEpisodeOrderBlocked, useTikTokIaa, viewerIsVip],
    );

    useImperativeHandle(ref, () => ({ openVip, openRewardedAd, closeVip, toggleVip }), [
        openVip,
        openRewardedAd,
        closeVip,
        toggleVip,
    ]);

    useEffect(() => {
        setVip(false);
    }, [episodeRowId]);

    /** 非 VIP 且 locked 时自动弹出 rs-shopping；VIP 或解锁后关闭；挽留进行中不抢弹 */
    useEffect(() => {
        if (useTikTokIaa) {
            setVip(false);
            return;
        }
        if (viewerIsVip) {
            setVip(false);
            return;
        }
        if (retention.promoActive) {
            return;
        }
        setVip(locked);
    }, [locked, episodeRowId, viewerIsVip, retention.promoActive, useTikTokIaa]);

    const handlePaySuccess = useCallback(
        (detail: IPlayerEpisode) => {
            setVip(false);
            onPaySuccessEpisodeDetail(detail);
        },
        [onPaySuccessEpisodeDetail],
    );

    const vipHeaderEpisodeUnlockCoins = episode?.unlock_coins;
    const rewardedFallbackOverlay =
        useTikTokIaa && locked && showTikTokLockedOverlay ? (
            <TikTokRewardedFallbackOverlay
                posterUrl={posterUrl}
                onRetry={openVip}
                episodeOrderBlocked={tiktokEpisodeOrderBlocked}
            />
        ) : null;

    if (variant === 'pc') {
        return (
            <>
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
                {rewardedFallbackOverlay}
            </>
        );
    }

    return (
        <>
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
            {rewardedFallbackOverlay}
        </>
    );
});

