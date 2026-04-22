import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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
import payApple from '@/assets/icons/shopping-pay/apple-pay.svg';
import payGoogle from '@/assets/icons/shopping-pay/google-pay.svg';
import payVisa from '@/assets/icons/shopping-pay/visa.svg';
import payMastercard from '@/assets/icons/shopping-pay/mastercard.svg';
import payAmex from '@/assets/icons/shopping-pay/amex.svg';
import payDiscover from '@/assets/icons/shopping-pay/discover.svg';
import { isApplePlatform } from '@/lib/isApplePlatform';
import { CheckoutAirwallexPanel } from '@/pages/user/CheckoutAirwallexPanel';

function shoppingDbg(message: string, details?: unknown) {
    console.log(`[shopping-pay] ${message}`, details ?? '');
}

function probeWalletEvent(label: string, eventName: string, ev?: unknown) {
    console.log(`[购物钱包探针] ${label}.${eventName}`, ev);
    try {
        alert(`[购物钱包探针] ${label}.${eventName} 已触发`);
    } catch {
        // 当运行环境不支持 alert 时忽略异常。
    }
}

function bindWalletDebugEvents(
    label: string,
    target: { on?: (code: string, handler: (ev?: unknown) => void) => void },
) {
    const on = target.on;
    if (!on) {
        shoppingDbg(`${label} 无 on() 监听能力`);
        return;
    }
    /** 勿含 success/error（及与结果强相关的 PI 事件）：下面业务 `el.on` 会绑，若 SDK 只保留先注册的回调，调试会抢槽导致永远进不了 `onPayStateChange` */
    const events = [
        'ready',
        'focus',
        'blur',
        'click',
        'submit',
        'clickConfirmButton',
        '3ds',
        '3ds-challenge',
        'threeDS',
        'three_ds',
        'requiresAction',
        'paymentAuthorized',
    ];
    for (const eventName of events) {
        try {
            on(eventName, (ev?: unknown) => {
                shoppingDbg(`${label} 事件: ${eventName}`, ev);
            });
        } catch {
            // 某些事件名 SDK 不支持会抛错，忽略。
        }
    }
}

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
    /** 支付状态回调（用于外层弹窗展示处理中/成功/失败） */
    onPayStateChange?: (state: 'idle' | 'processing' | 'checking' | 'success' | 'failed') => void;
};

type PaymentMethodSwitcherProps = {
    payment: number;
    canPickApple: boolean;
    onPick: (payMethod: number) => void;
};

function PaymentMethodSwitcher({ payment, canPickApple, onPick }: PaymentMethodSwitcherProps) {
    return (
        <div className="rs-shopping__payGrid">
            <button
                type="button"
                onClick={() => onPick(payment === 2 ? 2 : canPickApple ? 1 : 2)}
                className={cn(
                    'rs-shopping__payMethodBtn rs-shopping__payMethodBtn--walletGroup',
                    (payment === 1 || payment === 2) && 'rs-shopping__payMethodBtn--active',
                )}
            >
                <span
                    className={cn(
                        'rs-shopping__payMethodSubBtn relative overflow-hidden',
                        payment === 1 && 'rs-shopping__payMethodSubBtn--active',
                    )}
                    role="button"
                    aria-disabled={!canPickApple}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!canPickApple) return;
                        onPick(1);
                    }}
                >
                    {!canPickApple ? (
                        <span
                            className="absolute inset-0 z-10 rounded-[7px] bg-[#bfbfbf]/70"
                            aria-hidden="true"
                        />
                    ) : null}
                    <img
                        className="rs-shopping__payLogo rs-shopping__payLogo--apple relative z-0"
                        src={payApple}
                        alt="Apple Pay"
                    />
                </span>
                <span
                    className={cn(
                        'rs-shopping__payMethodSubBtn',
                        payment === 2 && 'rs-shopping__payMethodSubBtn--active',
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPick(2);
                    }}
                >
                    <img
                        className="rs-shopping__payLogo rs-shopping__payLogo--google"
                        src={payGoogle}
                        alt="Google Pay"
                    />
                </span>
            </button>
            <button
                type="button"
                onClick={() => onPick(3)}
                className={cn(
                    'rs-shopping__payMethodBtn rs-shopping__payMethodBtn--cardGroup',
                    payment === 3 && 'rs-shopping__payMethodBtn--active',
                )}
            >
                <span className="rs-shopping__payCardTitle">
                    <FormattedMessage id="shopping_credit_card" defaultMessage="Credit card" />
                </span>
                <span className="rs-shopping__payCardIcons">
                    <img src={payVisa} alt="Visa" className="rs-shopping__payLogo rs-shopping__payLogo--bank" />
                    <img src={payDiscover} alt="Discover" className="rs-shopping__payLogo rs-shopping__payLogo--bank" />
                    <img src={payMastercard} alt="Mastercard" className="rs-shopping__payLogo rs-shopping__payLogo--bank" />
                    <img src={payAmex} alt="American Express" className="rs-shopping__payLogo rs-shopping__payLogo--bank" />
                </span>
            </button>
        </div>
    );
}

