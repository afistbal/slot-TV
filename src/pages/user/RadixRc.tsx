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
    const [planWalletState, setPlanWalletState] = useState<Map<number, 'pending' | 'ready' | 'failed'>>(
        () => new Map(),
    );
    const planWalletTimersRef = useRef<Map<number, number>>(new Map());
    const planWalletReadyDelayTimersRef = useRef<Map<number, number>>(new Map());
    const walletElementsRef = useRef<
        Map<number, ElementTypes['googlePayButton'] | ElementTypes['applePayButton']>
    >(new Map());
    const planWalletMountRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
    const planWalletSeenNonZeroHeightRef = useRef<Map<number, boolean>>(new Map());
    const walletObsRef = useRef<MutationObserver[]>([]);
    const walletRunIdRef = useRef(0);
    const lastWalletPaymentRef = useRef<1 | 2 | null>(null);

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
        };
    }, [productFrom]);

    const planProducts = useMemo(() => products.slice(0, 3), [products]);
    const planIdsKey = useMemo(() => planProducts.map((p) => p.id).join(','), [planProducts]);

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
        // Visa/卡：不销毁 wallet（避免切回来重建）；仅隐藏由 render 层控制
        if (payment !== 1 && payment !== 2) {
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

        const plans = planProducts;
        void airwallexRunShoppingWalletExclusive(async () => {
            const initialRendered = new Set<number>();
            const READY_H = 40;
            const READY_TIMEOUT_MS = 12000;
            const READY_DELAY_MS = 1200;
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
                if (!planWalletSeenNonZeroHeightRef.current.get(planId)) {
                    return false;
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
                }, READY_DELAY_MS);
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
            // init 一次即可（env 优先用第一个 pay/create 返回；否则 demo）
            let inited = false;
            let initEnv: 'prod' | 'demo' = 'demo';
            for (const p of plans) {
                if (!alive || walletRunIdRef.current !== runId) return;
                const host = planWalletMountRefs.current.get(p.id) ?? null;
                if (!host) continue;

                // 初始化状态与超时
                planWalletSeenNonZeroHeightRef.current.set(p.id, false);
                const prevDelayTid = planWalletReadyDelayTimersRef.current.get(p.id);
                if (prevDelayTid) {
                    window.clearTimeout(prevDelayTid);
                }
                planWalletReadyDelayTimersRef.current.delete(p.id);
                setPlanWalletState((prev) => {
                    const n = new Map(prev);
                    n.set(p.id, 'pending');
                    return n;
                });
                if (!planWalletTimersRef.current.has(p.id) && (payment === 1 || payment === 2)) {
                    const tid = window.setTimeout(() => {
                        setPlanWalletState((prev) => {
                            const n = new Map(prev);
                            if (n.get(p.id) !== 'ready') n.set(p.id, 'failed');
                            return n;
                        });
                    }, 10000);
                    planWalletTimersRef.current.set(p.id, tid);
                }

                // 已有 iframe/element：直接标记渲染完成，不重复创建（用于 visa->google 切回）
                if (walletElementsRef.current.has(p.id) && isHostReady(host, p.id)) {
                    initialRendered.add(p.id);
                    scheduleReady(p.id);
                    continue;
                }

                let payCreate: Awaited<ReturnType<typeof api<PayCreateResp>>>;
                try {
                    payCreate = await api<PayCreateResp>('pay/create', {
                        method: 'post',
                        loading: false,
                        data: {
                            payment,
                            product_id: p.id,
                            redirect: window.location.href,
                        },
                    });
                } catch (e) {
                    console.error('[shopping] pay/create failed', e);
                    continue;
                }
                if (!alive || walletRunIdRef.current !== runId) return;
                if (payCreate.c !== 0) continue;

                if (!inited) {
                    initEnv = (payCreate.d?.env as 'prod' | 'demo' | undefined) ?? 'demo';
                    try {
                        await airwallexEnsureShoppingWalletInit(
                            normalizeAirwallexLocale(intl.locale),
                            initEnv,
                        );
                    } catch (e) {
                        console.error('[shopping] airwallex init failed', e);
                        return;
                    }
                    inited = true;
                    if (!alive || walletRunIdRef.current !== runId) return;
                }

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
                                  buttonColor: 'white',
                                  buttonType: 'short',
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
                              });
                    if (!el) continue;
                    if (!alive || walletRunIdRef.current !== runId) {
                        try {
                            el.destroy();
                        } catch {
                            /* noop */
                        }
                        continue;
                    }
                    el.mount(host);
                    walletElementsRef.current.set(p.id, el as never);
                    // mount 后 child 可能下一帧才出现：用 rAF 轮询确认
                    if (isHostReady(host, p.id)) {
                        initialRendered.add(p.id);
                        scheduleReady(p.id);
                    } else {
                        markReady(p.id, host);
                    }
                } catch {
                    continue;
                }
            }

            const observers: MutationObserver[] = [];
            for (const p of plans) {
                const host = planWalletMountRefs.current.get(p.id);
                if (!host) continue;
                if (isHostReady(host, p.id)) {
                    initialRendered.add(p.id);
                }
                const obs = new MutationObserver(() => {
                    if (!alive || walletRunIdRef.current !== runId) return;
                    // iframe/样式变化可能滞后：变更后重新尝试判定 ready
                    markReady(p.id, host);
                });
                obs.observe(host, { childList: true, subtree: true });
                observers.push(obs);
            }
            walletObsRef.current = observers;
        }).catch((e) => {
            console.error('[shopping] wallet overlay crashed', e);
        });

        return () => {
            alive = false;
            // 注意：这里不 destroy，避免 StrictMode/卸载重挂载导致丢缓存；只断开 observer
            walletObsRef.current.forEach((o) => o.disconnect());
            walletObsRef.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payment, intl.locale, cleanupWalletOverlays, planIdsKey]);

    function goCheckout(productId: number, payMethod: number) {
        if (payMethod === 3) {
            navigate(`/page/pay/${productId}?from=${checkoutFrom}`);
            return;
        }
        navigate(`/page/pay/${productId}?payment=${payMethod}&from=${checkoutFrom}`);
    }

    function handleSelectAndPay(productId: number) {
        setCurrentId(productId);
        // wallet 状态下由 overlay 按钮自行拉起；这里仅选中
        if (payment === 2) {
            const st = planWalletState.get(productId) ?? 'pending';
            if (st === 'failed') {
                goCheckout(productId, 3);
            }
            return;
        }
        if (payment === 1) return;
        goCheckout(productId, payment);
    }

    function handlePaymentPick(payMethod: number) {
        setPayment(payMethod);
    }

    const showCountdown = !loadingProducts && products.length > 0;
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
                {(loadingProducts ? [] : planProducts).map((p) => (
                    (() => {
                        const isWalletMode = payment === 1 || payment === 2;
                        const walletReady = !isWalletMode
                            ? true
                            : (planWalletState.get(p.id) ?? 'pending') === 'ready';
                        const enableInteraction = !isWalletMode || walletReady;
                        return (
                    <div
                        key={p.id}
                        role={enableInteraction ? 'button' : undefined}
                        aria-disabled={enableInteraction ? undefined : true}
                        tabIndex={enableInteraction ? 0 : -1}
                        onClick={enableInteraction ? () => handleSelectAndPay(p.id) : undefined}
                        onKeyDown={
                            enableInteraction
                                ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          handleSelectAndPay(p.id);
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
                        {/* 每个套餐自己的 wallet overlay（真实三方按钮挂载容器） */}
                        <div
                            ref={(node) => {
                                planWalletMountRefs.current.set(p.id, node);
                            }}
                            className="rs-shopping__planPayMount absolute inset-0 z-10"
                            style={{
                                display: payment === 1 || payment === 2 ? 'flex' : 'none',
                                opacity: 0.35,
                                pointerEvents:
                                    (planWalletState.get(p.id) ?? 'pending') === 'ready' ? 'auto' : 'none',
                            }}
                        />

                        {/* Wallet 模式：按钮未 ready 前，仅显示骨架卡（避免看起来可点） */}
                        {isWalletMode && !walletReady ? (
                            <div
                                aria-hidden="true"
                                className="rs-shopping__skeletonBar rs-shopping__skeletonBar--planWalletOverlay"
                            />
                        ) : null}

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

                            {/* 纯展示 DOM：无点击事件，样式按 H5 “Top Up” */}
                            <div className="rs-shopping__planTopUp">Top Up</div>

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
                    })()
                ))}

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
                        className={cn('rs-shopping__payBtn', payment === 1 && 'rs-shopping__payBtn--active')}
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
                        className={cn('rs-shopping__payBtn', payment === 2 && 'rs-shopping__payBtn--active')}
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
                            'rs-shopping__payBtn rs-shopping__payBtn--cardPair',
                            payment === 3 && 'rs-shopping__payBtn--active',
                        )}
                    >
                        <img src={visa} alt="Visa" className="rs-shopping__payLogo rs-shopping__payLogo--visa" />
                        <img
                            src={master}
                            alt="Master"
                            className="rs-shopping__payLogo rs-shopping__payLogo--master"
                        />
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                `/page/paydemo/${currentId ?? planProducts[0]?.id ?? 1}`,
                            )
                        }
                        className="rs-shopping__payBtn"
                    >
                        test apple
                    </button>
                </div>
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
