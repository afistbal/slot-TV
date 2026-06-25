import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import { api, type IPagination } from '@/api';
import shareCloseIcon from '@/assets/icons/share/close.svg';
import { useVideoPanelCloseGuard } from '@/components/video-paywall/useVideoPanelCloseGuard';
import type { VideoPaywallProduct } from '@/components/video-paywall/videoPaywallPromoTypes';
import { movieCoverUrlFromInfo } from '@/lib/movieCoverUrl';
import { resolveSubscriptionPeriod } from '@/lib/subscriptionPlanRenewText';
import { useConfigStore } from '@/stores/config';
import { useVideoShoppingProductsStore } from '@/stores/videoShoppingProducts';
import { useRootStore } from '@/stores/root';

// —— types ——

export type RetentionOffer = {
    id: number;
    name: string;
    type: number;
    discount_type: number;
    price: string;
    renewal_price: string;
};

export type RetentionPromoStep = 1 | 2 | 3;

type MembershipCover = {
    id: number;
    image: string;
};

const COUNTDOWN_SEC = 30;
const OPEN_DELAY_MS = 320;
const ANIM_MS = 20;
const SKIP_COUNTDOWN_KEY = 'video_retention_promo_skip_countdown';

// —— module store (no separate file) ——

type RetentionPromoStore = {
    offers: RetentionOffer[];
    offersReady: boolean;
    covers: MembershipCover[];
    coversReady: boolean;
};

let offersInflight: Promise<RetentionOffer[]> | null = null;
let coversInflight: Promise<MembershipCover[]> | null = null;

const retentionPromoStore = {
    state: {
        offers: [] as RetentionOffer[],
        offersReady: false,
        covers: [] as MembershipCover[],
        coversReady: false,
    } satisfies RetentionPromoStore,

    set(partial: Partial<RetentionPromoStore>) {
        Object.assign(this.state, partial);
    },
};

export function useRetentionPromoStore(): RetentionPromoStore {
    return retentionPromoStore.state;
}

async function fetchOffersOnce(): Promise<RetentionOffer[]> {
    if (retentionPromoStore.state.offersReady) {
        return retentionPromoStore.state.offers;
    }
    if (offersInflight) {
        return offersInflight;
    }
    offersInflight = api<RetentionOffer[]>('product/offers', {
        loading: false,
        toastOnError: false,
    })
        .then((res) => {
            const offers =
                res.c === 0 && Array.isArray(res.d)
                    ? (res.d as RetentionOffer[])
                    : fallbackOffers();
            retentionPromoStore.set({ offers, offersReady: true });
            return offers;
        })
        .catch(() => {
            const offers = fallbackOffers();
            retentionPromoStore.set({ offers, offersReady: true });
            return offers;
        })
        .finally(() => {
            offersInflight = null;
        });
    return offersInflight;
}

function fallbackOffers(): RetentionOffer[] {
    return [
        {
            id: 1,
            name: 'weekly',
            type: 1,
            discount_type: 1,
            price: '13.99',
            renewal_price: '24.99',
        },
        {
            id: 1,
            name: 'weekly',
            type: 1,
            discount_type: 2,
            price: '9.99',
            renewal_price: '24.99',
        },
        {
            id: 5,
            name: 'quarterly',
            type: 1,
            discount_type: 1,
            price: '49.99',
            renewal_price: '99.99',
        },
    ];
}

async function fetchMembershipCoversOnce(staticBase: string): Promise<MembershipCover[]> {
    if (retentionPromoStore.state.coversReady) {
        return retentionPromoStore.state.covers;
    }
    if (coversInflight) {
        return coversInflight;
    }
    coversInflight = api<IPagination | Record<string, unknown>[]>('feed/membership?page=1', {
        loading: false,
        toastOnError: false,
    })
        .then((res) => {
            const raw = res.c === 0 ? res.d : null;
            const rows = (
                Array.isArray(raw)
                    ? raw
                    : raw && Array.isArray((raw as IPagination).data)
                      ? (raw as IPagination).data
                      : []
            ).slice(0, 5) as Record<string, unknown>[];
            const covers = rows
                .map((row, i) => {
                    const id = Number(row.movie_id ?? row.id ?? i);
                    const url = movieCoverUrlFromInfo(staticBase, row, id);
                    if (!url) return null;
                    return { id, image: url };
                })
                .filter((c): c is MembershipCover => c != null);
            retentionPromoStore.set({ covers, coversReady: true });
            return covers;
        })
        .catch(() => {
            retentionPromoStore.set({ covers: [], coversReady: true });
            return [];
        })
        .finally(() => {
            coversInflight = null;
        });
    return coversInflight;
}