type WalletPayActionProps = {
    walletDirectCheckout: boolean;
    walletState: 'pending' | 'ready' | 'failed';
    walletMethod: 'apple' | 'google';
    onCheckout: () => void;
    onWalletPointerDown?: () => void;
    mountRef: RefObject<HTMLDivElement | null>;
    hidden?: boolean;
};

function WalletPayAction({
    walletDirectCheckout,
    walletState,
    walletMethod,
    onCheckout,
    onWalletPointerDown,
    mountRef,
    hidden = false,
}: WalletPayActionProps) {
    return (
        <div
            className="rs-shopping__airwallexWalletSlot"
            style={{ display: hidden ? 'none' : undefined }}
            aria-hidden={hidden || undefined}
        >
            <div className="rs-shopping__payWalletSlot">
                <button
                    type="button"
                    disabled={walletDirectCheckout ? false : walletState !== 'ready'}
                    onClick={walletDirectCheckout ? onCheckout : undefined}
                    className={cn(
                        'rs-shopping__payWalletGhostBtn',
                        !walletDirectCheckout && 'rs-shopping__payWalletGhostBtn--loading',
                        walletDirectCheckout && 'rs-shopping__payWalletGhostBtn--clickable',
                    )}
                    aria-hidden={walletDirectCheckout ? undefined : true}
                >
                    <span className="rs-shopping__payWalletGhostInner">
                        {!walletDirectCheckout ? (
                            <img
                                className="rs-shopping__payWalletGhostSpinner"
                                src={btnLoadingIcon}
                                alt=""
                                aria-hidden="true"
                            />
                        ) : null}
                        <span className="rs-shopping__payWalletGhostText">
                            {!walletDirectCheckout ? (
                                <FormattedMessage
                                    id={
                                        walletMethod === 'apple'
                                            ? 'shopping_wallet_loading_apple'
                                            : 'shopping_wallet_loading_google'
                                    }
                                    defaultMessage={
                                        walletMethod === 'apple'
                                            ? 'Apple Pay Loading...'
                                            : 'Google Pay Loading...'
                                    }
                                />
                            ) : (
                                <FormattedMessage id="shopping_wallet_pay_with" defaultMessage="Pay now" />
                            )}
                        </span>
                    </span>
                </button>
                <div
                    ref={mountRef}
                    className="rs-shopping__planPayMount"
                    onPointerDownCapture={onWalletPointerDown}
                    style={{
                        display: 'flex',
                        pointerEvents: !walletDirectCheckout && walletState === 'ready' ? 'auto' : 'none',
                    }}
                />
            </div>
        </div>
    );
}

type CardPayActionProps = {
    checkoutTargetProductId: number | null;
    onPayStateChange?: (state: 'idle' | 'processing' | 'checking' | 'success' | 'failed') => void;
    hidden?: boolean;
};

