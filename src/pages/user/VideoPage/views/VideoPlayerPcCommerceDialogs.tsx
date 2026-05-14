import { useIntl } from 'react-intl';
import shareCloseIcon from '@/assets/icons/share/close.svg';
import shareFacebookIcon from '@/assets/icons/share/facebook.svg';
import shareLinkIcon from '@/assets/icons/share/link.svg';
import shareTwitterIcon from '@/assets/icons/share/twitter.svg';
import { cn } from '@/lib/utils';
import RadixRc from '@/pages/user/RadixRc';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ShareAction } from '../videoPlayerConstants';
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
                    className="video-vip-dialog w-[min(100%,620px)] max-w-[calc(100vw-32px)] h-[min(88vh,840px)]"
                >
                    <div className="h-full w-full overflow-hidden rounded-[16px] border border-white/10 bg-[#141414] text-white">
                        <DialogTitle className="sr-only" unsetTypography>
                            {intl.formatMessage({ id: 'shopping_vip_drawer_title' })}
                        </DialogTitle>
                        <div className="h-full overflow-y-auto">
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
