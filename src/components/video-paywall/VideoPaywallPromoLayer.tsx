import { FormattedMessage, useIntl } from 'react-intl';
import { formatSubscriptionPlanRenewText } from '@/lib/subscriptionPlanRenewText';
import { videoPaywallPromoAssets } from '@/components/video-paywall/videoPaywallPromoAssets';
import {
    computeSaveAmount,
    VideoPaywallPromoCountdown,
} from '@/components/video-paywall/VideoPaywallCountdown';
import type { VideoPaywallModalMode, VideoPaywallProduct, VideoPaywallTier } from '@/components/video-paywall/videoPaywallPromoTypes';
import {
    computePerDayPrice,
    weeklyOfferTitleId,
} from '@/components/video-paywall/videoPaywallPromoUtils';

type VideoPaywallPromoLayerProps = {
    modalMode: VideoPaywallModalMode;
    product: VideoPaywallProduct | null;
    tier: VideoPaywallTier | null;
    modalExpiresAt: number | null;
    onOfferDismiss: (tier: VideoPaywallTier) => void;
    onOfferCta: (tier: VideoPaywallTier) => void;
    onRetentionContinue: (tier: VideoPaywallTier) => void;
    onRetentionGiveUp: () => void;
};

function offerTitleId(
    tier: VideoPaywallTier,
    isRetention: boolean,
    product: VideoPaywallProduct,
): string {
    if (isRetention) {
        return tier === 'weekly'
            ? 'video_promo_weekly_retention_title'
            : 'video_promo_yearly_retention_title';
    }
    if (tier === 'weekly') {
        return weeklyOfferTitleId(product);
    }
    return 'video_promo_yearly_offer_title';
}

function offerCtaId(tier: VideoPaywallTier, isRetention: boolean): string {
    if (isRetention) {
        return tier === 'weekly'
            ? 'video_promo_weekly_retention_cta'
            : 'video_promo_yearly_retention_cta';
    }
    return tier === 'weekly' ? 'video_promo_weekly_offer_cta' : 'video_promo_yearly_offer_cta';
}

type PromoCardBodyProps = {
    tier: VideoPaywallTier;
    product: VideoPaywallProduct;
    isRetention: boolean;
    modalExpiresAt: number | null;
    onOfferCta: (tier: VideoPaywallTier) => void;
    onRetentionContinue: (tier: VideoPaywallTier) => void;
    onRetentionGiveUp: () => void;
};

function PromoCardBody({
    tier,
    product,
    isRetention,
    modalExpiresAt,
    onOfferCta,
    onRetentionContinue,
    onRetentionGiveUp,
}: PromoCardBodyProps) {
    const intl = useIntl();
    const isWeekly = tier === 'weekly';
    const priceLabel = `$${product.price}`;
    const saveAmount = computeSaveAmount(product.price, product.renewal_price);
    const perDayLabel = `$${computePerDayPrice(product.price, tier)}`;
    const renewText = formatSubscriptionPlanRenewText(intl, {
        price: product.price,
        renewal_price: product.renewal_price,
        planName: product.name,
    });

    return (
        <>
            <h2 id="rs-video-promo-title" className="rs-video-promo__title">
                <FormattedMessage id={offerTitleId(tier, isRetention, product)} />
            </h2>

            <p className="rs-video-promo__subtitle">{renewText}</p>

            <div className="rs-video-promo__priceCard">
                <div className="rs-video-promo__priceMain">
                    <div className="rs-video-promo__priceValue tabular-nums">{priceLabel}</div>
                    <div className="rs-video-promo__priceHint">
                        <FormattedMessage
                            id={isWeekly ? 'video_promo_first_week_hint' : 'video_promo_first_year_hint'}
                        />
                    </div>
                </div>
                <div className="rs-video-promo__priceAside">
                    {saveAmount !== '0' ? (
                        <div className="rs-video-promo__save">
                            <FormattedMessage
                                id="video_promo_save_amount"
                                values={{ amount: `$${saveAmount}` }}
                            />
                        </div>
                    ) : null}
                    <div className="rs-video-promo__limited tabular-nums">
                        <FormattedMessage id="video_promo_per_day" values={{ price: perDayLabel }} />
                    </div>
                </div>
            </div>

            {isRetention && modalExpiresAt ? (
                <VideoPaywallPromoCountdown expiresAt={modalExpiresAt} />
            ) : null}

            <div className="rs-video-promo__ctaWrap">
                <button
                    type="button"
                    className="rs-video-promo__cta"
                    onClick={() => (isRetention ? onRetentionContinue(tier) : onOfferCta(tier))}
                >
                    <FormattedMessage
                        id={offerCtaId(tier, isRetention)}
                        values={{ price: priceLabel }}
                    />
                </button>
            </div>

            {!isRetention ? (
                <p className="rs-video-promo__footnote">
                    <FormattedMessage id="video_promo_auto_renew" />
                </p>
            ) : (
                <button type="button" className="rs-video-promo__giveUp" onClick={onRetentionGiveUp}>
                    <FormattedMessage id="video_promo_give_up" />
                </button>
            )}
        </>
    );
}

