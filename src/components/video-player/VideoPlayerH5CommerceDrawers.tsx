import { useIntl } from 'react-intl';
import shareCloseIcon from '@/assets/icons/share/close.svg';
import shareFacebookIcon from '@/assets/video/share_icon_facebook@2x.webp';
import shareLinkIcon from '@/assets/video/share_icon_link@2x.webp';
import shareTwitterIcon from '@/assets/video/share_icon_xcorp@2x.webp';
import { cn } from '@/lib/utils';
import RadixRc from '@/pages/user/RadixRc';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import type { ShareAction } from '@/components/video-player/videoPlayerConstants';
import type { IPlayerEpisode } from '@/types/videoPlayer';

export type VideoPlayerH5CommerceDrawersProps = {
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
    onClearShareEmbedCode: () => void;
    posterUrl: string;
    title: string;
    onShareAction: (action: ShareAction) => void | Promise<void>;
    onCopyEmbedCode: () => void | Promise<void>;
};

/** H5?VIP ???rs-shopping?+ ???? */
export function VideoPlayerH5CommerceDrawers({
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
    onClearShareEmbedCode,
    posterUrl,
    title,
    onShareAction,
    onCopyEmbedCode,
}: VideoPlayerH5CommerceDrawersProps) {
    const intl = useIntl();

    return (
        <>
            <Drawer open={vip} onOpenChange={onVipOpenChange} disablePreventScroll>
                <DrawerContent
                    handler
                    className="rs-shopping-checkout-drawer rs-shopping-checkout-drawer--vipNoScroll rs-shopping-drawer-bg flex min-h-0 flex-col overflow-hidden border-t border-white/10 p-0 text-white max-h-[min(88vh,1040px)]"
                >
                    <DrawerTitle className="sr-only">
                        {intl.formatMessage({ id: 'shopping_vip_drawer_title' })}
                    </DrawerTitle>
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
                </DrawerContent>
            </Drawer>
            <Drawer open={shareOpen} onOpenChange={onShareOpenChange}>
                <DrawerContent className="video-share-mobile-drawer border-0 p-0 text-white">
                    <DrawerTitle className="sr-only">
                        {intl.formatMessage({ id: 'share' })}
                    </DrawerTitle>
                    {!shareEmbedCode ? (
                        <>
                            <div className="video-share-mobile-header">
                                <div>{intl.formatMessage({ id: 'share' })}</div>
                                <button
                                    type="button"
                                    className="video-share-mobile-close"
                                    onClick={() => onShareOpenChange(false)}
                                >
                                    <img src={shareCloseIcon} alt={intl.formatMessage({ id: 'close' })} />
                                </button>
                            </div>
                            <div className="video-share-mobile-body">
                                <div className="video-share-mobile-card">
                                    <div className="video-share-mobile-card-image">
                                        <img src={posterUrl} alt="" />
                                    </div>
                                    <div className="video-share-mobile-card-title">{title}</div>
                                </div>
                                <div className="video-share-mobile-actions">
                                    <button
                                        type="button"
                                        className="video-share-mobile-action"
                                        onClick={() => void onShareAction('link')}
                                    >
                                        <img src={shareLinkIcon} alt="" />
                                        <span>{intl.formatMessage({ id: 'share_link' })}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="video-share-mobile-action"
                                        onClick={() => void onShareAction('facebook')}
                                    >
                                        <img src={shareFacebookIcon} alt="" />
                                        <span>{intl.formatMessage({ id: 'share_facebook' })}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="video-share-mobile-action"
                                        onClick={() => void onShareAction('twitter')}
                                    >
                                        <img src={shareTwitterIcon} alt="" />
                                        <span>{intl.formatMessage({ id: 'share_twitter' })}</span>
                                    </button>
                                    <div
                                        className="video-share-mobile-action video-share-mobile-action--placeholder"
                                        aria-hidden="true"
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="video-share-mobile-header">
                                <div>{intl.formatMessage({ id: 'share_embed_video' })}</div>
                                <button type="button" className="video-share-mobile-close" onClick={onClearShareEmbedCode}>
                                    <img src={shareCloseIcon} alt={intl.formatMessage({ id: 'close' })} />
                                </button>
                            </div>
                            <div className="video-share-mobile-embed-body">
                                <div className="video-share-mobile-embed-box">
                                    <div className="video-share-mobile-embed-code">{shareEmbedCode}</div>
                                    <div className="video-share-mobile-embed-toggle" onClick={onToggleShareShowControls}>
                                        <div className={cn('video-share-mobile-checkbox', shareShowControls && 'is-checked')} />
                                        <label>{intl.formatMessage({ id: 'share_show_player_controls' })}</label>
                                    </div>
                                </div>
                                <button type="button" className="video-share-mobile-copy-btn" onClick={() => void onCopyEmbedCode()}>
                                    {intl.formatMessage({ id: 'copy' })}
                                </button>
                            </div>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    );
}
