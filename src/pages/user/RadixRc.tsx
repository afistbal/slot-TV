import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import {
    airwallexEnsureShoppingWalletInit,
    airwallexRunShoppingWalletExclusive,
    normalizeAirwallexLocale,
} from '@/lib/airwallexShoppingWalletEmbedSingleton';
import { createElement, type ElementTypes } from '@airwallex/components-sdk';
import vipCardBg from '@/assets/images/5c3ff370-f045-11f0-84ad-6b5693b490dc.png';
import iconUnlimitedViewing from '@/assets/images/icon_unlimited_viewing.png';
import icon1080p from '@/assets/images/icon_1080p.png';
import checkedIcon from '@/assets/images/checked.png';
import btnLoadingIcon from '@/assets/images/btn_loading.svg';

import visa from '@/assets/visa.svg';
import master from '@/assets/master.svg';
import googlePay from '@/assets/google-pay.svg';
import applePay from '@/assets/apple-pay.svg';
import Countdown from '@/widgets/Countdown';
import { isApplePlatform } from '@/lib/isApplePlatform';

function paywallImage(file: string) {
    return new URL(`../../assets/images/${file}`, import.meta.url).href;
}

/** 购物/收银默认 `payment`：Apple 平台默认 Apple Pay(1)，其余默认 Google Pay(2) */
function defaultPayMethodFromUa(): 1 | 2 {
    return isApplePlatform() ? 1 : 2;
}

/** 与 `widgets/Vip.tsx` 一致：相对续费价的展示折扣百分比 */
function limitedOfferOffPercent(price: string, renewalPrice: string): string {
    const p = parseFloat(price);
    const r = parseFloat(renewalPrice);
    if (!Number.isFinite(p) || !Number.isFinite(r) || r <= 0) {
        return '0%';
    }
    return `${100 - Math.floor((p / r) * 100)}%`;
}

type Product = {
    id: number;
    type: number;
    name: string;
    price: string;
    renewal_price: string;
};

type PayCreateResp = {
    pi: string;
    client_secret: string;
    customer_id: string;
    currency?: string;
    amount?: unknown;
    amount_major?: unknown;
    pay_amount?: unknown;
    price?: unknown;
    env?: 'prod' | 'demo';
    success_url?: string;
};

function majorAmount(apiHint: unknown): number {
    if (typeof apiHint === 'number' && Number.isFinite(apiHint)) return apiHint;
    if (typeof apiHint === 'string') {
        const v = parseFloat(apiHint);
        if (Number.isFinite(v)) return v;
    }
    return 0;
}

export type RadixRcLayout = 'page' | 'embed';

export type RadixRcProps = {
    /** 整页：站点顶栏+底栏；嵌入：仅购物主体，可选 VIP 顶栏 */
    layout?: RadixRcLayout;
    /** `layout=embed` 时：顶栏右侧关闭 */
    onEmbedClose?: () => void;
    /** `product` 接口的 `from` */
    productFrom?: 'shopping' | 'video';
    /** 跳转收银台 URL 的 `from=` */
    checkoutFrom?: 'shopping' | 'video';
};

type ProductFromKey = NonNullable<RadixRcProps['productFrom']>;

/** SPA 内复用：整页 / 视频抽屉反复打开不重复打 `product` 接口、不闪骨架 */
const shoppingProductCache = new Map<ProductFromKey, Product[]>();

