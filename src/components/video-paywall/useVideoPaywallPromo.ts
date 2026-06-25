import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    acceptTierInStorage,
    clearVideoPaywallPromoPersisted,
    isOfferActive,
    loadVideoPaywallPromoPersisted,
    saveVideoPaywallPromoPersisted,
    shouldResetPromoCycle,
    type VideoPaywallPromoPersisted,
} from '@/components/video-paywall/videoPaywallPromoStorage';
import { pickVideoPaywallSubscription } from '@/components/video-paywall/videoPaywallPromoProducts';
import {
    VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY,
    VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY_RETENTION,
    VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_YEARLY,
    VIDEO_PAYWALL_PROMO_DURATION_SEC,
    type VideoPaywallModalMode,
    type VideoPaywallProduct,
    type VideoPaywallTier,
    type VideoPromoPanelState,
} from '@/components/video-paywall/videoPaywallPromoTypes';

function nowSec(): number {
    return Math.floor(Date.now() / 1000);
}

function normalizeExpiredOffers(data: VideoPaywallPromoPersisted, now: number): VideoPaywallPromoPersisted {
    let next = { ...data };
    if (next.weeklyExpiresAt != null && now >= next.weeklyExpiresAt) {
        next = { ...next, weeklyAccepted: false, weeklyExpiresAt: null };
    }
    if (next.yearlyExpiresAt != null && now >= next.yearlyExpiresAt) {
        next = { ...next, yearlyAccepted: false, yearlyExpiresAt: null };
    }
    return next;
}

function buildPanelState(
    data: VideoPaywallPromoPersisted,
    products: VideoPaywallProduct[],
    now: number,
): VideoPromoPanelState {
    const weeklyProduct = pickVideoPaywallSubscription(products, 'weekly');
    const yearlyProduct = pickVideoPaywallSubscription(products, 'yearly');

    const weekly =
        data.weeklyAccepted &&
        weeklyProduct &&
        isOfferActive(data.weeklyExpiresAt, now)
            ? { productId: weeklyProduct.id, expiresAt: data.weeklyExpiresAt! }
            : null;

    const yearly =
        data.yearlyAccepted &&
        yearlyProduct &&
        isOfferActive(data.yearlyExpiresAt, now)
            ? { productId: yearlyProduct.id, expiresAt: data.yearlyExpiresAt! }
            : null;

    const selectedProductId = yearly?.productId ?? weekly?.productId ?? null;

    return { weekly, yearly, selectedProductId };
}

function decideOfferTier(
    data: VideoPaywallPromoPersisted,
    now: number,
    hasWeeklyProduct: boolean,
    hasYearlyProduct: boolean,
): VideoPaywallTier | null {
    if (VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_YEARLY && hasYearlyProduct) {
        return 'yearly';
    }
    if (VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY && hasWeeklyProduct) {
        return 'weekly';
    }
    if (data.openCount <= 0) {
        return 'weekly';
    }
    if (data.openCount === 1) {
        return 'yearly';
    }
    const yearlyActive = isOfferActive(data.yearlyExpiresAt, now);
    const weeklyActive = isOfferActive(data.weeklyExpiresAt, now);
    if (data.openCount >= 2 && yearlyActive && !weeklyActive) {
        return 'weekly';
    }
    // 两个优惠都过期后，重新从周卡优惠开始
    if (data.openCount >= 2 && !yearlyActive && !weeklyActive) {
        return 'weekly';
    }
    return null;
}

function tierToOfferMode(tier: VideoPaywallTier): VideoPaywallModalMode {
    return tier === 'weekly' ? 'weekly-offer' : 'yearly-offer';
}

function getRetentionTier(data: VideoPaywallPromoPersisted, now: number): VideoPaywallTier | null {
    if (isOfferActive(data.yearlyExpiresAt, now)) {
        return 'yearly';
    }
    if (isOfferActive(data.weeklyExpiresAt, now)) {
        return 'weekly';
    }
    return null;
}

function ensureTierActivated(
    data: VideoPaywallPromoPersisted,
    tier: VideoPaywallTier,
    now: number,
): VideoPaywallPromoPersisted {
    const expiresAt = tier === 'weekly' ? data.weeklyExpiresAt : data.yearlyExpiresAt;
    if (isOfferActive(expiresAt, now)) {
        return data;
    }
    return acceptTierInStorage(data, tier, now, VIDEO_PAYWALL_PROMO_DURATION_SEC);
}

export type UseVideoPaywallPromoOptions = {
    open: boolean;
    products: VideoPaywallProduct[];
    onForceClose: () => void;
    onStartCheckout: (productId: number) => void;
};

