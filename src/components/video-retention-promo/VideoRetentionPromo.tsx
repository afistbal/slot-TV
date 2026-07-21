import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    lazy,
    Suspense,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import { api, type IPagination } from '@/api';
import shareCloseIcon from '@/assets/icons/share/close.svg';
import { useVideoPanelCloseGuard } from '@/components/video-paywall/useVideoPanelCloseGuard';
import { movieCoverUrlFromInfo } from '@/lib/movieCoverUrl';
import { resolveSubscriptionPeriod } from '@/lib/subscriptionPlanRenewText';
import { useConfigStore } from '@/stores/config';
import { useVideoShoppingProductsStore } from '@/stores/videoShoppingProducts';
import { isTikTokPlatform } from '@/platform';
import { useRootStore } from '@/stores/root';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import '@/styles/video-retention-promo.scss';

const RadixRc = lazy(() => import('@/pages/user/RadixRc'));

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

import headerBg from '@/assets/video-retention-promo/bg@2x.png';
import couponBg from '@/assets/video-retention-promo/bg_coupon@2x.png';

/** 顶部彩纸背景 / 优惠票券背景 */
export const retentionPromoAssets = {
    headerBg,
    couponBg,
} as const;

const RETENTION_PROMO_PRELOAD_LINK_PREFIX = 'slot-retention-promo-preload';
const RETENTION_ASSETS_READY_TIMEOUT_MS = 2500;

let retentionPromoAssetsReady = false;
let retentionPromoAssetsReadyPromise: Promise<void> | null = null;

function injectRetentionPromoPreloadLinks(): void {
    if (typeof document === 'undefined') return;
    for (const [suffix, href] of [
        ['header', retentionPromoAssets.headerBg],
        ['coupon', retentionPromoAssets.couponBg],
    ] as const) {
        const id = `${RETENTION_PROMO_PRELOAD_LINK_PREFIX}-${suffix}`;
        if (document.getElementById(id)) continue;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'preload';
        link.as = 'image';
        link.href = href;
        link.setAttribute('fetchpriority', 'high');
        document.head.appendChild(link);
    }
}

function loadRetentionPromoImage(src: string): Promise<void> {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.fetchPriority = 'high';
        const finish = () => resolve();
        img.onload = () => {
            void img.decode?.().finally(finish);
        };
        img.onerror = finish;
        img.src = src;
    });
}

/** 视频页与视频抢带宽时：head preload + decode，弹窗打开前尽量已就绪 */
export function ensureRetentionPromoAssetsReady(): Promise<void> {
    if (retentionPromoAssetsReady || typeof window === 'undefined') {
        return Promise.resolve();
    }
    if (retentionPromoAssetsReadyPromise) {
        return retentionPromoAssetsReadyPromise;
    }
    retentionPromoAssetsReadyPromise = (async () => {
        injectRetentionPromoPreloadLinks();
        await Promise.all([
            loadRetentionPromoImage(retentionPromoAssets.headerBg),
            loadRetentionPromoImage(retentionPromoAssets.couponBg),
        ]);
        retentionPromoAssetsReady = true;
    })().finally(() => {
        retentionPromoAssetsReadyPromise = null;
    });
    return retentionPromoAssetsReadyPromise;
}

function waitRetentionPromoAssetsReady(): Promise<void> {
    return Promise.race([
        ensureRetentionPromoAssetsReady(),
        new Promise<void>((resolve) => {
            window.setTimeout(resolve, RETENTION_ASSETS_READY_TIMEOUT_MS);
        }),
    ]);
}

/** @deprecated 使用 ensureRetentionPromoAssetsReady */
export function preloadRetentionPromoAssets(): void {
    void ensureRetentionPromoAssetsReady();
}

const retentionPromoImgProps = {
    alt: '',
    decoding: 'async' as const,
    fetchPriority: 'high' as const,
    loading: 'eager' as const,
};

/** 播放页常驻隐藏 img，避免仅 new Image() 预载被视频挤掉后弹窗再拉图 */
function RetentionPromoAssetWarmup() {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div className="rs-retention-promo__assetWarmup" aria-hidden>
            <img {...retentionPromoImgProps} src={retentionPromoAssets.headerBg} />
            <img {...retentionPromoImgProps} src={retentionPromoAssets.couponBg} />
        </div>,
        document.body,
    );
}