export default function RadixRc({
    layout = 'page',
    onEmbedClose,
    productFrom = 'shopping',
    checkoutFrom = 'shopping',
}: RadixRcProps = {}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);

    // 预留：之前用于 Airwallex wallet 的 redirect 计算；当前版本不在 /shopping 内嵌钱包按钮
    // const walletPayCreateRedirect = useMemo(() => {
    //     if (typeof window === 'undefined') {
    //         return '';
    //     }
    //     return payCreateRedirectFromApiOrigin(`${location.pathname}${location.search}`);
    // }, [location.pathname, location.search]);

    const [products, setProducts] = useState<Product[]>(() => shoppingProductCache.get(productFrom) ?? []);
    const [loadingProducts, setLoadingProducts] = useState(
        () => !shoppingProductCache.has(productFrom),
    );
    const [currentId, setCurrentId] = useState<number | null>(() => {
        const cached = shoppingProductCache.get(productFrom);
        return cached?.[0]?.id ?? null;
    });

    const [payment, setPayment] = useState<number>(() => defaultPayMethodFromUa());
    const walletEmbedSupported =
        (payment === 1 && isApplePlatform()) || (payment === 2 && !isApplePlatform());
    const [planWalletState, setPlanWalletState] = useState<Map<number, 'pending' | 'ready' | 'failed'>>(
        () => new Map(),
    );
    const planWalletTimersRef = useRef<Map<number, number>>(new Map());
    const planWalletReadyDelayTimersRef = useRef<Map<number, number>>(new Map());
    const walletElementsRef = useRef<
        Map<number, ElementTypes['googlePayButton'] | ElementTypes['applePayButton']>
    >(new Map());
    const payWalletMountRef = useRef<HTMLDivElement | null>(null);
    const planWalletSeenNonZeroHeightRef = useRef<Map<number, boolean>>(new Map());
    const walletObsRef = useRef<MutationObserver[]>([]);
    const walletRunIdRef = useRef(0);
    const lastWalletPaymentRef = useRef<1 | 2 | null>(null);
    const lastWalletTargetByMethodRef = useRef<Record<1 | 2, number | null>>({
        1: null,
        2: null,
    });

    useEffect(() => {
        const cached = shoppingProductCache.get(productFrom);
        if (cached?.length) {
            setProducts(cached);
            setCurrentId(cached[0]?.id ?? null);
            setLoadingProducts(false);
            return;
        }

        let alive = true;
        setLoadingProducts(true);
        setProducts([]);
        setCurrentId(null);
        api<Product[]>('product', {
            data: { from: productFrom },
            loading: false,
        })
        .then((res) => {
            if (!alive) return;
            if (res.c !== 0) return;
            shoppingProductCache.set(productFrom, res.d);
            setProducts(res.d);
            setCurrentId(res.d?.[0]?.id ?? null);
        })
        .finally(() => {
            if (!alive) return;
            setLoadingProducts(false);
        });
    return () => {
        alive = false;
    }
    }, [productFrom]);

    const planProducts = useMemo(() => products.slice(0, 3), [products]);
    const defaultWalletProductId = useMemo(() => {
        const p999 = planProducts.find((p) => Math.abs(parseFloat(p.price) - 9.99) < 0.001);
        return p999?.id ?? planProducts[0]?.id ?? null;
    }, [planProducts]);
    const walletProductId = currentId ?? defaultWalletProductId;

    const cleanupWalletOverlays = useCallback(() => {
        walletObsRef.current.forEach((o) => o.disconnect());
        walletObsRef.current = [];
        for (const [, el] of walletElementsRef.current) {
            try {
                el.unmount();
                el.destroy();
            } catch {
                /* noop */
            }
        }
        walletElementsRef.current.clear();
        for (const [, t] of planWalletTimersRef.current) {
            window.clearTimeout(t);
        }
        planWalletTimersRef.current.clear();
        for (const [, t] of planWalletReadyDelayTimersRef.current) {
            window.clearTimeout(t);
        }
        planWalletReadyDelayTimersRef.current.clear();
        setPlanWalletState(new Map());
    }, []);

    useEffect(() => {
        // 非钱包模式，或当前设备不支持所选钱包：不创建元素，交互走直跳 checkout。
        if (payment !== 1 && payment !== 2 || !walletEmbedSupported) {
            walletObsRef.current.forEach((o) => o.disconnect());
            walletObsRef.current = [];
            return;
        }

        let alive = true;
        walletRunIdRef.current += 1;
        const runId = walletRunIdRef.current;
        // 只有在 google/apple 互切时才清理重建；visa<->google 不清
        if (lastWalletPaymentRef.current && lastWalletPaymentRef.current !== payment) {
            cleanupWalletOverlays();
        }
        lastWalletPaymentRef.current = payment;

        const which = payment === 1 ? ('apple' as const) : ('google' as const);
        const method = payment as 1 | 2;
        // 达到可见高度后再缓冲 1.7s，避免刚出现就切态导致视觉突兀
        const readyDelayMs = 1700;

        const targetProductId = walletProductId;
        void airwallexRunShoppingWalletExclusive(async () => {
            const READY_H = 40;
            const READY_TIMEOUT_MS = 12000;
            const readPx = (v: string | null | undefined): number => {
                if (!v) return NaN;
                const n = parseFloat(v);
                return Number.isFinite(n) ? n : NaN;
            };
            const frameHeightPx = (frame: HTMLIFrameElement): number => {
                // Airwallex 常用 inline style 驱动 height transition：优先信任 frame.style.height
                const inlineH = readPx(frame.style.height);
                if (Number.isFinite(inlineH)) return inlineH;
                const csH = readPx(window.getComputedStyle(frame).height);
                if (Number.isFinite(csH)) return csH;
                return frame.getBoundingClientRect().height;
            };
            const isHostReady = (host: HTMLDivElement, planId: number) => {
                const frame = host.querySelector('iframe') as HTMLIFrameElement | null;
                if (!frame) return false;
                const h = frameHeightPx(frame);
                // 防止“接口回来了但按钮还没真正渲染”的误判：
                // 必须观察到 iframe 的 inline height 从 0 变为非 0（通常是 0 -> 40+ 的 transition），
                // 然后再以高度阈值判断 ready。
                const inlineH = readPx(frame.style.height);
                if (Number.isFinite(inlineH) && inlineH > 0) {
                    planWalletSeenNonZeroHeightRef.current.set(planId, true);
                }
                return h >= READY_H;
            };
            const scheduleReady = (planId: number) => {
                const prevTid = planWalletReadyDelayTimersRef.current.get(planId);
                if (prevTid) {
                    window.clearTimeout(prevTid);
                }
                const tid = window.setTimeout(() => {
                    if (!alive || walletRunIdRef.current !== runId) return;
                    setPlanWalletState((prev) => {
                        const n = new Map(prev);
                        n.set(planId, 'ready');
                        return n;
                    });
                }, readyDelayMs);
                planWalletReadyDelayTimersRef.current.set(planId, tid);
            };
            const markReady = (planId: number, host: HTMLDivElement) => {
                const startAt = performance.now();
                const tick = () => {
                    if (!alive || walletRunIdRef.current !== runId) return;
                    if (isHostReady(host, planId)) {
                        scheduleReady(planId);
                        return;
                    }
                    if (performance.now() - startAt > READY_TIMEOUT_MS) {
                        setPlanWalletState((prev) => {
                            const n = new Map(prev);
                            if (n.get(planId) !== 'ready') n.set(planId, 'failed');
                            return n;
                        });
                        return;
                    }
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            };
            if (!targetProductId) return;
            const host = payWalletMountRef.current;
            if (!host) return;
            const shouldForceRecreate = lastWalletTargetByMethodRef.current[method] !== targetProductId;

            let mountedEl = walletElementsRef.current.get(targetProductId);
            if (mountedEl && shouldForceRecreate) {
                try {
                    mountedEl.unmount();
                    mountedEl.destroy();
                } catch {
                    /* noop */
                }
                walletElementsRef.current.delete(targetProductId);
                mountedEl = undefined;
            }

            if (mountedEl) {
                // 已有按钮实例（例如 Visa -> Google/Apple 切回）：直接复用，避免再出现 loading
                try {
                    mountedEl.mount(host);
                } catch {
                    /* noop */
                }
                const prevDelayTid = planWalletReadyDelayTimersRef.current.get(targetProductId);
                if (prevDelayTid) {
                    window.clearTimeout(prevDelayTid);
                }
                planWalletReadyDelayTimersRef.current.delete(targetProductId);
                const prevFailTid = planWalletTimersRef.current.get(targetProductId);
                if (prevFailTid) {
                    window.clearTimeout(prevFailTid);
                }
                planWalletTimersRef.current.delete(targetProductId);
                setPlanWalletState((prev) => {
                    const n = new Map(prev);
                    n.set(targetProductId, 'ready');
                    return n;
                });
                lastWalletTargetByMethodRef.current[method] = targetProductId;
                return;
            }

            planWalletSeenNonZeroHeightRef.current.set(targetProductId, false);
            const prevDelayTid = planWalletReadyDelayTimersRef.current.get(targetProductId);
            if (prevDelayTid) {
                window.clearTimeout(prevDelayTid);
            }
            planWalletReadyDelayTimersRef.current.delete(targetProductId);
            setPlanWalletState((prev) => {
                const n = new Map(prev);
                n.set(targetProductId, 'pending');
                return n;
            });
            if (!planWalletTimersRef.current.has(targetProductId)) {
                const tid = window.setTimeout(() => {
                    setPlanWalletState((prev) => {
                        const n = new Map(prev);
                        if (n.get(targetProductId) !== 'ready') n.set(targetProductId, 'failed');
                        return n;
                    });
                }, 10000);
                planWalletTimersRef.current.set(targetProductId, tid);
            }

            {
                let payCreate: Awaited<ReturnType<typeof api<PayCreateResp>>>;
                try {
                    payCreate = await api<PayCreateResp>('pay/create', {
                        method: 'post',
                        loading: false,
                        data: {
                            payment,
                            product_id: targetProductId,
                            redirect: window.location.href,
                        },
                    });
                } catch (e) {
                    console.error('[shopping] pay/create failed', e);
                    return;
                }
                if (!alive || walletRunIdRef.current !== runId) return;
                if (payCreate.c !== 0) return;

                const initEnv = (payCreate.d?.env as 'prod' | 'demo' | undefined) ?? 'demo';
                try {
                    await airwallexEnsureShoppingWalletInit(
                        normalizeAirwallexLocale(intl.locale),
                        initEnv,
                    );
                } catch (e) {
                    console.error('[shopping] airwallex init failed', e);
                    return;
                }
                if (!alive || walletRunIdRef.current !== runId) return;

                const intent_id = payCreate.d.pi;
                const client_secret = payCreate.d.client_secret;
                const customer_id = payCreate.d.customer_id;
                const currency = payCreate.d.currency || 'USD';
                const amountValue = majorAmount(
                    payCreate.d.amount ?? payCreate.d.amount_major ?? payCreate.d.pay_amount ?? payCreate.d.price,
                );

                try {
                    const el =
                        which === 'google'
                            ? await createElement('googlePayButton', {
                                  mode: 'recurring',
                                  intent_id,
                                  client_secret,
                                  customer_id,
                                  amount: { value: amountValue, currency },
                                  countryCode: 'HK',
                                  buttonSizeMode: 'fill',
                                  buttonColor: 'black',
                                  buttonType: 'short',
                                  style: {
                                      width: '100%',
                                      height: '40px',
                                  },
                              })
                            : await createElement('applePayButton', {
                                  mode: 'recurring',
                                  intent_id,
                                  client_secret,
                                  customer_id,
                                  amount: { value: amountValue, currency },
                                  countryCode: 'HK',
                                  buttonType: 'plain',
                                  buttonColor: 'black',
                                  style: {
                                      width: '100%',
                                      height: '40px',
                                  },
                              });
                    if (!el) return;
                    if (!alive || walletRunIdRef.current !== runId) {
                        try {
                            el.destroy();
                        } catch {
                            /* noop */
                        }
                        return;
                    }
                    el.mount(host);
                    walletElementsRef.current.set(targetProductId, el as never);
                    lastWalletTargetByMethodRef.current[method] = targetProductId;
                    if (isHostReady(host, targetProductId)) {
                        scheduleReady(targetProductId);
                    } else {
                        markReady(targetProductId, host);
                    }
                } catch {
                    return;
                }
            }

            const obs = new MutationObserver(() => {
                if (!alive || walletRunIdRef.current !== runId) return;
                markReady(targetProductId, host);
            });
            obs.observe(host, { childList: true, subtree: true });
            walletObsRef.current = [obs];
        }).catch((e) => {
            console.error('[shopping] wallet overlay crashed', e);
        });

        return () => {
            alive = false;
            // 注意：这里不 destroy，避免 StrictMode/卸载重挂载导致丢缓存；只断开 observer
            walletObsRef.current.forEach((o) => o.disconnect());
            walletObsRef.current = [];
        };
    }, [payment, intl.locale, cleanupWalletOverlays, walletProductId, walletEmbedSupported]);

    function goCheckout(productId: number) {
        navigate(`/page/pay/${productId}?payment=${payment}&from=${checkoutFrom}`);
    }

    function handleSelectPlan(productId: number) {
        setCurrentId(productId);
    }

    function handleTopUpClick() {
        const targetId = currentId ?? defaultWalletProductId ?? planProducts[0]?.id ?? null;
        if (!targetId) return;
        if (payment === 3 || !walletEmbedSupported) {
            goCheckout(targetId);
        }
    }

    function handlePaymentPick(payMethod: number) {
        setPayment(payMethod);
    }

    const showCountdown = !loadingProducts && products.length > 0;
    const walletDirectCheckout = payment === 3 || !walletEmbedSupported;
    const walletOverlayOpacity =
        typeof window !== 'undefined' && window.localStorage.getItem('shopping_wallet_opacity') === '1' ? 0.4 : 0.01;
    const countdownEl = showCountdown ? (
        <div
            className={cn(
                'rs-shopping__countdown',
                layout === 'embed' && 'rs-shopping__countdown--inDrawerHead',
            )}
        >
            <Countdown />
        </div>
    ) : null;

    const main = (
        <div className="rs-shopping__main">
            <div className="rs-shopping__intro">
                <div className="rs-shopping__introTitle">
                    <FormattedMessage id="shopping_vip_unlock_all" />
                </div>
                <div className="rs-shopping__introSub">
                    <FormattedMessage id="shopping_auto_renew_cancel_anytime" />
                </div>
            </div>

            {layout !== 'embed' ? countdownEl : null}

            <div className="rs-shopping__plans rs-shopping__plans--singleColAlways">
                {(loadingProducts ? [] : planProducts).map((p) => {
                    const enableInteraction = true;
                    return (
                    <div
                        key={p.id}
                        role={enableInteraction ? 'button' : undefined}
                        aria-disabled={enableInteraction ? undefined : true}
                        tabIndex={enableInteraction ? 0 : -1}
                        onClick={enableInteraction ? () => handleSelectPlan(p.id) : undefined}
                        onKeyDown={
                            enableInteraction
                                ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          handleSelectPlan(p.id);
                                      }
                                  }
                                : undefined
                        }
                        className={cn(
                            'rs-shopping__plan',
                            currentId === p.id && 'rs-shopping__plan--selected',
                            !enableInteraction && 'cursor-default',
                        )}
                    >
                        <>
                            <div
                                className="rs-shopping__planBg"
                                style={{ backgroundImage: `url(${vipCardBg})` }}
                            />

                            <div className="rs-shopping__planOfferBadge">
                                <FormattedMessage
                                    id="limited_time_offer"
                                    values={{ off: limitedOfferOffPercent(p.price, p.renewal_price) }}
                                />
                            </div>
                            {currentId === p.id ? (
                                <img
                                    className="rs-shopping__planCheckedIcon"
                                    src={checkedIcon}
                                    alt=""
                                    aria-hidden="true"
                                />
                            ) : null}

                            <div className="rs-shopping__planBody">
                                <div className="rs-shopping__planText">
                                    <div className="rs-shopping__planName">
                                        {intl.formatMessage({ id: `${p.name}_subscription` })}
                                    </div>
                                    <div className="rs-shopping__planPriceRow">
                                        <div className="rs-shopping__planPrice">${p.price}</div>
                                    </div>
                                    <div className="rs-shopping__planRenew">
                                        {intl.formatMessage({ id: 'shopping_auto_renew_short' })}
                                    </div>
                                </div>
                            </div>

                            <div className="rs-shopping__planBenefits">
                                <div className="rs-shopping__planBenefit">
                                    <img
                                        className="rs-shopping__planBenefitIcon"
                                        src={iconUnlimitedViewing}
                                        alt=""
                                    />
                                    <FormattedMessage id="shopping_benefit_unlimited_viewing" />
                                </div>
                                <div className="rs-shopping__planBenefit">
                                    <img
                                        className="rs-shopping__planBenefitIcon"
                                        src={icon1080p}
                                        alt=""
                                    />
                                    <FormattedMessage id="shopping_benefit_1080p" />
                                </div>
                            </div>
                        </>
                    </div>
                    );
                })}

                {loadingProducts ? (
                    <div
                        className="rs-shopping__plansSkeleton"
                        role="status"
                        aria-busy="true"
                        aria-label={intl.formatMessage({ id: 'loading', defaultMessage: 'Loading' })}
                    >
                        <div className="rs-shopping__skeletonBar rs-shopping__skeletonBar--vipFirst" />
                        <div className="rs-shopping__skeletonBar rs-shopping__skeletonBar--vip" />
                        <div className="rs-shopping__skeletonBar rs-shopping__skeletonBar--payRow" />
                    </div>
                ) : null}
            </div>

            <div className="rs-shopping__pay">
                <div className="rs-shopping__payTitle">
                    <FormattedMessage id="payment_method" />
                </div>
                <div className="rs-shopping__payGrid">
                    <button
                        type="button"
                        onClick={() => handlePaymentPick(1)}
                        className={cn(
                            'rs-shopping__payMethodBtn',
                            payment === 1 && 'rs-shopping__payMethodBtn--active',
                        )}
                    >
                        <img
                            className="rs-shopping__payLogo rs-shopping__payLogo--apple"
                            src={applePay}
                            alt="Apple Pay"
                        />
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePaymentPick(2)}
                        className={cn(
                            'rs-shopping__payMethodBtn',
                            payment === 2 && 'rs-shopping__payMethodBtn--active',
                        )}
                    >
                        <img
                            className="rs-shopping__payLogo rs-shopping__payLogo--google"
                            src={googlePay}
                            alt="Google Pay"
                        />
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePaymentPick(3)}
                        className={cn(
                            'rs-shopping__payMethodBtn rs-shopping__payMethodBtn--cardPair',
                            payment === 3 && 'rs-shopping__payMethodBtn--active',
                        )}
                    >
                        <img src={visa} alt="Visa" className="rs-shopping__payLogo rs-shopping__payLogo--visa" />
                        <img
                            src={master}
                            alt="Master"
                            className="rs-shopping__payLogo rs-shopping__payLogo--master"
                        />
                    </button>
                </div>
                {payment === 1 || payment === 2 || payment === 3 ? (
                    <div className="rs-shopping__airwallexWalletSlot">
                        <div className="rs-shopping__payWalletSlot">
                            <button
                                type="button"
                                disabled={walletDirectCheckout
                                    ? false
                                    : (planWalletState.get(walletProductId ?? -1) ?? 'pending') !== 'ready'
                                }
                                onClick={walletDirectCheckout ? handleTopUpClick : undefined}
                                className={cn(
                                    'rs-shopping__payWalletGhostBtn',
                                    !walletDirectCheckout &&
                                        (planWalletState.get(walletProductId ?? -1) ?? 'pending') !== 'ready' &&
                                        'rs-shopping__payWalletGhostBtn--loading',
                                    (walletDirectCheckout ||
                                        (planWalletState.get(walletProductId ?? -1) ?? 'pending') === 'ready') &&
                                        'rs-shopping__payWalletGhostBtn--ready',
                                    walletDirectCheckout && 'rs-shopping__payWalletGhostBtn--clickable',
                                )}
                                aria-hidden={walletDirectCheckout ? undefined : true}
                            >
                                <span className="rs-shopping__payWalletGhostInner">
                                    {!walletDirectCheckout &&
                                    (planWalletState.get(walletProductId ?? -1) ?? 'pending') !== 'ready' ? (
                                        <img
                                            className="rs-shopping__payWalletGhostSpinner"
                                            src={btnLoadingIcon}
                                            alt=""
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    <span className="rs-shopping__payWalletGhostText">
                                        <FormattedMessage id="top_up" defaultMessage="Top-up" />
                                    </span>
                                </span>
                            </button>
                            <div
                                ref={payWalletMountRef}
                                className="rs-shopping__planPayMount"
                                style={{
                                    display: 'flex',
                                    ['--rs-wallet-iframe-opacity' as string]: walletOverlayOpacity,
                                    pointerEvents:
                                        !walletDirectCheckout &&
                                        (planWalletState.get(walletProductId ?? -1) ?? 'pending') === 'ready'
                                            ? 'auto'
                                            : 'none',
                                }}
                            />
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );

    if (layout === 'embed') {
        const closeAria = intl.formatMessage({ id: 'close', defaultMessage: 'Close' });
        return (
            <div className="rs-shopping-drawer-sheet">
                <div className="rs-shopping-drawer-head rs-shopping-drawer-head--reelshort">
                    <div className="rs-shopping-drawer-head__kvGroup">
                        {showCountdown ? (
                            countdownEl
                        ) : (
                            <span className="rs-shopping-drawer-head__vipUnlock">
                                <FormattedMessage id="shopping_vip_drawer_title" />
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="rs-shopping-drawer-head__closeImgBtn"
                        onClick={() => onEmbedClose?.()}
                        aria-label={closeAria}
                    >
                        <img
                            className="rs-shopping-drawer-head__closePixel"
                            src={paywallImage('a9a3d800-ef98-11f0-84ad-6b5693b490dc.png')}
                            alt=""
                        />
                    </button>
                </div>
                <div className="rs-shopping-drawer-head__divider" />
                {main}
            </div>
        );
    }

    return (
        <div className="rs-shopping">
            <div ref={scrollRef} className="rs-shopping__scroll">
                <ReelShortTopNav scrollParentRef={scrollRef} showSearch={true} />
                {main}
                <ReelShortFooter />
            </div>
        </div>
    );
}