export function useVideoPaywallPromo({
    open,
    products,
    onForceClose,
    onStartCheckout,
}: UseVideoPaywallPromoOptions) {
    const [modalMode, setModalMode] = useState<VideoPaywallModalMode>(null);
    const [panelState, setPanelState] = useState<VideoPromoPanelState>({
        weekly: null,
        yearly: null,
        selectedProductId: null,
    });

    const sessionOpenedRef = useRef(false);
    const retentionShownRef = useRef(false);

    const weeklyProduct = useMemo(
        () => pickVideoPaywallSubscription(products, 'weekly'),
        [products],
    );
    const yearlyProduct = useMemo(
        () => pickVideoPaywallSubscription(products, 'yearly'),
        [products],
    );

    const syncPanelState = useCallback(
        (data: VideoPaywallPromoPersisted, now = nowSec()) => {
            setPanelState(buildPanelState(data, products, now));
        },
        [products],
    );

    const refreshFromStorage = useCallback(() => {
        const now = nowSec();
        let data = loadVideoPaywallPromoPersisted();

        if (shouldResetPromoCycle(data, now)) {
            clearVideoPaywallPromoPersisted();
            data = loadVideoPaywallPromoPersisted();
        } else {
            data = normalizeExpiredOffers(data, now);
            saveVideoPaywallPromoPersisted(data);
        }

        syncPanelState(data, now);
        return data;
    }, [syncPanelState]);

    useEffect(() => {
        if (!open) {
            sessionOpenedRef.current = false;
            retentionShownRef.current = false;
            setModalMode(null);
            return;
        }

        if (sessionOpenedRef.current) {
            return;
        }

        let data = refreshFromStorage();
        const now = nowSec();

        if (VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY_RETENTION && weeklyProduct) {
            data = ensureTierActivated(data, 'weekly', now);
            saveVideoPaywallPromoPersisted(data);
            syncPanelState(data, now);
            setModalMode('weekly-retention');
            sessionOpenedRef.current = true;
            return;
        }

        const offerTier = decideOfferTier(data, now, Boolean(weeklyProduct), Boolean(yearlyProduct));

        if (!offerTier) {
            // 本轮无新优惠可展示；商品未就绪时不标记 session，避免商品到了仍不弹
            if (weeklyProduct || yearlyProduct) {
                sessionOpenedRef.current = true;
            }
            return;
        }

        const productForTier = offerTier === 'weekly' ? weeklyProduct : yearlyProduct;
        if (!weeklyProduct && !yearlyProduct) {
            // 商品列表尚未加载，等 products 到了再弹
            return;
        }
        const resolvedTier: VideoPaywallTier =
            productForTier != null ? offerTier : weeklyProduct ? 'weekly' : 'yearly';
        const resolvedProduct = productForTier ?? weeklyProduct ?? yearlyProduct;
        if (!resolvedProduct) {
            return;
        }

        data = ensureTierActivated(data, resolvedTier, now);
        saveVideoPaywallPromoPersisted(data);
        syncPanelState(data, now);
        setModalMode(tierToOfferMode(resolvedTier));

        const nextData = {
            ...data,
            openCount: VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY ||
                VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY_RETENTION ||
                VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_YEARLY
                ? data.openCount
                : data.openCount + 1,
        };
        saveVideoPaywallPromoPersisted(nextData);
        syncPanelState(nextData, now);
        sessionOpenedRef.current = true;
    }, [open, weeklyProduct, yearlyProduct, refreshFromStorage, syncPanelState]);

    const dismissPromoModal = useCallback(() => {
        setModalMode(null);
        syncPanelState(loadVideoPaywallPromoPersisted());
    }, [syncPanelState]);

    const requestPanelClose = useCallback((): boolean => {
        if (modalMode) {
            dismissPromoModal();
            return false;
        }

        const now = nowSec();
        const data = loadVideoPaywallPromoPersisted();
        const tier = getRetentionTier(data, now);

        if (tier && !retentionShownRef.current) {
            setModalMode(tier === 'weekly' ? 'weekly-retention' : 'yearly-retention');
            retentionShownRef.current = true;
            return false;
        }

        onForceClose();
        return true;
    }, [dismissPromoModal, modalMode, onForceClose]);

    const handleOfferDismiss = useCallback(
        (_tier: VideoPaywallTier) => {
            dismissPromoModal();
        },
        [dismissPromoModal],
    );

    const handleOfferCta = useCallback(
        (tier: VideoPaywallTier) => {
            dismissPromoModal();
            const product = tier === 'weekly' ? weeklyProduct : yearlyProduct;
            if (product) {
                onStartCheckout(product.id);
            }
        },
        [dismissPromoModal, onStartCheckout, weeklyProduct, yearlyProduct],
    );

    const handleRetentionContinue = useCallback(
        (tier: VideoPaywallTier) => {
            dismissPromoModal();
            const product = tier === 'weekly' ? weeklyProduct : yearlyProduct;
            if (product) {
                onStartCheckout(product.id);
            }
        },
        [dismissPromoModal, onStartCheckout, weeklyProduct, yearlyProduct],
    );

    const handleRetentionGiveUp = useCallback(() => {
        dismissPromoModal();
    }, [dismissPromoModal]);

    const activeModalTier: VideoPaywallTier | null = useMemo(() => {
        if (!modalMode) {
            return null;
        }
        return modalMode.startsWith('weekly') ? 'weekly' : 'yearly';
    }, [modalMode]);

    const activeModalProduct =
        activeModalTier === 'weekly'
            ? weeklyProduct
            : activeModalTier === 'yearly'
              ? yearlyProduct
              : null;

    const modalExpiresAt = useMemo(() => {
        if (!modalMode?.includes('retention') || !activeModalTier) {
            return null;
        }
        const now = nowSec();
        const stored = loadVideoPaywallPromoPersisted();
        const expiresAt =
            activeModalTier === 'weekly' ? stored.weeklyExpiresAt : stored.yearlyExpiresAt;
        return expiresAt != null && isOfferActive(expiresAt, now) ? expiresAt : null;
    }, [modalMode, activeModalTier, panelState]);

    return {
        modalMode,
        panelState,
        weeklyProduct,
        yearlyProduct,
        activeModalProduct,
        activeModalTier,
        modalExpiresAt,
        requestPanelClose,
        handleOfferDismiss,
        handleOfferCta,
        handleRetentionContinue,
        handleRetentionGiveUp,
        refreshFromStorage,
    };
}

