import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import {
    airwallexEnsureShoppingWalletInit,
    airwallexRunShoppingWalletExclusive,
    normalizeAirwallexLocale,
} from '@/lib/airwallexShoppingWalletEmbedSingleton';
import { createElement, type ElementTypes } from '@airwallex/components-sdk';
import btnLoadingIcon from '@/assets/images/btn_loading.svg';
import visa from '@/assets/visa.svg';
import master from '@/assets/master.svg';
import googlePay from '@/assets/google-pay.svg';
import applePay from '@/assets/apple-pay.svg';
import { isApplePlatform } from '@/lib/isApplePlatform';

/** 购物/收银默认 `payment`：Apple 平台默认 Apple Pay(1)，其余默认 Google Pay(2) */
function defaultPayMethodFromUa(): 1 | 2 {
    return isApplePlatform() ? 1 : 2;
}

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

export type RadixRcShoppingPaySectionProps = {
    /** 当前选中套餐；用于钱包 pay/create 与挂载 */
    walletProductId: number | null;
    /** Top-up / 直跳收银台时的商品 id（含「无选中时用首档」等兜底） */
    checkoutTargetProductId: number | null;
    /** 跳转 `/page/pay/...` 的 `from=` */
    checkoutFrom: 'shopping' | 'video';
};

/**
 * RadixRc 购物页：支付方式选择、Airwallex Google/Apple Pay 嵌入、Top-up 幽灵按钮。
 */
export default function RadixRcShoppingPaySection({
    walletProductId,
    checkoutTargetProductId,
    checkoutFrom,
}: RadixRcShoppingPaySectionProps) {
    const intl = useIntl();
    const navigate = useNavigate();

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
        if (payment !== 1 && payment !== 2 || !walletEmbedSupported) {
            walletObsRef.current.forEach((o) => o.disconnect());
            walletObsRef.current = [];
            return;
        }

        let alive = true;
        walletRunIdRef.current += 1;
        const runId = walletRunIdRef.current;
        if (lastWalletPaymentRef.current && lastWalletPaymentRef.current !== payment) {
            cleanupWalletOverlays();
        }
        lastWalletPaymentRef.current = payment;

        const which = payment === 1 ? ('apple' as const) : ('google' as const);
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
            /**
             * 只保留单一挂载位：切套餐/切意图时强制销毁旧 element，避免复用陈旧 intent
             * 导致 Apple Pay 首次可用、切换后失效（或切回也失效）。
             */
            for (const [, el] of walletElementsRef.current) {
                try {
                    el.unmount();
                    el.destroy();
                } catch {
                    /* noop */
                }
            }
            walletElementsRef.current.clear();
            host.replaceChildren();

            planWalletSeenNonZeroHeightRef.current.set(targetProductId, false);
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
                n.set(targetProductId, 'pending');
                return n;
            });
            const tid = window.setTimeout(() => {
                setPlanWalletState((prev) => {
                    const n = new Map(prev);
                    if (n.get(targetProductId) !== 'ready') n.set(targetProductId, 'failed');
                    return n;
                });
            }, 10000);
            planWalletTimersRef.current.set(targetProductId, tid);

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

                const applePayButtonOptions = {
                    mode: 'recurring' as const,
                    intent_id,
                    client_secret,
                    customer_id,
                    amount: { value: amountValue, currency },
                    countryCode: 'HK',
                    // buttonType: 'plain' as const,
                    // buttonColor: 'black' as const,
                    // style: {
                    //     width: '100%',
                    //     height: '40px',
                    // },
                };

                if (which === 'apple') {
                    console.log(JSON.stringify(applePayButtonOptions, null, 2));
                }

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
                            : await createElement(
                                  'applePayButton',
                                  applePayButtonOptions as unknown as Parameters<
                                      typeof createElement<'applePayButton'>
                                  >[1],
                              );
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
            walletObsRef.current.forEach((o) => o.disconnect());
            walletObsRef.current = [];
        };
    }, [payment, intl.locale, cleanupWalletOverlays, walletProductId, walletEmbedSupported]);

    function goCheckout(productId: number) {
        navigate(`/page/pay/${productId}?payment=${payment}&from=${checkoutFrom}`);
    }

    function handleTopUpClick() {
        const targetId = checkoutTargetProductId;
        if (!targetId) return;
        if (payment === 3 || !walletEmbedSupported) {
            goCheckout(targetId);
        }
    }

    function handlePaymentPick(payMethod: number) {
        setPayment(payMethod);
    }

    const walletDirectCheckout = payment === 3 || !walletEmbedSupported;
    const walletOverlayOpacity =
        typeof window !== 'undefined' && window.localStorage.getItem('shopping_wallet_opacity') === '1'
            ? 0.4
            : 0.01;

    return (
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
                            disabled={
                                walletDirectCheckout
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
    );
}