/** bg_coupon@2x.png 票券背景固定高度（px），不随文案撑开 */
export const RETENTION_COUPON_BG_HEIGHT_PX = 126;

function formatCountdownParts(totalSec: number): { h: string; m: string; s: string } {
    const safe = Math.max(0, totalSec);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return {
        h: String(h).padStart(2, '0'),
        m: String(m).padStart(2, '0'),
        s: String(s).padStart(2, '0'),
    };
}

function formatPerDayPrice(price: string, days: number): string {
    const n = Number.parseFloat(price);
    if (!Number.isFinite(n) || days <= 0) return '$0.00';
    const perDay = Math.floor((n / days) * 100) / 100;
    return `$${perDay.toFixed(2)}`;
}

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

function parseOffersResponse(res: { c: number; d: unknown }): RetentionOffer[] {
    if (res.c !== 0 || !Array.isArray(res.d) || res.d.length === 0) {
        return [];
    }
    return res.d as RetentionOffer[];
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
            const offers = parseOffersResponse(res);
            retentionPromoStore.set({ offers, offersReady: true });
            return offers;
        })
        .catch(() => {
            retentionPromoStore.set({ offers: [], offersReady: true });
            return [];
        })
        .finally(() => {
            offersInflight = null;
        });
    return offersInflight;
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

/** 折扣 = (renewal - price) / renewal → OFF%，再按十位四舍五入（51→50，49→50） */
function computeOfferDiscountPercent(
    offer: Pick<RetentionOffer, 'price' | 'renewal_price'>,
): number {
    const p = Number.parseFloat(offer.price);
    const r = Number.parseFloat(offer.renewal_price);
    if (!Number.isFinite(p) || !Number.isFinite(r) || r <= 0 || p >= r) {
        return 0;
    }
    const raw = ((r - p) / r) * 100;
    return Math.round(raw / 10) * 10;
}

function isWeeklyRetentionOffer(offer: RetentionOffer): boolean {
    const period = resolveSubscriptionPeriod(offer.name);
    return period === 'weekly' || String(offer.name).toLowerCase().includes('week');
}

function isQuarterlyRetentionOffer(offer: RetentionOffer): boolean {
    const period = resolveSubscriptionPeriod(offer.name);
    return period === 'quarterly' || String(offer.name).toLowerCase().includes('quarter');
}

function isRetentionDiscountType(offer: RetentionOffer, discountType: number): boolean {
    return Number(offer.discount_type) === discountType;
}

/** 按档位目标价匹配 offer，避免接口数组顺序与弹窗 step 不一致 */
function resolveRetentionOfferForStep(
    offers: RetentionOffer[],
    step: RetentionPromoStep,
): RetentionOffer | null {
    if (step === 1) {
        return offers.find((offer) => isWeeklyRetentionOffer(offer) && isRetentionDiscountType(offer, 1)) ?? null;
    }
    if (step === 2) {
        return offers.find((offer) => isWeeklyRetentionOffer(offer) && isRetentionDiscountType(offer, 2)) ?? null;
    }
    return offers.find((offer) => isQuarterlyRetentionOffer(offer) && isRetentionDiscountType(offer, 1)) ?? null;
}

function resolveNextRetentionStep(
    offers: RetentionOffer[],
    currentStep: RetentionPromoStep | null,
): RetentionPromoStep | null {
    const steps: RetentionPromoStep[] = [1, 2, 3];
    return (
        steps.find(
            (candidate) =>
                (currentStep == null || candidate > currentStep) &&
                resolveRetentionOfferForStep(offers, candidate) != null,
        ) ?? null
    );
}

