import { useIntl } from 'react-intl';
import shareCloseIcon from '@/assets/icons/share/close.svg';
import shareFacebookIcon from '@/assets/video/share_icon_facebook@2x.webp';
import shareLinkIcon from '@/assets/video/share_icon_link@2x.webp';
import shareTwitterIcon from '@/assets/video/share_icon_xcorp@2x.webp';
import { cn } from '@/lib/utils';
import RadixRc from '@/pages/user/RadixRc';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ShareAction } from '@/components/video-player/videoPlayerConstants';
import type { IPlayerEpisode } from '@/types/videoPlayer';

export type VideoPlayerPcCommerceDialogsProps = {
    vip: boolean;
    onVipOpenChange: (open: boolean) => void;
    onVipEmbedClose: () => void;
    embedVideoEpisodeRowId: number;
    onEmbedPaySuccessEpisodeDetail: (episode: IPlayerEpisode) => void;
    vipHeaderEpisodeUnlockCoins?: number;
    shareOpen: boolean;
    onShareOpenChange: (open: boolean) => void;
    shareEmbedCode: string;
    shareShowControls: boolean;
    onToggleShareShowControls: () => void;
    posterUrl: string;
    title: string;
    introduction: string;
    onShareAction: (action: ShareAction) => void | Promise<void>;
    onCopyEmbedCode: () => void | Promise<void>;
};

/** PC?VIP ???rs-shopping?+ ???? */
export function VideoPlayerPcCommerceDialogs({
    vip,
    onVipOpenChange,
    onVipEmbedClose,
    embedVideoEpisodeRowId,
    onEmbedPaySuccessEpisodeDetail,
    vipHeaderEpisodeUnlockCoins,
    shareOpen,
    onShareOpenChange,
    shareEmbedCode,
    shareShowControls,
    onToggleShareShowControls,
    posterUrl,
    title,
    introduction,
    onShareAction,
    onCopyEmbedCode,
}: VideoPlayerPcCommerceDialogsProps) {
    const intl = useIntl();

    return (
        <>
            <Dialog open={vip} onOpenChange={onVipOpenChange}>
                <DialogContent
                    contentPreset="plain"
                    hideCloseButton
                    className="video-vip-dialog rs-shopping-checkout-drawer rs-shopping-checkout-drawer--vipNoScroll rs-shopping-drawer-bg flex min-h-0 w-[min(518px,calc(100vw-32px))] h-[min(80vh,840px)] flex-col overflow-hidden rounded-[16px] border border-white/10 p-0 text-white"
                >
                    <DialogTitle className="sr-only" unsetTypography>
                        {intl.formatMessage({ id: 'shopping_vip_drawer_title' })}
                    </DialogTitle>
                    <div className="rs-shopping-checkout-drawer__scroll rs-shopping-checkout-drawer__scroll--reelshort flex min-h-0 flex-1 flex-col">
                        {vip ? (
                            <RadixRc
                                layout="embed"
                                productFrom="video"
                                checkoutFrom="video"
                                onEmbedClose={onVipEmbedClose}
                                headerEpisodeUnlockCoins={vipHeaderEpisodeUnlockCoins}
                                embedVideoEpisodeRowId={embedVideoEpisodeRowId}
                                onEmbedPaySuccessEpisodeDetail={onEmbedPaySuccessEpisodeDetail}
                            />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={shareOpen} onOpenChange={onShareOpenChange}>
                <DialogContent
                    contentPreset="plain"
                    hideCloseButton
                    className="video-share-dialog w-[560px] max-w-[calc(100vw-24px)]"
                >
                    <DialogTitle className="sr-only" unsetTypography>
                        {intl.formatMessage({ id: 'share' })}
                    </DialogTitle>
                    <div className="video-share-pc-modal">
                        <button type="button" className="video-share-pc-close" onClick={() => onShareOpenChange(false)}>
                            <img src={shareCloseIcon} alt={intl.formatMessage({ id: 'close' })} />
                        </button>
                        {!shareEmbedCode ? (
                            <div className="video-share-pc-content">
                                <div className="video-share-pc-title">{intl.formatMessage({ id: 'share' })}</div>
                                <div className="video-share-pc-card">
                                    <div className="video-share-pc-card-image">
                                        <img src={posterUrl} alt="" />
                                    </div>
                                    <div className="video-share-pc-card-text">
                                        <div className="video-share-pc-card-title">{title}</div>
                                        <div className="video-share-pc-card-desc">{introduction}</div>
                                    </div>
                                </div>
                                <div className="video-share-pc-actions">
                                    <button type="button" className="video-share-pc-action" onClick={() => void onShareAction('link')}>
                                        <img src={shareLinkIcon} alt="" />
                                        <span>{intl.formatMessage({ id: 'share_link' })}</span>
                                    </button>
                                    <button type="button" className="video-share-pc-action" onClick={() => void onShareAction('facebook')}>
                                        <img src={shareFacebookIcon} alt="" />
                                        <span>{intl.formatMessage({ id: 'share_facebook' })}</span>
                                    </button>
                                    <button type="button" className="video-share-pc-action" onClick={() => void onShareAction('twitter')}>
                                        <img src={shareTwitterIcon} alt="" />
                                        <span>{intl.formatMessage({ id: 'share_twitter' })}</span>
                                    </button>
                                    <div className="video-share-pc-action video-share-pc-action--placeholder" aria-hidden="true" />
                                </div>
                            </div>
                        ) : (
                            <div className="video-share-pc-embed">
                                <div className="video-share-pc-embed-image">
                                    <img src={posterUrl} alt="" />
                                </div>
                                <div className="video-share-pc-embed-panel">
                                    <div className="video-share-pc-title">
                                        {intl.formatMessage({ id: 'share_embed_video' })}
                                    </div>
                                    <div className="video-share-pc-embed-box">
                                        <div className="video-share-pc-embed-code">{shareEmbedCode}</div>
                                        <div className="video-share-pc-embed-toggle" onClick={onToggleShareShowControls}>
                                            <div className={cn('video-share-pc-checkbox', shareShowControls && 'is-checked')} />
                                            <label>{intl.formatMessage({ id: 'share_show_player_controls' })}</label>
                                        </div>
                                    </div>
                                    <button type="button" className="video-share-pc-copy-btn" onClick={() => void onCopyEmbedCode()}>
                                        {intl.formatMessage({ id: 'copy' })}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