function discountPercent(discountType: number): number {
    return discountType === 1 ? 30 : 50;
}

function resolveCheckoutProductId(offer: RetentionOffer | undefined): number | null {
    if (!offer?.id) return null;
    return offer.id;
}

function readSkipCountdown(): boolean {
    try {
        return sessionStorage.getItem(SKIP_COUNTDOWN_KEY) === '1';
    } catch {
        return false;
    }
}

function markSkipCountdown() {
    try {
        sessionStorage.setItem(SKIP_COUNTDOWN_KEY, '1');
    } catch {
        // noop
    }
}

// —— UI ——

type VideoRetentionPromoLayerProps = {
    variant: 'h5' | 'pc';
    step: RetentionPromoStep;
    offer: RetentionOffer;
    covers: MembershipCover[];
    visible: boolean;
    animateIn: boolean;
    showCountdown: boolean;
    countdownSec: number;
    onDismiss: () => void;
    onCta: () => void;
};

function ConfettiDeco() {
    const pieces = [
        { left: '8%', top: '6%', color: '#ff5a5a', rot: 12 },
        { left: '18%', top: '14%', color: '#5ab0ff', rot: -18 },
        { left: '78%', top: '8%', color: '#ffd45a', rot: 24 },
        { left: '88%', top: '16%', color: '#5aff8a', rot: -8 },
        { left: '42%', top: '4%', color: '#ff5a5a', rot: 45 },
        { left: '62%', top: '12%', color: '#5ab0ff', rot: -30 },
    ];
    return (
        <div className="rs-retention-promo__confetti" aria-hidden>
            {pieces.map((p, i) => (
                <span
                    key={i}
                    className="rs-retention-promo__confettiPiece"
                    style={{
                        left: p.left,
                        top: p.top,
                        backgroundColor: p.color,
                        transform: `rotate(${p.rot}deg)`,
                    }}
                />
            ))}
        </div>
    );
}

