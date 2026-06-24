import { useIntl } from 'react-intl';
import shareCloseIcon from '@/assets/icons/share/close.svg';
import shareFacebookIcon from '@/assets/video/share_icon_facebook@2x.webp';
import shareLinkIcon from '@/assets/video/share_icon_link@2x.webp';
import shareTwitterIcon from '@/assets/video/share_icon_xcorp@2x.webp';
import { cn } from '@/lib/utils';
import { VideoShoppingEmbedShell } from '@/components/video-paywall/VideoShoppingEmbedShell';
import { useVideoPanelCloseGuard } from '@/components/video-paywall/useVideoPanelCloseGuard';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import type { ShareAction } from '@/components/video-player/videoPlayerConstants';

export type ForYouPlayerH5CommerceDrawersProps = {
    vip: boolean;
    onVipOpenChange: (open: boolean) => void;
    onVipEmbedClose: () => void;
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

/** For You 专用：VIP/分享抽屉，不关联 movie/episode */
export function ForYouPlayerH5CommerceDrawers({
    vip,
    onVipOpenChange,
    onVipEmbedClose,
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
}: ForYouPlayerH5CommerceDrawersProps) {
    const intl = useIntl();
    const { registerPanelClose, onVipOpenChangeGuarded } = useVideoPanelCloseGuard(onVipOpenChange);

    return (
        <>
            <Drawer open={vip} onOpenChange={onVipOpenChangeGuarded} disablePreventScroll>
                <DrawerContent
                    handler
                    className="rs-shopping-checkout-drawer rs-shopping-checkout-drawer--vipNoScroll rs-shopping-drawer-bg flex min-h-0 flex-col overflow-hidden border-t border-white/10 p-0 text-white max-h-[min(88vh,1040px)]"
                >
                    <DrawerTitle className="sr-only">
                        {intl.formatMessage({ id: 'shopping_vip_drawer_title' })}
                    </DrawerTitle>
                    <VideoShoppingEmbedShell
                        open={vip}
                        onForceClose={onVipEmbedClose}
                        onRegisterPanelClose={registerPanelClose}
                        headerEpisodeUnlockCoins={vipHeaderEpisodeUnlockCoins}
                    />
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