function CardPayAction({ checkoutTargetProductId, onPayStateChange, hidden = false }: CardPayActionProps) {
    if (!checkoutTargetProductId || hidden) return null;
    return (
        <div className="rs-shopping__cardDropin">
            <CheckoutAirwallexPanel
                productId={checkoutTargetProductId}
                payment={3}
                redirectHref={typeof window !== 'undefined' ? window.location.href : ''}
                successAction="reload"
                variant="embed"
                externalStatusMode={true}
                onPayStateChange={onPayStateChange}
            />
        </div>
    );
}

/**
 * RadixRc 购物页：支付方式选择、Airwallex Google/Apple Pay 嵌入、Top-up 幽灵按钮。
 */
export default function RadixRcShoppingPaySection({
    walletProductId,
    checkoutTargetProductId,
    checkoutFrom,
    onPayStateChange,
}: RadixRcShoppingPaySectionProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const canPickApple = isApplePlatform();

    const [payment, setPayment] = useState<number>(() => defaultPayMethodFromUa());
    const walletEmbedSupported = (payment === 1 && canPickApple) || payment === 2;
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
    const walletFrameTriggerCleanupRef = useRef<Map<number, () => void>>(new Map());
    const walletRunIdRef = useRef(0);
    const lastWalletPaymentRef = useRef<1 | 2 | null>(null);
    const pendingProcessingTimerRef = useRef<number | null>(null);
    const successAlertShownRef = useRef(false);

    const cleanupWalletFrameTriggers = useCallback(() => {
        for (const [, cleanup] of walletFrameTriggerCleanupRef.current) {
            cleanup();
        }
        walletFrameTriggerCleanupRef.current.clear();
        if (pendingProcessingTimerRef.current) {
            window.clearTimeout(pendingProcessingTimerRef.current);
            pendingProcessingTimerRef.current = null;
        }
        successAlertShownRef.current = false;
    }, []);

    const cleanupWalletOverlays = useCallback(() => {
        walletObsRef.current.forEach((o) => o.disconnect());
        walletObsRef.current = [];
        cleanupWalletFrameTriggers();
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
    }, [cleanupWalletFrameTriggers]);

    useEffect(() => {
        if (payment !== 1 && payment !== 2 || !walletEmbedSupported) {
            cleanupWalletOverlays();
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
        const readyDelayMs = 350;

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
            const emitProcessing = (source: string) => {
                if (!alive || walletRunIdRef.current !== runId) return;
                const isSdkTriggered = source === 'sdk-click' || source === 'sdk-clickConfirmButton';
                // Apple Pay 对手势链路敏感：仅接受 SDK 回调触发 processing，避免前置事件打断拉起。
                if (which === 'apple' && !isSdkTriggered) return;
                if (pendingProcessingTimerRef.current) {
                    window.clearTimeout(pendingProcessingTimerRef.current);
                }
                pendingProcessingTimerRef.current = window.setTimeout(() => {
                    pendingProcessingTimerRef.current = null;
                    if (!alive || walletRunIdRef.current !== runId) return;
                    onPayStateChange?.('processing');
                    console.log('[shopping] processing triggered:', source);
                }, 0);
            };
            const bindWalletFrameTrigger = (planId: number, host: HTMLDivElement) => {
                const prevCleanup = walletFrameTriggerCleanupRef.current.get(planId);
                if (prevCleanup) {
                    prevCleanup();
                }
                const frame = host.querySelector('iframe') as HTMLIFrameElement | null;
                if (!frame) {
                    walletFrameTriggerCleanupRef.current.delete(planId);
                    return;
                }
                const onFocus = () => emitProcessing('iframe-focus');
                const onPointerDown = () => emitProcessing('iframe-pointerdown');
                const onDocumentFocusIn = () => {
                    if (document.activeElement === frame) {
                        emitProcessing('document-focusin-iframe');
                    }
                };
                const onWindowBlur = () => {
                    if (document.activeElement === frame) {
                        emitProcessing('window-blur-after-iframe-focus');
                    }
                };
                frame.addEventListener('focus', onFocus);
                frame.addEventListener('pointerdown', onPointerDown);
                frame.addEventListener('mousedown', onPointerDown);
                frame.addEventListener('touchstart', onPointerDown, { passive: true });
                document.addEventListener('focusin', onDocumentFocusIn, true);
                window.addEventListener('blur', onWindowBlur);
                walletFrameTriggerCleanupRef.current.set(planId, () => {
                    frame.removeEventListener('focus', onFocus);
                    frame.removeEventListener('pointerdown', onPointerDown);
                    frame.removeEventListener('mousedown', onPointerDown);
                    frame.removeEventListener('touchstart', onPointerDown);
                    document.removeEventListener('focusin', onDocumentFocusIn, true);
                    window.removeEventListener('blur', onWindowBlur);
                });
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
            const existingElement = walletElementsRef.current.get(targetProductId);
            // Apple Pay 在切换后复用旧 iframe 容易导致无法再次拉起；Apple 一律重建。
            if (which !== 'apple' && existingElement && host.childElementCount > 0) {
                bindWalletFrameTrigger(targetProductId, host);
                if (isHostReady(host, targetProductId)) {
                    scheduleReady(targetProductId);
                } else {
                    markReady(targetProductId, host);
                }
                return;
            }
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
            const prevFrameCleanup = walletFrameTriggerCleanupRef.current.get(targetProductId);
            if (prevFrameCleanup) {
                prevFrameCleanup();
            }
            walletFrameTriggerCleanupRef.current.delete(targetProductId);
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
                    setPlanWalletState((prev) => {
                        const n = new Map(prev);
                        n.set(targetProductId, 'failed');
                        return n;
                    });
                    return;
                }
                if (!alive || walletRunIdRef.current !== runId) return;
                if (payCreate.c !== 0) {
                    setPlanWalletState((prev) => {
                        const n = new Map(prev);
                        n.set(targetProductId, 'failed');
                        return n;
                    });
                    return;
                }

                const initEnv = (payCreate.d?.env as 'prod' | 'demo' | undefined) ?? 'demo';
                try {
                    await airwallexEnsureShoppingWalletInit(
                        normalizeAirwallexLocale(intl.locale),
                        initEnv,
                    );
                } catch (e) {
                    console.error('[shopping] airwallex init failed', e);
                    setPlanWalletState((prev) => {
                        const n = new Map(prev);
                        n.set(targetProductId, 'failed');
                        return n;
                    });
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
                    buttonType: 'plain' as const,
                    buttonColor: 'black' as const,
                    style: {
                        width: '100%',
                        height: '40px',
                    },
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
                                  buttonColor: 'default',
                                  appearance: {
                                      rules: {
                                          '.GooglePayButton': {
                                              width: '100%',
                                              height: '40px',
                                              borderRadius: '4px',
                                          },
                                      },
                                  },
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
                    bindWalletDebugEvents(
                        which === 'apple' ? 'applePayButton' : 'googlePayButton',
                        el as unknown as { on?: (code: string, handler: (ev?: unknown) => void) => void },
                    );
                    const walletOn = (el as unknown as {
                        on?: (code: string, handler: (ev?: unknown) => void) => void;
                    }).on;
                    const safeOn = (eventName: string, handler: (ev?: unknown) => void) => {
                        try {
                            walletOn?.(eventName, handler);
                        } catch {
                            /* noop */
                        }
                    };
                    safeOn('click', (ev) => {
                        if (which === 'google') {
                            probeWalletEvent('googlePayButton', 'click', ev);
                        }
                        emitProcessing('sdk-click');
                    });
                    try {
                        (el as unknown as { on?: (code: string, handler: () => void) => void }).on?.(
                            'clickConfirmButton',
                            () => {
                                emitProcessing('sdk-clickConfirmButton');
                            },
                        );
                    } catch {
                        /* noop */
                    }
                    safeOn('success', (ev) => {
                        if (which === 'google') {
                            probeWalletEvent('googlePayButton', 'success', ev);
                        }
                        if (!successAlertShownRef.current) {
                            successAlertShownRef.current = true;
                            window.alert('[shopping-wallet] success callback triggered');
                        }
                        onPayStateChange?.('success');
                    });
                    safeOn('error', (ev) => {
                        if (which === 'google') {
                            probeWalletEvent('googlePayButton', 'error', ev);
                        }
                        onPayStateChange?.('failed');
                    });
                    if (which === 'google') {
                        safeOn('authorized', (ev) => {
                            probeWalletEvent('googlePayButton', 'authorized', ev);
                        });
                        safeOn('cancel', (ev) => {
                            probeWalletEvent('googlePayButton', 'cancel', ev);
                        });
                        safeOn('ready', (ev) => {
                            probeWalletEvent('googlePayButton', 'ready', ev);
                        });
                        safeOn('shippingAddressChange', (ev) => {
                            probeWalletEvent('googlePayButton', 'shippingAddressChange', ev);
                        });
                        safeOn('shippingMethodChange', (ev) => {
                            probeWalletEvent('googlePayButton', 'shippingMethodChange', ev);
                        });
                    }
                    walletElementsRef.current.set(targetProductId, el as never);
                    bindWalletFrameTrigger(targetProductId, host);
                    if (isHostReady(host, targetProductId)) {
                        scheduleReady(targetProductId);
                    } else {
                        markReady(targetProductId, host);
                    }
                } catch (e) {
                    console.error('[shopping] create wallet element failed', e);
                    setPlanWalletState((prev) => {
                        const n = new Map(prev);
                        n.set(targetProductId, 'failed');
                        return n;
                    });
                    return;
                }
            }

            const obs = new MutationObserver(() => {
                if (!alive || walletRunIdRef.current !== runId) return;
                bindWalletFrameTrigger(targetProductId, host);
                markReady(targetProductId, host);
            });
            obs.observe(host, { childList: true, subtree: true });
            walletObsRef.current = [obs];
        }).catch((e) => {
            console.error('[shopping] wallet overlay crashed', e);
        });

        return () => {
            alive = false;
            cleanupWalletOverlays();
        };
    }, [
        payment,
        intl.locale,
        cleanupWalletOverlays,
        walletProductId,
        walletEmbedSupported,
        onPayStateChange,
    ]);

    function goCheckout(productId: number) {
        navigate(`/page/pay/${productId}?payment=${payment}&from=${checkoutFrom}`);
    }

    function handleWalletCheckoutClick() {
        const targetId = checkoutTargetProductId;
        if (!targetId) return;
        if (payment === 3 || !walletEmbedSupported) {
            goCheckout(targetId);
        }
    }

    function handlePaymentPick(payMethod: number) {
        if (payMethod === 1 && !canPickApple) {
            return;
        }
        setPayment(payMethod);
    }

    const walletDirectCheckout = payment === 3 || !walletEmbedSupported;
    const walletState = planWalletState.get(walletProductId ?? -1) ?? 'pending';
    useEffect(() => {
        if (!canPickApple && payment === 1) {
            setPayment(2);
        }
    }, [canPickApple, payment]);

    return (
        <div className="rs-shopping__pay">

            <PaymentMethodSwitcher
                payment={payment}
                canPickApple={canPickApple}
                onPick={handlePaymentPick}
            />

            <WalletPayAction
                walletDirectCheckout={walletDirectCheckout}
                walletState={walletState}
                walletMethod={payment === 1 ? 'apple' : 'google'}
                onCheckout={handleWalletCheckoutClick}
                onWalletPointerDown={() => {
                    if ((payment === 1 || payment === 2) && !walletDirectCheckout && walletState === 'ready') {
                        onPayStateChange?.('processing');
                    }
                }}
                mountRef={payWalletMountRef}
                hidden={payment === 3}
            />

            <CardPayAction
                checkoutTargetProductId={checkoutTargetProductId}
                onPayStateChange={onPayStateChange}
                hidden={payment !== 3}
            />
        </div>
    );
}
