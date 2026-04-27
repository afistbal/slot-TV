import { useEffect, useRef, useState, type RefObject } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import {
    airwallexEnsureShoppingWalletInit,
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
import usePixel from '@/hooks/usePixel';

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

function toNumericValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = parseFloat(value);
        if (Number.isFinite(n)) return n;
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
    /** 结账商品信息，用于像素埋点参数 */
    checkoutProductMeta?: {
        id: number;
        name: string;
        price: string;
    } | null;
    /** 与 `RadixRc` 重试按钮联动：递增后强制重建钱包会话，避免复用失效 intent */
    paySessionSeed?: number;
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
    mountRef: RefObject<HTMLDivElement | null>;
    visuallyHidden: boolean;
};

function CardPayAction({ mountRef, visuallyHidden }: CardPayActionProps) {
    return (
        <div
            className="rs-shopping__cardDropin"
            style={{ display: visuallyHidden ? 'none' : undefined }}
            aria-hidden={visuallyHidden || undefined}
        >
            <div className={cn('rs-checkout rs-checkout-h5 rs-checkout-h5--embedded')}>
                <div className="rs-checkout-h5__inner">
                    <div ref={mountRef} className="rs-checkout-h5__dropInMount" />
                </div>
            </div>
        </div>
    );
}

/**
 * RadixRc 购物页：支付方式选择、Airwallex Google/Apple Pay 嵌入、Top-up 幽灵按钮。
 */
