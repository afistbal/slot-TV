import { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { toast } from 'sonner';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import applePayLogo from '@/assets/apple-pay.svg';

/**
 * Airwallex Apple Pay Native API（Web）：
 * - 创建意图：`pay/create`（非 `pay/create`）
 * - POST /api/v1/pa/payment_session/start → 前端约定 `pay/apple_pay_session_start`
 * - POST /api/v1/pa/payment_intents/:id/confirm → 前端约定 `pay/payment_intent_confirm`
 *
 * `pay/apple_pay_session_start` 请求体建议与 Airwallex 一致：
 * `{ validation_url, payment_intent_id, initiative_context, request_id }`
 * 响应体 `d` 为 merchant session 对象，原样交给 `completeMerchantValidation`。
 *
 * `pay/payment_intent_confirm` 请求体：`{ request_id, payment_intent_id, payment_method: { type: 'applepay', applepay: { ... } } }`
 */

type PayMethodResp = {
    pi: string;
    client_secret: string;
    customer_id: string;
    currency?: string;
    amount?: unknown;
    amount_major?: unknown;
    pay_amount?: unknown;
    price?: unknown;
    env?: 'prod' | 'demo';
};

type ShoppingProduct = {
    id: number;
    price?: string;
};

type PreparedPayIntent = {
    pi: string;
    currency: string;
    amountStr: string;
    productId: number;
};

function majorAmount(apiHint: unknown): number {
    if (typeof apiHint === 'number' && Number.isFinite(apiHint)) return apiHint;
    if (typeof apiHint === 'string') {
        const v = parseFloat(apiHint);
        if (Number.isFinite(v)) return v;
    }
    return 0;
}

function requestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pickApplePayVersion(APS: typeof ApplePaySession): number {
    const candidates = [14, 13, 12, 6, 5, 4, 3];
    for (const v of candidates) {
        if (APS.supportsVersion(v)) return v;
    }
    return 6;
}

function buildApplePayMethodPayload(token: ApplePayPaymentToken) {
    const pm = token.paymentMethod;
    const pd = token.paymentData;
    const h = pd.header;
    const encrypted = JSON.stringify({
        paymentMethod: pm,
        paymentData: pd,
        transactionIdentifier: token.transactionIdentifier,
    });
    return {
        payment_data_type: 'encrypted_payment_token' as const,
        encrypted_payment_token: encrypted,
        ...(pm.network ? { card_brand: pm.network } : {}),
        ...(pm.type ? { card_type: pm.type } : {}),
        ...(pd.data ? { data: pd.data } : {}),
        ...(h?.ephemeralPublicKey ? { ephemeral_public_key: h.ephemeralPublicKey } : {}),
        ...(h?.publicKeyHash ? { public_key_hash: h.publicKeyHash } : {}),
        ...(h?.transactionId ? { transaction_id: h.transactionId } : {}),
        ...(pd.signature ? { signature: pd.signature } : {}),
        ...(pd.version ? { version: pd.version } : {}),
    };
}

export type RadixRcApplePayNativeButtonProps = {
    /** 当前用于下单的套餐 id（与购物页选中一致） */
    productId: number | null;
    disabled?: boolean;
    className?: string;
};

export default function RadixRcApplePayNativeButton({
    productId,
    disabled = false,
    className,
}: RadixRcApplePayNativeButtonProps) {
    const [busy, setBusy] = useState(false);
    const [prepared, setPrepared] = useState<PreparedPayIntent | null>(null);
    const [validationUrlPreview, setValidationUrlPreview] = useState<string | null>(null);

    const resolveProductId = useCallback(async (): Promise<number | null> => {
        if (productId) return productId;
        const productRes = await api<ShoppingProduct[]>('product', {
            loading: false,
            data: { from: 'shopping' },
        });
        if (productRes.c !== 0) return null;
        return productRes.d?.[0]?.id ?? null;
    }, [productId]);

    const preparePayIntent = useCallback(async () => {
        const pickedProductId = await resolveProductId();
        if (!pickedProductId) {
            setPrepared(null);
            return;
        }
        const payMethod = await api<PayMethodResp>('pay/create', {
            method: 'post',
            loading: false,
            data: {
                payment: 1,
                product_id: pickedProductId,
                redirect: window.location.href,
            },
        });
        if (payMethod.c !== 0) {
            setPrepared(null);
            return;
        }
        const currency = payMethod.d.currency || 'USD';
        const amountNum = majorAmount(
            payMethod.d.amount ?? payMethod.d.amount_major ?? payMethod.d.pay_amount ?? payMethod.d.price,
        );
        const amountStr = Number.isFinite(amountNum) ? amountNum.toFixed(2) : '0.00';
        setPrepared({
            pi: payMethod.d.pi,
            currency,
            amountStr,
            productId: pickedProductId,
        });
    }, [resolveProductId]);

    useEffect(() => {
        let alive = true;
        setPrepared(null);
        preparePayIntent().catch((e) => {
            if (!alive) return;
            console.error('[RadixRcApplePayNativeButton][preparePayIntent]', e);
            setPrepared(null);
        });
        return () => {
            alive = false;
        };
    }, [preparePayIntent]);

    const handleClick = async () => {
        if (disabled || busy) return;
        if (!prepared?.pi) {
            toast.error('支付信息初始化中，请稍后重试');
            return;
        }

        setBusy(true);
        try {
            const pi = prepared.pi;
            const currency = prepared.currency;
            const amountStr = prepared.amountStr;
            const APS = window.ApplePaySession;
            if (!APS || !APS.canMakePayments()) {
                toast.error('Apple Pay 不可用（需 Safari、HTTPS、钱包已绑卡）');
                setBusy(false);
                return;
            }
            if (!window.isSecureContext) {
                toast.error('Apple Pay 需要安全上下文（HTTPS）');
                setBusy(false);
                return;
            }

            const paymentRequest: ApplePayPaymentRequest = {
                countryCode: 'HK',
                currencyCode: currency,
                merchantCapabilities: ['supports3DS', 'supportsDebit', 'supportsCredit'],
                supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
                total: {
                    label: 'Subscription',
                    amount: amountStr,
                    type: 'final',
                },
                lineItems: [
                    {
                        label: 'Subscription',
                        amount: amountStr,
                        type: 'final',
                        paymentTiming: 'recurring',
                        recurringPaymentStartDate: new Date(),
                        recurringPaymentIntervalUnit: 'month',
                        recurringPaymentIntervalCount: 1,
                    },
                ],
            };

            const version = pickApplePayVersion(APS);
            const session = new APS(version, paymentRequest);

            session.onvalidatemerchant = async (event: ApplePayValidateMerchantEvent) => {
                const sid = requestId();
                console.log('[ApplePay][onvalidatemerchant] validationURL:', event.validationURL);
                setValidationUrlPreview(event.validationURL);
                try {
                    const sessionRes = await api<Record<string, unknown>>('pay/apple_pay_session_start', {
                        method: 'post',
                        loading: false,
                        data: {
                            request_id: sid,
                            validation_url: event.validationURL,
                            payment_intent_id: pi,
                            initiative_context: window.location.hostname,
                        },
                    });
                    if (sessionRes.c !== 0) {
                        session.abort();
                        setBusy(false);
                        return;
                    }
                    const merchantSession = sessionRes.d as Record<string, unknown>;
                    session.completeMerchantValidation(merchantSession);
                } catch {
                    session.abort();
                    setBusy(false);
                }
            };

            session.onpaymentauthorized = async (event: ApplePayPaymentAuthorizedEvent) => {
                const token = event.payment.token;
                const cid = requestId();
                try {
                    const confirmRes = await api<unknown>('pay/payment_intent_confirm', {
                        method: 'post',
                        loading: false,
                        data: {
                            request_id: cid,
                            payment_intent_id: pi,
                            payment_method: {
                                type: 'applepay',
                                applepay: buildApplePayMethodPayload(token),
                            },
                        },
                    });
                    if (confirmRes.c !== 0) {
                        session.completePayment(APS.STATUS_FAILURE);
                        return;
                    }
                    session.completePayment(APS.STATUS_SUCCESS);
                    toast.success('支付已提交');
                } catch {
                    session.completePayment(APS.STATUS_FAILURE);
                } finally {
                    setBusy(false);
                }
            };

            session.oncancel = () => {
                setBusy(false);
            };

            session.begin();
        } catch (e) {
            console.error('[RadixRcApplePayNativeButton]', e);
            toast.error('Apple Pay 流程异常');
            setBusy(false);
        }
    };

    const blocked = disabled || busy;

    return (
        <div className={cn('rs-shopping__applePayNativeWrap', className)}>
            <button
                type="button"
                className={cn('rs-shopping__applePayNativeBtn', blocked && 'opacity-50')}
                disabled={blocked}
                onClick={() => void handleClick()}
            >
                <img
                    src={applePayLogo}
                    alt=""
                    className="rs-shopping__applePayNativeBtnLogo"
                    aria-hidden
                />
                <span>
                    <FormattedMessage
                        id="shopping_apple_pay_native"
                        defaultMessage="Apple Pay"
                    />
                </span>
            </button>
            {validationUrlPreview ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
                >
                    <div className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl">
                        <div className="mb-2 text-base font-semibold">Apple validationURL</div>
                        <textarea
                            value={validationUrlPreview}
                            readOnly
                            className="h-32 w-full resize-none rounded border p-2 text-xs"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded border px-3 py-1 text-sm"
                                onClick={() => {
                                    void navigator.clipboard
                                        .writeText(validationUrlPreview)
                                        .then(() => toast.success('validationURL 已复制'))
                                        .catch(() => toast.error('复制失败'));
                                }}
                            >
                                复制
                            </button>
                            <button
                                type="button"
                                className="rounded bg-black px-3 py-1 text-sm text-white"
                                onClick={() => setValidationUrlPreview(null)}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