function WeeklyPromoCard({
    product,
    isRetention,
    modalExpiresAt,
    onOfferDismiss,
    onOfferCta,
    onRetentionContinue,
    onRetentionGiveUp,
}: {
    product: VideoPaywallProduct;
    isRetention: boolean;
    modalExpiresAt: number | null;
    onOfferDismiss: (tier: VideoPaywallTier) => void;
    onOfferCta: (tier: VideoPaywallTier) => void;
    onRetentionContinue: (tier: VideoPaywallTier) => void;
    onRetentionGiveUp: () => void;
}) {
    const intl = useIntl();

    const dismissModal = () => {
        if (isRetention) {
            onRetentionGiveUp();
        } else {
            onOfferDismiss('weekly');
        }
    };

    return (
        <div
            className="rs-video-promo__card rs-video-promo--weekly"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rs-video-promo-title"
        >
            <div
                className="rs-video-promo__weeklyBg"
                style={{ '--rs-weekly-card-bg': `url(${videoPaywallPromoAssets.cardBg})` } as React.CSSProperties}
                aria-hidden
            />

            <div className="rs-video-promo__weeklyRibbon" aria-hidden>
                <img
                    className="rs-video-promo__weeklyRibbonImg"
                    src={videoPaywallPromoAssets.weeklyRibbon}
                    alt=""
                />
            </div>

            <div className="rs-video-promo__content rs-video-promo__content--weekly">
                <PromoCardBody
                    tier="weekly"
                    product={product}
                    isRetention={isRetention}
                    modalExpiresAt={modalExpiresAt}
                    onOfferCta={onOfferCta}
                    onRetentionContinue={onRetentionContinue}
                    onRetentionGiveUp={onRetentionGiveUp}
                />
            </div>

            <button
                type="button"
                className="rs-video-promo__closeFab"
                aria-label={intl.formatMessage({ id: 'close' })}
                onClick={dismissModal}
            >
                <img
                    className="rs-video-promo__closeFabImg"
                    src={videoPaywallPromoAssets.closeIcon}
                    alt=""
                />
            </button>
        </div>
    );
}

function YearlyPromoCard({
    product,
    isRetention,
    modalExpiresAt,
    onOfferDismiss,
    onOfferCta,
    onRetentionContinue,
    onRetentionGiveUp,
}: {
    product: VideoPaywallProduct;
    isRetention: boolean;
    modalExpiresAt: number | null;
    onOfferDismiss: (tier: VideoPaywallTier) => void;
    onOfferCta: (tier: VideoPaywallTier) => void;
    onRetentionContinue: (tier: VideoPaywallTier) => void;
    onRetentionGiveUp: () => void;
}) {
    const intl = useIntl();

    const dismissModal = () => {
        if (isRetention) {
            onRetentionGiveUp();
        } else {
            onOfferDismiss('yearly');
        }
    };

    return (
        <div
            className="rs-video-promo__card rs-video-promo--yearly"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rs-video-promo-title"
        >
            <div className="rs-video-promo__yearlyHeader" aria-hidden />
            <div className="rs-video-promo__yearlyBody" aria-hidden />

            <div className="rs-video-promo__yearlyDeco" aria-hidden>
                <img
                    className="rs-video-promo__yearlyDecoImg"
                    src={videoPaywallPromoAssets.yearlyDeco}
                    alt=""
                />
            </div>

            <div className="rs-video-promo__content rs-video-promo__content--yearly">
                <PromoCardBody
                    tier="yearly"
                    product={product}
                    isRetention={isRetention}
                    modalExpiresAt={modalExpiresAt}
                    onOfferCta={onOfferCta}
                    onRetentionContinue={onRetentionContinue}
                    onRetentionGiveUp={onRetentionGiveUp}
                />
            </div>

            <button
                type="button"
                className="rs-video-promo__closeFab"
                aria-label={intl.formatMessage({ id: 'close' })}
                onClick={dismissModal}
            >
                <img
                    className="rs-video-promo__closeFabImg"
                    src={videoPaywallPromoAssets.closeIcon}
                    alt=""
                />
            </button>
        </div>
    );
}

export function VideoPaywallPromoLayer({
    modalMode,
    product,
    tier,
    modalExpiresAt,
    onOfferDismiss,
    onOfferCta,
    onRetentionContinue,
    onRetentionGiveUp,
}: VideoPaywallPromoLayerProps) {
    if (!modalMode || !tier || !product) {
        return null;
    }

    const isRetention = modalMode.includes('retention');

    return (
        <div className="rs-video-promo" role="presentation">
            {tier === 'weekly' ? (
                <WeeklyPromoCard
                    product={product}
                    isRetention={isRetention}
                    modalExpiresAt={modalExpiresAt}
                    onOfferDismiss={onOfferDismiss}
                    onOfferCta={onOfferCta}
                    onRetentionContinue={onRetentionContinue}
                    onRetentionGiveUp={onRetentionGiveUp}
                />
            ) : (
                <YearlyPromoCard
                    product={product}
                    isRetention={isRetention}
                    modalExpiresAt={modalExpiresAt}
                    onOfferDismiss={onOfferDismiss}
                    onOfferCta={onOfferCta}
                    onRetentionContinue={onRetentionContinue}
                    onRetentionGiveUp={onRetentionGiveUp}
                />
            )}
        </div>
    );
}