function withCatalogRenewalPrice(
    offer: RetentionOffer,
    products: { id: number; renewal_price?: string }[],
): RetentionOffer {
    const product = products.find((item) => item.id === offer.id);
    if (!product?.renewal_price) return offer;
    return { ...offer, renewal_price: product.renewal_price };
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

function clearSkipCountdown() {
    try {
        sessionStorage.removeItem(SKIP_COUNTDOWN_KEY);
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

function PromoShortsRow({ covers }: { covers: MembershipCover[] }) {
    const items =
        covers.length > 0 ? covers.slice(0, 5) : Array.from({ length: 5 }, (_, i) => ({ id: i, image: '' }));
    return (
        <div className="rs-retention-promo__shorts">
            <h3 className="rs-retention-promo__shortsTitle">
                <FormattedMessage id="retention_promo_vip_shorts" />
            </h3>
            <div className="rs-retention-promo__shortsRow">
                {items.map((cover) => (
                    <div key={cover.id} className="rs-retention-promo__shortsPoster">
                        {cover.image ? <img src={cover.image} alt="" /> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PromoHeaderArt({
    step,
    subtitleId,
}: {
    step: RetentionPromoStep;
    subtitleId?: string;
}) {
    const isStep3 = step === 3;
    return (
        <div className="rs-retention-promo__headerArt">
            <img
                className="rs-retention-promo__headerBg"
                {...retentionPromoImgProps}
                src={retentionPromoAssets.headerBg}
            />
            <h2 id="rs-retention-promo-title" className="rs-retention-promo__title">
                <FormattedMessage
                    id={isStep3 ? 'retention_promo_title_step3' : 'retention_promo_title'}
                />
            </h2>
            {isStep3 ? (
                <span className="rs-retention-promo__badge">
                    <FormattedMessage id="retention_promo_badge_onetime" />
                </span>
            ) : subtitleId ? (
                <p className="rs-retention-promo__subtitle">
                    <FormattedMessage id={subtitleId} />
                </p>
            ) : null}
        </div>
    );
}

function PromoCouponCardStep12({
    discount,
    pricingContent,
}: {
    discount: number;
    pricingContent: ReactNode;
}) {
    return (
        <div className="rs-retention-promo__coupon">
            <div
                className="rs-retention-promo__couponBgFrame"
                aria-hidden
                style={{ height: RETENTION_COUPON_BG_HEIGHT_PX }}
            >
                <img
                    className="rs-retention-promo__couponBg"
                    {...retentionPromoImgProps}
                    src={retentionPromoAssets.couponBg}
                />
            </div>
            <div className="rs-retention-promo__couponInner">
                <div className="rs-retention-promo__couponTop">
                    <span className="rs-retention-promo__couponLabel notranslate" translate="no">
                        <FormattedMessage id="retention_promo_surprise_discount" />
                    </span>
                    <span
                        className="rs-retention-promo__couponDiscount notranslate"
                        translate="no"
                        aria-label={`${discount}%`}
                    >
                        {discount}
                    </span>
                </div>
                <div className="rs-retention-promo__couponDivider" aria-hidden />
                <div className="rs-retention-promo__couponPricing notranslate" translate="no">
                    {pricingContent}
                </div>
            </div>
        </div>
    );
}

function formatStep3CountdownParts(totalSec: number): { m: string; s: string } {
    const safe = Math.max(0, totalSec);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return {
        m: String(m).padStart(2, '0'),
        s: String(s).padStart(2, '0'),
    };
}

function PromoOfferCardStep3({
    offer,
    discount,
}: {
    offer: RetentionOffer;
    discount: number;
}) {
    const intl = useIntl();
    const priceLabel = `$${offer.price}`;
    const renewalLabel = `$${offer.renewal_price}`;
    const perDay = formatPerDayPrice(offer.price, 90);

    return (
        <div className="rs-retention-promo__offerCard rs-retention-promo__offerCard--step3">
            <div className="rs-retention-promo__offerCardInner">
                <h3 className="rs-retention-promo__offerCardTitle">
                    <FormattedMessage id="retention_promo_exclusive_title" />
                </h3>
                <p className="rs-retention-promo__offerCardSubtitle">
                    <FormattedMessage id="retention_promo_exclusive_subtitle" />
                </p>
                <div className="rs-retention-promo__offerCardSaveRow">
                    <span className="rs-retention-promo__offerCardWas">{renewalLabel}</span>
                    <span className="rs-retention-promo__offerCardOff">
                        {intl.formatMessage(
                            { id: 'retention_promo_off_badge' },
                            { percent: discount },
                        )}
                    </span>
                </div>
                <div className="rs-retention-promo__offerCardPriceRow">
                    <span className="rs-retention-promo__offerCardPriceAnchor">
                        <span className="rs-retention-promo__offerCardPrice">{priceLabel}</span>
                        <span className="rs-retention-promo__offerCardPeriod">
                            <FormattedMessage id="retention_promo_period_90days" />
                        </span>
                    </span>
                </div>
                <p className="rs-retention-promo__offerCardPerDay">
                    {intl.formatMessage({ id: 'retention_promo_per_day' }, { price: perDay })}
                </p>
            </div>
        </div>
    );
}

function PromoCountdownBar({
    countdownSec,
    variant = 'default',
}: {
    countdownSec: number;
    variant?: 'default' | 'step3';
}) {
    if (variant === 'step3') {
        const { m, s } = formatStep3CountdownParts(countdownSec);
        return (
            <div className="rs-retention-promo__countdown rs-retention-promo__countdown--step3">
                <span className="rs-retention-promo__countdownPill notranslate" translate="no">
                    <span className="rs-retention-promo__countdownPillPart">{m}</span>
                    <span className="rs-retention-promo__countdownPillSep" aria-hidden>
                        :
                    </span>
                    <span className="rs-retention-promo__countdownPillPart">{s}</span>
                </span>
            </div>
        );
    }

    const { h, m, s } = formatCountdownParts(countdownSec);
    return (
        <div className="rs-retention-promo__countdown">
            <span className="rs-retention-promo__countdownLine" aria-hidden />
            <div className="rs-retention-promo__countdownCore">
                <span className="rs-retention-promo__countdownLabel">
                    <FormattedMessage id="retention_promo_ends_in" />
                </span>
                <div className="rs-retention-promo__countdownDigits" aria-live="polite">
                    <span className="rs-retention-promo__countdownUnit">{h}</span>
                    <span className="rs-retention-promo__countdownSep">:</span>
                    <span className="rs-retention-promo__countdownUnit">{m}</span>
                    <span className="rs-retention-promo__countdownSep">:</span>
                    <span className="rs-retention-promo__countdownUnit">{s}</span>
                </div>
            </div>
            <span className="rs-retention-promo__countdownLine" aria-hidden />
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
    const discount = computeOfferDiscountPercent(offer);
    const priceLabel = `$${offer.price}`;
    const renewalLabel = `$${offer.renewal_price}`;

    const isStep3 = step === 3;

    const subtitleId =
        step === 2 ? 'retention_promo_subtitle_step2' : 'retention_promo_subtitle_step1';

    const pricingContent =
        step === 1 ? (
            <>
                <p className="rs-retention-promo__couponPricingLine">
                    {intl.formatMessage(
                        { id: 'retention_promo_terms_step1_line1' },
                        { price: priceLabel },
                    )}
                </p>
                <p className="rs-retention-promo__couponPricingLine">
                    {intl.formatMessage(
                        { id: 'retention_promo_terms_step1_line2' },
                        { renewal: renewalLabel },
                    )}
                </p>
            </>
        ) : step === 2 ? (
            <p className="rs-retention-promo__couponPricingLine">
                {intl.formatMessage(
                    { id: 'retention_promo_coupon_pricing_step2' },
                    { price: priceLabel },
                )}
            </p>
        ) : isWeekly ? (
            <p className="rs-retention-promo__couponPricingLine">
                {intl.formatMessage(
                    { id: 'retention_promo_terms_weekly' },
                    { price: priceLabel, renewal: renewalLabel },
                )}
            </p>
        ) : (
            <p className="rs-retention-promo__couponPricingLine">
                {intl.formatMessage(
                    { id: 'retention_promo_terms_quarterly' },
                    { price: priceLabel, renewal: renewalLabel },
                )}
            </p>
        );

    const step2Disclaimer =
        step === 2
            ? intl.formatMessage(
                  { id: 'retention_promo_terms_step2' },
                  { renewal: renewalLabel },
              )
            : null;

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
                isStep3 ? 'rs-retention-promo--step3' : '',
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
            <div
                className={[
                    'rs-retention-promo__sheet',
                    isStep3 ? 'rs-retention-promo__sheet--step3' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                <button
                    type="button"
                    className="rs-retention-promo__close"
                    aria-label={intl.formatMessage({ id: 'close' })}
                    onClick={onDismiss}
                >
                    <img src={shareCloseIcon} alt="" />
                </button>

                <PromoHeaderArt step={step} subtitleId={isStep3 ? undefined : subtitleId} />

                {isStep3 ? (
                    <PromoOfferCardStep3 offer={offer} discount={discount} />
                ) : (
                    <PromoCouponCardStep12 discount={discount} pricingContent={pricingContent} />
                )}

                {isStep3 ? (
                    <div className="rs-retention-promo__ctaStack">
                        {showCountdown ? (
                            <PromoCountdownBar countdownSec={countdownSec} variant="step3" />
                        ) : null}
                        <button type="button" className="rs-retention-promo__cta" onClick={onCta}>
                            {ctaText}
                        </button>
                    </div>
                ) : (
                    <>
                        <button type="button" className="rs-retention-promo__cta" onClick={onCta}>
                            {ctaText}
                        </button>
                        {step2Disclaimer ? (
                            <p className="rs-retention-promo__ctaDisclaimer">{step2Disclaimer}</p>
                        ) : null}
                    </>
                )}

                <PromoShortsRow covers={covers} />
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
    checkoutRequest: { productId: number; seq: number; discount_type?: number; displayPrice?: string } | null;
    /** 第三档（季卡）挽留：默认银行卡 payment=3 */
    initialCheckoutPayment?: number;
    /** Step3 可见时后台预载收银（隐藏弹层） */
    checkoutModalPrefetch?: boolean;
    onPayModalClosed: () => void;
    shouldRetainPaySessionOnClose: () => boolean;
    promoActive: boolean;
    layer: ReactNode;
};

export type RetentionCheckoutRadixRcProps = {
    retention?: RetentionCommerceWire;
    embedVideoEpisodeRowId?: number;
    onEmbedPaySuccessEpisodeDetail?: (episode: IPlayerEpisode) => void;
    vipHeaderEpisodeUnlockCoins?: number;
};

/** 挽留直连收银：不打开 VIP 抽屉，RadixRc 仅挂载以 portal 收银台（勿传 onEmbedClose） */
export function RetentionCheckoutRadixRc({
    retention,
    embedVideoEpisodeRowId,
    onEmbedPaySuccessEpisodeDetail,
    vipHeaderEpisodeUnlockCoins,
}: RetentionCheckoutRadixRcProps) {
    if (!retention?.checkoutRequest) {
        return null;
    }
    return (
        <div
            className="pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0"
            aria-hidden
        >
            <Suspense fallback={null}>
                <RadixRc
                    layout="embed"
                    productFrom="video"
                    checkoutFrom="video"
                    embedPresentation="plain"
                    checkoutRequest={retention.checkoutRequest}
                    initialCheckoutPayment={retention.initialCheckoutPayment}
                    checkoutModalPrefetch={retention.checkoutModalPrefetch}
                    onPayModalClosed={retention.onPayModalClosed}
                    shouldRetainPaySessionOnClose={retention.shouldRetainPaySessionOnClose}
                    embedVideoEpisodeRowId={embedVideoEpisodeRowId}
                    onEmbedPaySuccessEpisodeDetail={onEmbedPaySuccessEpisodeDetail}
                    headerEpisodeUnlockCoins={vipHeaderEpisodeUnlockCoins}
                />
            </Suspense>
        </div>
    );
}

export type UseVideoRetentionCommerceOptions = {
    variant: 'h5' | 'pc';
    viewerIsVip: boolean;
    vip: boolean;
    onVipOpenChange: (open: boolean) => void;
    /** 切集时重置挽留全关态，避免 locked 自动弹 VIP */
    episodeRowId?: number;
};

export function useVideoRetentionCommerce({
    variant,
    viewerIsVip,
    vip,
    onVipOpenChange,
    episodeRowId,
}: UseVideoRetentionCommerceOptions): RetentionCommerceWire {
    const isTikTok = isTikTokPlatform();
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
        displayPrice?: string;
    } | null>(null);
    const [initialCheckoutPayment, setInitialCheckoutPayment] = useState<number | undefined>(undefined);
    const [checkoutModalPrefetch, setCheckoutModalPrefetch] = useState(false);
    const [countdownSec, setCountdownSec] = useState(COUNTDOWN_SEC);
    const [showCountdown, setShowCountdown] = useState(false);
    const [flowActive, setFlowActive] = useState(false);
    /** 用户从弹窗3点X进收银后再关收银：三层全关，阻止 locked effect 再次弹 VIP */
    const [fullyDismissed, setFullyDismissed] = useState(false);

    const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flowStartedRef = useRef(false);
    const stepRef = useRef<RetentionPromoStep | null>(null);
    const checkoutFromStepRef = useRef<RetentionPromoStep | null>(null);
    const checkoutViaDismissRef = useRef(false);
    const checkoutViaCountdownRef = useRef(false);
    const countdownExhaustedRef = useRef(false);
    const countdownSecRef = useRef(countdownSec);
    const checkoutRequestRef = useRef(checkoutRequest);
    const suppressRetentionOnVipCloseRef = useRef(false);
    stepRef.current = step;
    countdownSecRef.current = countdownSec;
    checkoutRequestRef.current = checkoutRequest;

    const { registerPanelClose, onVipOpenChangeGuarded } = useVideoPanelCloseGuard(onVipOpenChange);

    /** guard 约定：handler 返回 true = 允许关抽屉；false = 拦截并保持打开 */
    const closeVipWithoutRetentionRestart = useCallback(() => {
        suppressRetentionOnVipCloseRef.current = true;
        onVipOpenChangeGuarded(false);
        suppressRetentionOnVipCloseRef.current = false;
    }, [onVipOpenChangeGuarded]);

    const shouldPrepareRetention = sessionBootstrapReady && !viewerIsVip && (vip || step != null || checkoutRequest != null);

    useEffect(() => {
        if (!shouldPrepareRetention) return;
        void fetchOffersOnce().then(setOffers);
        void fetchMembershipCoversOnce(staticBase).then(setCovers);
        void useVideoShoppingProductsStore.getState().fetchOnce();
    }, [shouldPrepareRetention, staticBase]);

    const shouldWarmRetentionAssets = sessionBootstrapReady && !viewerIsVip;

    /** 非 VIP 进播放页：head preload + 常驻隐藏 img，与视频并行但尽量先 decode */
    useEffect(() => {
        if (!shouldWarmRetentionAssets) return;
        void ensureRetentionPromoAssetsReady();
    }, [shouldWarmRetentionAssets]);

    /** VIP 抽屉打开时再拉一次（幂等），覆盖「快进快关」竞态 */
    useEffect(() => {
        if (!vip || viewerIsVip || offers.length === 0) return;
        void ensureRetentionPromoAssetsReady();
    }, [vip, viewerIsVip, offers.length]);

    useEffect(() => {
        setFullyDismissed(false);
        setFlowActive(false);
        flowStartedRef.current = false;
    }, [episodeRowId]);

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
        setFlowActive(false);
        flowStartedRef.current = false;
        countdownExhaustedRef.current = false;
    }, []);

    const openStep = useCallback((nextStep: RetentionPromoStep) => {
        setFlowActive(true);
        setStep(nextStep);
        setVisible(true);
        setAnimateIn(false);
        if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
        animTimerRef.current = window.setTimeout(() => setAnimateIn(true), ANIM_MS) as unknown as ReturnType<
            typeof setTimeout
        >;
        if (nextStep === 3 && !readSkipCountdown()) {
            countdownExhaustedRef.current = false;
            setShowCountdown(true);
            setCountdownSec(COUNTDOWN_SEC);
        } else {
            setShowCountdown(false);
        }
    }, []);

    const hidePromoForCheckout = useCallback(() => {
        setVisible(false);
        setAnimateIn(false);
    }, []);

    const startRetentionFlow = useCallback(() => {
        if (viewerIsVip || flowStartedRef.current || offers.length === 0) return;
        const firstStep = resolveNextRetentionStep(offers, null);
        setFullyDismissed(false);
        flowStartedRef.current = true;
        if (firstStep == null) {
            setFullyDismissed(true);
            return;
        }
        setFlowActive(true);
        clearSkipCountdown();
        countdownExhaustedRef.current = false;
        if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
        void waitRetentionPromoAssetsReady().finally(() => {
            if (!flowStartedRef.current) return;
            openTimerRef.current = window.setTimeout(() => openStep(firstStep), OPEN_DELAY_MS) as unknown as ReturnType<
                typeof setTimeout
            >;
        });
    }, [offers, openStep, viewerIsVip]);

    const requestPanelClose = useCallback((): boolean => {
        if (suppressRetentionOnVipCloseRef.current) {
            return true;
        }
        if (checkoutFromStepRef.current != null || checkoutRequestRef.current != null) {
            return true;
        }
        if (offers.length === 0) {
            return false;
        }
        startRetentionFlow();
        return true;
    }, [offers.length, startRetentionFlow]);

    useEffect(() => {
        registerPanelClose(requestPanelClose);
    }, [registerPanelClose, requestPanelClose]);

    /** Step3 展示时后台预载 pay/create + Card，进收银台时只 reveal 不重建 */
    useEffect(() => {
        if (step !== 3 || !visible || viewerIsVip || offers.length === 0) {
            return;
        }
        if (checkoutRequestRef.current != null) {
            return;
        }
        const offer = resolveRetentionOfferForStep(offers, 3);
        const productId = resolveCheckoutProductId(offer ?? undefined);
        if (productId == null) {
            return;
        }
        setInitialCheckoutPayment(3);
        setCheckoutModalPrefetch(true);
        setCheckoutRequest({
            productId,
            seq: Date.now(),
            discount_type: offer?.discount_type,
            displayPrice: offer?.price,
        });
    }, [step, visible, viewerIsVip, offers]);

    const openCheckout = useCallback(
        (fromStep: RetentionPromoStep, viaDismiss = false) => {
            const offer = resolveRetentionOfferForStep(offers, fromStep);
            const productId = resolveCheckoutProductId(offer ?? undefined);
            if (import.meta.env.DEV && productId != null) {
                const inCatalog = products.some((p) => p.id === productId);
                if (!inCatalog) {
                    console.warn('[retention-promo] offer id not in video products', productId, offer);
                }
            }
            setFullyDismissed(false);
            checkoutFromStepRef.current = fromStep;
            checkoutViaDismissRef.current = viaDismiss;
            hidePromoForCheckout();
            setInitialCheckoutPayment(fromStep === 3 ? 3 : undefined);

            if (
                fromStep === 3 &&
                productId != null &&
                checkoutRequestRef.current?.productId === productId
            ) {
                setCheckoutModalPrefetch(false);
                return;
            }

            setCheckoutModalPrefetch(false);
            if (productId != null) {
                setCheckoutRequest({
                    productId,
                    seq: Date.now(),
                    discount_type: offer?.discount_type,
                    displayPrice: offer?.price,
                });
            }
        },
        [hidePromoForCheckout, offers, products],
    );

    const dismissCurrentStep = useCallback(() => {
        const current = stepRef.current;
        if (!current) {
            clearPromo();
            setFullyDismissed(true);
            return;
        }

        const nextStep = resolveNextRetentionStep(offers, current);
        if (nextStep != null) {
            openStep(nextStep);
            return;
        }

        if (current === 3) {
            openCheckout(3, true);
            return;
        }

        clearPromo();
        setFullyDismissed(true);
        closeVipWithoutRetentionRestart();
    }, [clearPromo, closeVipWithoutRetentionRestart, offers, openCheckout, openStep]);

    const handleCta = useCallback(() => {
        const current = stepRef.current;
        if (!current) return;
        openCheckout(current);
    }, [openCheckout]);

    useEffect(() => {
        if (!showCountdown || step !== 3 || !visible) return;
        if (countdownSec <= 0) {
            if (countdownExhaustedRef.current || readSkipCountdown()) return;
            countdownExhaustedRef.current = true;
            markSkipCountdown();
            checkoutViaCountdownRef.current = true;
            openCheckout(3);
            return;
        }
        const timer = window.setTimeout(() => setCountdownSec((s) => s - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [countdownSec, openCheckout, showCountdown, step, visible]);

    const revealPromo = useCallback(() => {
        setVisible(true);
        setAnimateIn(false);
        if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
        animTimerRef.current = window.setTimeout(() => setAnimateIn(true), ANIM_MS) as unknown as ReturnType<
            typeof setTimeout
        >;
    }, []);

    const revealStep3AtZero = useCallback(() => {
        countdownExhaustedRef.current = true;
        markSkipCountdown();
        setStep(3);
        setVisible(true);
        setAnimateIn(false);
        setShowCountdown(true);
        setCountdownSec(0);
        if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
        animTimerRef.current = window.setTimeout(() => setAnimateIn(true), ANIM_MS) as unknown as ReturnType<
            typeof setTimeout
        >;
    }, []);

    const shouldRetainPaySessionOnClose = useCallback(() => {
        const fromStep = checkoutFromStepRef.current;
        return fromStep === 3 && !checkoutViaDismissRef.current;
    }, []);

    const onPayModalClosed = useCallback(() => {
        const restoreStep = checkoutFromStepRef.current ?? stepRef.current;
        const viaDismiss = checkoutViaDismissRef.current;
        const viaCountdown = checkoutViaCountdownRef.current;
        const hadRetentionCheckout =
            restoreStep != null || checkoutRequestRef.current != null;

        checkoutFromStepRef.current = null;
        checkoutViaDismissRef.current = false;
        checkoutViaCountdownRef.current = false;

        if (!hadRetentionCheckout) {
            if (stepRef.current != null) {
                flowStartedRef.current = true;
                closeVipWithoutRetentionRestart();
            }
            return;
        }

        flowStartedRef.current = true;
        closeVipWithoutRetentionRestart();

        if (restoreStep === 3 && viaDismiss) {
            setCheckoutRequest(null);
            setInitialCheckoutPayment(undefined);
            setCheckoutModalPrefetch(false);
            clearPromo();
            setFullyDismissed(true);
            return;
        }

        if (restoreStep === 3) {
            setCheckoutModalPrefetch(true);
            if (viaCountdown) {
                revealStep3AtZero();
                return;
            }
            if (countdownSecRef.current <= 0) {
                countdownExhaustedRef.current = true;
                markSkipCountdown();
            }
            revealPromo();
            return;
        }

        setCheckoutRequest(null);
        setInitialCheckoutPayment(undefined);
        setCheckoutModalPrefetch(false);
        if (restoreStep != null) {
            openStep(restoreStep);
        }
    }, [clearPromo, closeVipWithoutRetentionRestart, openStep, revealPromo, revealStep3AtZero]);

    const onVipEmbedClose = useCallback(() => {
        if (isTikTok) {
            // TikTok uses native Minis payment and must not enter the H5
            // retention flow when its payment drawer is dismissed.
            checkoutFromStepRef.current = null;
            checkoutViaDismissRef.current = false;
            checkoutViaCountdownRef.current = false;
            setCheckoutRequest(null);
            setInitialCheckoutPayment(undefined);
            setCheckoutModalPrefetch(false);
            clearPromo();
            setFullyDismissed(true);
            closeVipWithoutRetentionRestart();
            return;
        }
        const inCheckoutStack =
            checkoutFromStepRef.current != null || checkoutRequestRef.current != null;
        const promoInProgress = stepRef.current != null;

        checkoutFromStepRef.current = null;
        checkoutViaDismissRef.current = false;
        checkoutViaCountdownRef.current = false;
        setCheckoutRequest(null);
        setInitialCheckoutPayment(undefined);
        setCheckoutModalPrefetch(false);

        if (inCheckoutStack || promoInProgress) {
            clearPromo();
            setFullyDismissed(true);
            flowStartedRef.current = true;
            closeVipWithoutRetentionRestart();
            return;
        }

        clearPromo();
        if (offers.length > 0) {
            startRetentionFlow();
        }
        onVipOpenChange(false);
    }, [clearPromo, closeVipWithoutRetentionRestart, isTikTok, offers.length, onVipOpenChange, startRetentionFlow]);

    const activeOfferRaw = step != null ? resolveRetentionOfferForStep(offers, step) : null;
    const activeOffer =
        activeOfferRaw != null ? withCatalogRenewalPrice(activeOfferRaw, products) : null;
    const promoActive = flowActive || step != null || checkoutRequest != null || fullyDismissed;

    const layer = (
        <>
            {shouldWarmRetentionAssets ? <RetentionPromoAssetWarmup /> : null}
            {step != null && activeOffer ? (
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
            ) : null}
        </>
    );

    return useMemo(
        () => ({
            onVipOpenChange: onVipOpenChangeGuarded,
            onVipEmbedClose,
            checkoutRequest,
            initialCheckoutPayment,
            checkoutModalPrefetch,
            onPayModalClosed,
            shouldRetainPaySessionOnClose,
            promoActive,
            layer,
        }),
        [
            checkoutModalPrefetch,
            checkoutRequest,
            flowActive,
            initialCheckoutPayment,
            layer,
            onPayModalClosed,
            onVipEmbedClose,
            onVipOpenChangeGuarded,
            promoActive,
            shouldRetainPaySessionOnClose,
        ],
    );
}
