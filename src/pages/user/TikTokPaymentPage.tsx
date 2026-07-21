import { useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { refreshSessionFromStoredToken } from '@/lib/refreshSessionFromStoredToken';
import {
    createTikTokPayOrder,
    fetchTikTokPayProducts,
    payTikTokOrder,
    type TikTokPayProduct,
} from '@/lib/tiktokMinisPayment';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { BRAND_COIN_ICON_SRC as coinIcon } from '@/constants/brand';
import iconSuccessful from '@/assets/icons/shopping-pay/icon_successful.png';
import '@/styles/shopping-reelshort.scss';

export type TikTokPaymentPageProps = {
    layout?: 'page' | 'embed';
    onEmbedClose?: () => void;
    embedVideoEpisodeRowId?: number;
    onEmbedPaySuccessEpisodeDetail?: (episode: IPlayerEpisode) => void;
};

type PaymentState = 'idle' | 'loading' | 'processing' | 'success' | 'failed';

function productBeans(product: TikTokPayProduct): number {
    const value = Number(product.coin ?? product.beans ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function productPrice(product: TikTokPayProduct): string {
    const value = Number(product.price);
    if (Number.isFinite(value)) return `$${value.toFixed(2)}`;
    return product.price ? `$${product.price}` : '--';
}

function productBonusCoins(product: TikTokPayProduct): number {
    const baseCoin = productBeans(product);
    const bonusRate = Number(product.bonus ?? 0);
    return baseCoin > 0 && Number.isFinite(bonusRate)
        ? Math.round(baseCoin * bonusRate)
        : 0;
}

export default function TikTokPaymentPage({
    layout = 'page',
    onEmbedClose,
    embedVideoEpisodeRowId,
    onEmbedPaySuccessEpisodeDetail,
}: TikTokPaymentPageProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const [products, setProducts] = useState<TikTokPayProduct[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [state, setState] = useState<PaymentState>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        let alive = true;
        void fetchTikTokPayProducts()
            .then((items) => {
                if (!alive) return;
                setProducts(items);
                setSelectedId(items[0]?.id ?? null);
                setState('idle');
            })
            .catch((error: unknown) => {
                if (!alive) return;
                setMessage(error instanceof Error ? error.message : 'Unable to load payment products.');
                setState('failed');
            });
        return () => {
            alive = false;
        };
    }, []);

    const selectedProduct = useMemo(
        () => products.find((product) => product.id === selectedId) ?? null,
        [products, selectedId],
    );
    const tipSiteValues = useMemo(
        () => ({ site: intl.formatMessage({ id: 'site_name', defaultMessage: 'YogoShort' }) }),
        [intl],
    );

    function handleDone() {
        if (onEmbedClose) {
            onEmbedClose();
            return;
        }
        if (typeof window !== 'undefined' && window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/profile');
    }

    async function unlockEpisodeAfterPayment() {
        await refreshSessionFromStoredToken();
        if (layout !== 'embed' || !embedVideoEpisodeRowId || embedVideoEpisodeRowId <= 0) return;

        const result = await api<IPlayerEpisode>('movie/episode', {
            data: {
                id: embedVideoEpisodeRowId,
                auto_unlock: 1,
            },
            loading: false,
            toastOnError: false,
        });
        if (result.c === 0) onEmbedPaySuccessEpisodeDetail?.(result.d);
    }

    async function handlePay() {
        if (!selectedProduct || state === 'processing' || state === 'loading') return;
        setState('processing');
        setMessage('');
        try {
            const order = await createTikTokPayOrder(selectedProduct.id);
            await payTikTokOrder(order);
            await unlockEpisodeAfterPayment();
            setState('success');
            setMessage(`Added ${productBeans(selectedProduct).toLocaleString()} Beans.`);
        } catch (error: unknown) {
            setState('failed');
            setMessage(error instanceof Error ? error.message : 'Payment failed.');
        }
    }

    useEffect(() => {
        if (state !== 'success' || !onEmbedClose) return;
        const timer = window.setTimeout(onEmbedClose, 2000);
        return () => window.clearTimeout(timer);
    }, [state, onEmbedClose]);

    return (
        <div className="rs-shopping rs-shopping--topUpH5">
            <div className="rs-shopping__scroll">
                <div className="rs-shopping__main px-4 py-4">
                    <div className="rs-shopping__intro">
                        <h1 className="rs-shopping__sectionTitle">Coins</h1>
                    </div>
                    <div className="rs-shopping__coinSection mt-0 w-full shadow-none">
                        <div className="grid w-full grid-cols-2 gap-2 shadow-none md:grid-cols-4">
                            {products.map((product) => {
                                const beans = productBeans(product);
                                const bonusRate = Number(product.bonus) || 0;
                                const bonusCoins = productBonusCoins(product);
                                const bonusPercent = bonusRate > 0 ? Math.round(bonusRate * 100) : 0;
                                const selected = selectedId === product.id;
                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedId(product.id);
                                            setState('idle');
                                            setMessage('');
                                        }}
                                        className={cn(
                                            'rs-shopping__coinSku relative flex w-full cursor-pointer flex-col shadow-none',
                                            'outline-none focus-visible:outline-none',
                                            'rs-shopping__coinSku--topUpH5',
                                            selected && 'rs-shopping__coinSku--selected',
                                        )}
                                    >
                                        {bonusPercent > 0 ? (
                                            <div className="rs-shopping__coinSkuBadge">
                                                +{bonusPercent}%
                                            </div>
                                        ) : null}
                                        <div className="rs-shopping__coinSkuBody">
                                            <div className="rs-shopping__coinSkuAmount">
                                                <img src={coinIcon} alt="" aria-hidden="true" />
                                                <span className="tabular-nums">{beans.toLocaleString()}</span>
                                            </div>
                                            {bonusCoins > 0 ? (
                                                <p className="rs-shopping__coinSkuBonus tabular-nums">
                                                    +{bonusCoins.toLocaleString()}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="rs-shopping__coinSkuPrice tabular-nums">
                                            {productPrice(product)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="rs-shopping__pay rs-shopping__pay--tiktok">
                        {state === 'loading' ? (
                            <div className="py-3 text-center text-white/60" aria-busy="true">
                                Loading products...
                            </div>
                        ) : null}

                        {state === 'idle' || state === 'processing' ? (
                            <button
                                type="button"
                                disabled={!selectedProduct || state === 'processing'}
                                onClick={() => void handlePay()}
                                className="rs-shopping__payStatusRetryBtn disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {state === 'processing' ? 'Processing payment...' : 'Pay with TikTok'}
                            </button>
                        ) : null}

                        {state === 'success' ? (
                            <div className="rs-shopping__payStatusPanel rs-shopping__payStatusPanel--processing rs-shopping__payStatusPanel--success">
                                <div className="rs-shopping__payStatusLead">
                                    <div className="rs-shopping__payStatusLeadTitle">
                                        <FormattedMessage
                                            id="shopping_pay_status_success"
                                            defaultMessage="Payment successful"
                                        />
                                    </div>
                                </div>
                                <img
                                    className="rs-shopping__payStatusSuccessIcon"
                                    src={iconSuccessful}
                                    alt=""
                                    aria-hidden="true"
                                />
                                <p className="rs-shopping__payStatusDesc">
                                    <FormattedMessage
                                        id="shopping_pay_status_patience"
                                        defaultMessage="Thank you for your patience!"
                                    />
                                </p>
                                {!onEmbedClose ? (
                                    <button
                                        type="button"
                                        className="rs-shopping__payStatusRetryBtn"
                                        onClick={handleDone}
                                    >
                                        Done
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {state === 'failed' ? (
                            <div className="rs-shopping__payStatusPanel rs-shopping__payStatusPanel--failed">
                                <div className="rs-shopping__payStatusTitle">
                                    <FormattedMessage
                                        id="shopping_pay_status_failed"
                                        defaultMessage="Payment failed"
                                    />
                                </div>
                                <p className="rs-shopping__payStatusDesc">
                                    <FormattedMessage
                                        id="shopping_pay_status_failed_desc"
                                        defaultMessage="Please try to make the payment again"
                                    />
                                </p>
                                {message && products.length === 0 ? (
                                    <p className="rs-shopping__payStatusLeadBody">{message}</p>
                                ) : null}
                                <button
                                    type="button"
                                    className="rs-shopping__payStatusRetryBtn"
                                    onClick={() => {
                                        setMessage('');
                                        setState('idle');
                                    }}
                                >
                                    <FormattedMessage
                                        id="shopping_pay_status_return"
                                        defaultMessage="Return to payment page"
                                    />
                                </button>
                            </div>
                        ) : null}
                    </div>
                    <section className="rs-shopping__tipsSection" aria-labelledby="shopping__tipTitle">
                        <h2 id="rs-shopping-tips-title" className="rs-shopping__tipTitle">
                            <FormattedMessage
                                id="shopping_section_tips"
                                defaultMessage="Recharge Instructions"
                            />
                        </h2>
                        <ol className="rs-shopping__tipsList">
                            {([1, 2, 3, 4] as const).map((n) => (
                                <li key={n}>
                                    <FormattedMessage id={`shopping_tips_item_${n}`} values={tipSiteValues} />
                                </li>
                            ))}
                        </ol>
                        <div className="rs-shopping__tipsAgreements">
                            <LegalDocumentLink
                                title="membership_agreement"
                                className="rs-shopping__tipsAgreementLink"
                            >
                                <FormattedMessage
                                    id="shopping_tips_link_membership"
                                    defaultMessage="Membership Agreement"
                                />
                            </LegalDocumentLink>
                            <span className="rs-shopping__tipsAgreementsSep" aria-hidden="true">|</span>
                            <LegalDocumentLink title="terms_of_service" className="rs-shopping__tipsAgreementLink">
                                <FormattedMessage id="terms_of_service" defaultMessage="Terms of Service" />
                            </LegalDocumentLink>
                            <span className="rs-shopping__tipsAgreementsSep" aria-hidden="true">|</span>
                            <LegalDocumentLink title="payment_agreement" className="rs-shopping__tipsAgreementLink">
                                <FormattedMessage
                                    id="shopping_tips_link_payment"
                                    defaultMessage="Payment Agreement"
                                />
                            </LegalDocumentLink>
                            <span className="rs-shopping__tipsAgreementsSep" aria-hidden="true">|</span>
                            <LegalDocumentLink title="refund_policy" className="rs-shopping__tipsAgreementLink">
                                <FormattedMessage
                                    id="shopping_tips_link_refund"
                                    defaultMessage="Refund Policy"
                                />
                            </LegalDocumentLink>
                            <span className="rs-shopping__tipsAgreementsSep" aria-hidden="true">|</span>
                            <LegalDocumentLink title="privacy_policy" className="rs-shopping__tipsAgreementLink">
                                <FormattedMessage
                                    id="shopping_tips_link_privacy"
                                    defaultMessage="Privacy Policy"
                                />
                            </LegalDocumentLink>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