export function VideoRetentionPromoLayer({
    variant,
    step,
    offer,
    covers,
    visible,
    animateIn,
    showCountdown,
    countdownSec,
    onDismiss,
    onCta,
}: VideoRetentionPromoLayerProps) {
    const intl = useIntl();
    const period = resolveSubscriptionPeriod(offer.name);
    const isWeekly = period === 'weekly' || String(offer.name).toLowerCase().includes('week');
    const discount = discountPercent(offer.discount_type);
    const priceLabel = `$${offer.price}`;
    const renewalLabel = `$${offer.renewal_price}`;

    const subtitleId =
        step === 2
            ? 'retention_promo_subtitle_step2'
            : step === 3
              ? 'retention_promo_subtitle_step3'
              : 'retention_promo_subtitle_step1';

    const pricingText = isWeekly
        ? intl.formatMessage(
              { id: 'retention_promo_terms_weekly' },
              { price: priceLabel, renewal: renewalLabel },
          )
        : intl.formatMessage(
              { id: 'retention_promo_terms_90days' },
              { price: priceLabel, renewal: renewalLabel },
          );

    const ctaText = intl.formatMessage(
        { id: 'retention_promo_cta_sale' },
        { price: priceLabel },
    );

    if (!visible) return null;

    const sheet = (
        <div
            className={[
                'rs-retention-promo',
                `rs-retention-promo--${variant}`,
                animateIn ? 'rs-retention-promo--open' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rs-retention-promo-title"
        >
            <button
                type="button"
                className="rs-retention-promo__backdrop"
                aria-label={intl.formatMessage({ id: 'close' })}
                onClick={onDismiss}
            />
            <div className="rs-retention-promo__sheet">
                <button
                    type="button"
                    className="rs-retention-promo__close"
                    aria-label={intl.formatMessage({ id: 'close' })}
                    onClick={onDismiss}
                >
                    <img src={shareCloseIcon} alt="" />
                </button>

                <ConfettiDeco />

                <h2 id="rs-retention-promo-title" className="rs-retention-promo__title">
                    <FormattedMessage id="retention_promo_title" />
                </h2>
                <p className="rs-retention-promo__subtitle">
                    <FormattedMessage id={subtitleId} />
                </p>

                <div className="rs-retention-promo__coupon">
                    <div className="rs-retention-promo__couponTop">
                        <span className="rs-retention-promo__couponLabel">
                            <FormattedMessage id="retention_promo_surprise_discount" />
                        </span>
                        <span className="rs-retention-promo__couponDiscount">-{discount}%</span>
                    </div>
                    <div className="rs-retention-promo__couponDivider" aria-hidden />
                    <p className="rs-retention-promo__couponPricing">{pricingText}</p>
                </div>

                <button type="button" className="rs-retention-promo__cta" onClick={onCta}>
                    {showCountdown
                        ? intl.formatMessage(
                              { id: 'retention_promo_cta_countdown' },
                              { price: priceLabel, sec: countdownSec },
                          )
                        : ctaText}
                </button>

                <div className="rs-retention-promo__shorts">
                    <h3 className="rs-retention-promo__shortsTitle">
                        <FormattedMessage id="retention_promo_vip_shorts" />
                    </h3>
                    <div className="rs-retention-promo__shortsRow">
                        {(covers.length > 0 ? covers.slice(0, 5) : Array.from({ length: 5 }, (_, i) => ({ id: i, image: '' }))).map(
                            (cover) => (
                                <div key={cover.id} className="rs-retention-promo__shortsPoster">
                                    {cover.image ? <img src={cover.image} alt="" /> : null}
                                </div>
                            ),
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return sheet;
    return createPortal(sheet, document.body);
}

// —— commerce hook ——

export type RetentionCommerceWire = {
    onVipOpenChange: (open: boolean) => void;
    onVipEmbedClose: () => void;
    checkoutRequest: { productId: number; seq: number; discount_type?: number } | null;
    onPayModalClosed: () => void;
    initialCheckoutPayment?: number;
    promoActive: boolean;
    layer: ReactNode;
};

export type UseVideoRetentionCommerceOptions = {
    variant: 'h5' | 'pc';
    viewerIsVip: boolean;
    vip: boolean;
    onVipOpenChange: (open: boolean) => void;
};

export function useVideoRetentionCommerce({
    variant,
    viewerIsVip,
    vip: _vip,
    onVipOpenChange,
}: UseVideoRetentionCommerceOptions): RetentionCommerceWire {
    const products = useVideoShoppingProductsStore((s) => s.products);
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));

    const [offers, setOffers] = useState<RetentionOffer[]>(retentionPromoStore.state.offers);
    const [covers, setCovers] = useState<MembershipCover[]>(retentionPromoStore.state.covers);

    const [step, setStep] = useState<RetentionPromoStep | null>(null);
    const [visible, setVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);
    const [checkoutRequest, setCheckoutRequest] = useState<{
        productId: number;
        seq: number;
        discount_type?: number;
    } | null>(null);
    const [initialCheckoutPayment, setInitialCheckoutPayment] = useState<number | undefined>(
        undefined,
    );
    const [countdownSec, setCountdownSec] = useState(COUNTDOWN_SEC);
    const [showCountdown, setShowCountdown] = useState(false);

    const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flowStartedRef = useRef(false);

    const { registerPanelClose, onVipOpenChangeGuarded } = useVideoPanelCloseGuard(onVipOpenChange);

    useEffect(() => {
        if (!sessionBootstrapReady) return;
        void fetchOffersOnce().then(setOffers);
        void fetchMembershipCoversOnce(staticBase).then(setCovers);
        void useVideoShoppingProductsStore.getState().fetchOnce();
    }, [sessionBootstrapReady, staticBase]);

    useEffect(
        () => () => {
            if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
            if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
        },
        [],
    );

    const clearPromo = useCallback(() => {
        setVisible(false);
        setAnimateIn(false);
        setStep(null);
        setShowCountdown(false);
        flowStartedRef.current = false;
    }, []);

    const openStep = useCallback((nextStep: RetentionPromoStep) => {
        setStep(nextStep);
        setVisible(true);
        setAnimateIn(false);
        if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
        animTimerRef.current = window.setTimeout(() => setAnimateIn(true), ANIM_MS) as unknown as ReturnType<
            typeof setTimeout
        >;
        if (nextStep === 3 && !readSkipCountdown()) {
            setShowCountdown(true);
            setCountdownSec(COUNTDOWN_SEC);
        } else {
            setShowCountdown(false);
        }
    }, []);

    const startRetentionFlow = useCallback(() => {
        if (viewerIsVip || flowStartedRef.current) return;
        flowStartedRef.current = true;
        if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
        openTimerRef.current = window.setTimeout(() => openStep(1), OPEN_DELAY_MS) as unknown as ReturnType<
            typeof setTimeout
        >;
    }, [openStep, viewerIsVip]);

    const requestPanelClose = useCallback((): boolean => {
        startRetentionFlow();
        return true;
    }, [startRetentionFlow]);

    useEffect(() => {
        registerPanelClose(requestPanelClose);
    }, [registerPanelClose, requestPanelClose]);

    const openCheckout = useCallback(
        (fromStep: RetentionPromoStep) => {
            const offer = offers[fromStep - 1];
            const productId = resolveCheckoutProductId(offer, products);
            if (import.meta.env.DEV && productId == null) {
                console.warn('[retention-promo] no matching product for step', fromStep, offer);
            }
            const paymentDefault = fromStep === 3 ? 3 : undefined;
            clearPromo();
            setInitialCheckoutPayment(paymentDefault);
            onVipOpenChange(true);
            if (productId != null) {
                setCheckoutRequest({
                    productId,
                    seq: Date.now(),
                    discount_type: offer?.discount_type,
                });
            }
        },
        [clearPromo, offers, onVipOpenChange, products],
    );

    const dismissCurrentStep = useCallback(() => {
        if (step === 1) {
            openStep(2);
            return;
        }
        if (step === 2) {
            openStep(3);
            return;
        }
        if (step === 3) {
            openCheckout(3);
        }
    }, [openCheckout, openStep, step]);

    const handleCta = useCallback(() => {
        if (!step) return;
        openCheckout(step);
    }, [openCheckout, step]);

    useEffect(() => {
        if (!showCountdown || step !== 3 || !visible) return;
        if (countdownSec <= 0) {
            openCheckout(3);
            return;
        }
        const timer = window.setTimeout(() => setCountdownSec((s) => s - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [countdownSec, openCheckout, showCountdown, step, visible]);

    const onPayModalClosed = useCallback(() => {
        if (step === 3 || flowStartedRef.current) {
            markSkipCountdown();
        }
        setCheckoutRequest(null);
        setInitialCheckoutPayment(undefined);
    }, [step]);

    const onVipEmbedClose = useCallback(() => {
        startRetentionFlow();
        onVipOpenChange(false);
    }, [onVipOpenChange, startRetentionFlow]);

    const activeOffer = step != null ? offers[step - 1] : null;
    const promoActive = step != null || checkoutRequest != null;

    const layer =
        step != null && activeOffer ? (
            <VideoRetentionPromoLayer
                variant={variant}
                step={step}
                offer={activeOffer}
                covers={covers}
                visible={visible}
                animateIn={animateIn}
                showCountdown={showCountdown}
                countdownSec={countdownSec}
                onDismiss={dismissCurrentStep}
                onCta={handleCta}
            />
        ) : null;

    return useMemo(
        () => ({
            onVipOpenChange: onVipOpenChangeGuarded,
            onVipEmbedClose,
            checkoutRequest,
            onPayModalClosed,
            initialCheckoutPayment,
            promoActive,
            layer,
        }),
        [
            checkoutRequest,
            initialCheckoutPayment,
            layer,
            onPayModalClosed,
            onVipEmbedClose,
            onVipOpenChangeGuarded,
            promoActive,
        ],
    );
}
