import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RadixRc, { type RadixRcProps } from '@/pages/user/RadixRc';
import { VideoPaywallPromoLayer } from '@/components/video-paywall/VideoPaywallPromoLayer';
import { useVideoPaywallPromo } from '@/components/video-paywall/useVideoPaywallPromo';
import { useVideoShoppingProductsStore } from '@/stores/videoShoppingProducts';
import { cn } from '@/lib/utils';

export type VideoShoppingEmbedShellProps = {
    open: boolean;
    onForceClose: () => void;
    scrollClassName?: string;
    onRegisterPanelClose?: (handler: () => boolean) => void;
} & Omit<RadixRcProps, 'onEmbedClose' | 'productFrom' | 'checkoutFrom'>;

export function VideoShoppingEmbedShell({
    open,
    onForceClose,
    scrollClassName,
    onRegisterPanelClose,
    ...radixProps
}: VideoShoppingEmbedShellProps) {
    const products = useVideoShoppingProductsStore((s) => s.products);
    const [checkoutRequest, setCheckoutRequest] = useState<{
        productId: number;
        seq: number;
    } | null>(null);

    const onStartCheckout = useCallback((productId: number) => {
        setCheckoutRequest({ productId, seq: Date.now() });
    }, []);

    const promo = useVideoPaywallPromo({
        open,
        products,
        onForceClose,
        onStartCheckout,
    });

    const requestPanelCloseRef = useRef(promo.requestPanelClose);
    requestPanelCloseRef.current = promo.requestPanelClose;

    useEffect(() => {
        onRegisterPanelClose?.(() => requestPanelCloseRef.current());
    }, [onRegisterPanelClose, promo.requestPanelClose]);

    const scrollClasses = useMemo(
        () =>
            cn(
                'rs-shopping-checkout-drawer__scroll rs-shopping-checkout-drawer__scroll--reelshort flex min-h-0 flex-1 flex-col relative',
                scrollClassName,
            ),
        [scrollClassName],
    );

    return (
        <div className={scrollClasses}>
            {open ? (
                <>
                    <RadixRc
                        {...radixProps}
                        layout="embed"
                        productFrom="video"
                        checkoutFrom="video"
                        onEmbedClose={promo.requestPanelClose}
                        videoPromo={promo.panelState}
                        checkoutRequest={checkoutRequest}
                    />
                    <VideoPaywallPromoLayer
                        modalMode={promo.modalMode}
                        product={promo.activeModalProduct}
                        tier={promo.activeModalTier}
                        modalExpiresAt={promo.modalExpiresAt}
                        onOfferDismiss={promo.handleOfferDismiss}
                        onOfferCta={promo.handleOfferCta}
                        onRetentionContinue={promo.handleRetentionContinue}
                        onRetentionGiveUp={promo.handleRetentionGiveUp}
                    />
                </>
            ) : null}
        </div>
    );
}