export default function RadixRcShoppingPaySection({
    walletProductId,
    checkoutTargetProductId,
    checkoutFrom: _checkoutFrom,
    checkoutProductMeta,
    paySessionSeed = 0,
    onPayStateChange,
}: RadixRcShoppingPaySectionProps) {
    const intl = useIntl();
    const pixel = usePixel();
    const canPickApple = isApplePlatform();

    const [payment, setPayment] = useState<number>(() => defaultPayMethodFromUa());
    const [sessionReady, setSessionReady] = useState(false);
    const [walletState, setWalletState] = useState<{ apple: 'pending' | 'ready' | 'failed'; google: 'pending' | 'ready' | 'failed' }>({
        apple: 'pending',
        google: 'pending',
    });
    const appleMountRef = useRef<HTMLDivElement | null>(null);
    const googleMountRef = useRef<HTMLDivElement | null>(null);
    const cardMountRef = useRef<HTMLDivElement | null>(null);
    const instancesRef = useRef<
        Array<
            | ElementTypes['applePayButton']
            | ElementTypes['googlePayButton']
            | ElementTypes['dropIn']
        >
    >([]);
    const sessionRef = useRef<{
        intent_id: string;
        client_secret: string;
        customer_id: string;
        currency: string;
        amountValue: number;
    } | null>(null);

    function buildCheckoutPayload(targetProductId: number, fallbackCurrency = 'USD', fallbackAmount = 0) {
        return {
            content_type: 'product',
            quantity: 1,
            description: checkoutProductMeta?.name ?? 'shopping_plan',
            content_ids: [(checkoutProductMeta?.id ?? targetProductId).toString()],
            currency: sessionRef.current?.currency || fallbackCurrency,
            value: toNumericValue(checkoutProductMeta?.price ?? sessionRef.current?.amountValue ?? fallbackAmount),
        };
    }

    function cleanupElements() {
        for (const inst of instancesRef.current) {
            try {
                inst.unmount();
            } catch {
                // noop
            }
            try {
                inst.destroy();
            } catch {
                // noop
            }
        }
        instancesRef.current = [];
        appleMountRef.current?.replaceChildren();
        googleMountRef.current?.replaceChildren();
        cardMountRef.current?.replaceChildren();
    }

    useEffect(() => {
        let alive = true;
        const targetProductId = walletProductId;
        setSessionReady(false);
        setWalletState({ apple: 'pending', google: 'pending' });
        sessionRef.current = null;
        cleanupElements();
        if (!targetProductId) return;

        void (async () => {
            let payCreate: Awaited<ReturnType<typeof api<PayCreateResp>>>;
            try {
                payCreate = await api<PayCreateResp>('pay/create', {
                    method: 'post',
                    loading: false,
                    data: {
                        payment: defaultPayMethodFromUa(),
                        product_id: targetProductId,
                        redirect: window.location.href,
                    },
                });
            } catch (e) {
                console.error('[shopping] pay/create failed', e);
                if (alive) onPayStateChange?.('failed');
                return;
            }
            if (!alive) return;
            if (payCreate.c !== 0 || !payCreate.d) {
                onPayStateChange?.('failed');
                return;
            }

            const initEnv = (payCreate.d.env as 'prod' | 'demo' | undefined) ?? 'demo';
            try {
                await airwallexEnsureShoppingWalletInit(
                    normalizeAirwallexLocale(intl.locale),
                    initEnv,
                );
            } catch (e) {
                console.error('[shopping] airwallex init failed', e);
                if (alive) onPayStateChange?.('failed');
                return;
            }
            if (!alive) return;

            sessionRef.current = {
                intent_id: payCreate.d.pi,
                client_secret: payCreate.d.client_secret,
                customer_id: payCreate.d.customer_id,
                currency: payCreate.d.currency || 'USD',
                amountValue: majorAmount(
                    payCreate.d.amount ??
                        payCreate.d.amount_major ??
                        payCreate.d.pay_amount ??
                        payCreate.d.price,
                ),
            };
            const addToCartData = {
                content_type: 'product',
                quantity: 1,
                description: checkoutProductMeta?.name ?? 'shopping_plan',
                content_ids: [(checkoutProductMeta?.id ?? targetProductId).toString()],
                currency: payCreate.d.currency || 'USD',
                value: toNumericValue(
                    checkoutProductMeta?.price ??
                    majorAmount(
                        payCreate.d.amount ??
                            payCreate.d.amount_major ??
                            payCreate.d.pay_amount ??
                            payCreate.d.price,
                    ),
                ),
            };
            console.info('[pixel] AddToCart fired', addToCartData);
            pixel.track('AddToCart', addToCartData);
            
            setSessionReady(true);
        })();

        return () => {
            alive = false;
        };
    }, [paySessionSeed, onPayStateChange]);

    useEffect(() => {
        let cancelled = false;
        if (!sessionReady || !sessionRef.current) {
            return;
        }
        const appleHost = appleMountRef.current;
        const googleHost = googleMountRef.current;
        const cardHost = cardMountRef.current;
        if (!googleHost || !cardHost) {
            return;
        }
        cleanupElements();
        setWalletState({ apple: 'pending', google: 'pending' });

        void (async () => {
            const { intent_id, client_secret, customer_id, currency, amountValue } = sessionRef.current!;
            const targetProductId = walletProductId ?? checkoutTargetProductId ?? 0;
            const subscribePayload = buildCheckoutPayload(targetProductId, currency, amountValue);
            const bindCommon = (element: any) => {
                element.on('success', () => {
                    pixel.track('Subscribe', subscribePayload);
                    onPayStateChange?.('success');
                });
                element.on('error', () => onPayStateChange?.('failed'));
                element.on('cancel', () => onPayStateChange?.('idle'));
            };

            if (canPickApple && appleHost) {
                try {
                    const apple = await createElement('applePayButton', {
                        mode: 'recurring',
                        intent_id,
                        client_secret,
                        customer_id,
                        amount: { value: amountValue, currency },
                        countryCode: 'HK',
                        buttonType: 'plain',
                        buttonColor: 'black',
                        style: { width: '100%', height: '40px' },
                    } as Parameters<typeof createElement<'applePayButton'>>[1]);
                    if (!apple || cancelled) return;
                    apple.mount(appleHost);
                    apple.on('click', () => {
                        pixel.track('InitiateCheckout', buildCheckoutPayload(targetProductId, currency, amountValue));
                        onPayStateChange?.('processing');
                    });
                    bindCommon(apple);
                    instancesRef.current.push(apple);
                    setWalletState((prev) => ({ ...prev, apple: 'ready' }));
                } catch {
                    setWalletState((prev) => ({ ...prev, apple: 'failed' }));
                }
            } else {
                setWalletState((prev) => ({ ...prev, apple: 'failed' }));
            }

            try {
                const google = await createElement('googlePayButton', {
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
                    style: { width: '100%', height: '40px' },
                } as Parameters<typeof createElement<'googlePayButton'>>[1]);
                if (!google || cancelled) return;
                google.mount(googleHost);
                google.on('click', () => {
                    pixel.track('InitiateCheckout', buildCheckoutPayload(targetProductId, currency, amountValue));
                    onPayStateChange?.('processing');
                });
                bindCommon(google);
                instancesRef.current.push(google);
                setWalletState((prev) => ({ ...prev, google: 'ready' }));
            } catch {
                setWalletState((prev) => ({ ...prev, google: 'failed' }));
            }

            try {
                const recurringOptions = {
                    next_triggered_by: 'merchant' as const,
                    merchant_trigger_reason: 'scheduled' as const,
                };
                const appearance = {
                    mode: 'dark' as const,
                    variables: {
                        colorBackground: '#222222',
                    },
                    rules: {
                        '.Input': {
                            backgroundColor: '#333333',
                        },
                        '.Button': {
                            backgroundColor: '#FF3D5DFF',
                            color: '#FFFFFF',
                        },
                        '.Button > div': {
                            color: '#FFFFFF',
                        },
                    },
                };
                const dropIn = await createElement('dropIn', {
                    mode: 'recurring',
                    intent_id,
                    client_secret,
                    customer_id,
                    currency,
                    payment_consent: recurringOptions,
                    recurringOptions,
                    methods: ['card'],
                    appearance,
                    country_code: 'HK',
                    submitType: 'subscribe',
                } as Parameters<typeof createElement<'dropIn'>>[1]);
                if (!dropIn || cancelled) return;
                dropIn.mount(cardHost);
                dropIn.on('clickConfirmButton', () => {
                    pixel.track('InitiateCheckout', buildCheckoutPayload(targetProductId, currency, amountValue));
                    onPayStateChange?.('processing');
                });
                bindCommon(dropIn);
                instancesRef.current.push(dropIn);
            } catch {
                onPayStateChange?.('failed');
            }
        })();

        return () => {
            cancelled = true;
            cleanupElements();
        };
    }, [sessionReady, canPickApple, onPayStateChange]);

    function handleWalletCheckoutClick() {}

    function handlePaymentPick(payMethod: number) {
        if (payMethod === 1 && !canPickApple) {
            return;
        }
        setPayment(payMethod);
    }

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
                walletDirectCheckout={false}
                walletState={walletState.apple}
                walletMethod={'apple'}
                onCheckout={handleWalletCheckoutClick}
                mountRef={appleMountRef}
                hidden={payment !== 1}
            />

            <WalletPayAction
                walletDirectCheckout={false}
                walletState={walletState.google}
                walletMethod={'google'}
                onCheckout={handleWalletCheckoutClick}
                mountRef={googleMountRef}
                hidden={payment !== 2}
            />

            <CardPayAction mountRef={cardMountRef} visuallyHidden={payment !== 3} />

            {!checkoutTargetProductId ? (
                <div className="text-xs text-white/60 mt-2">
                    <FormattedMessage id="loading" defaultMessage="Loading" />
                </div>
            ) : null}
            {!sessionReady ? (
                <div className="text-xs text-white/60 mt-2">
                    <FormattedMessage id="loading" defaultMessage="Loading" />
                </div>
            ) : null}
        </div>
    );
}
