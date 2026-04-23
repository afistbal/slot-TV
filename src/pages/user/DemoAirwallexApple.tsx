import { api } from '@/api';
import {
    airwallexEnsureShoppingWalletInit,
    normalizeAirwallexLocale,
} from '@/lib/airwallexShoppingWalletEmbedSingleton';
import { createElement } from '@airwallex/components-sdk';
import { useLayoutEffect, useRef } from 'react';
import { useIntl } from 'react-intl';

const PRODUCT_ID = 4;

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
};

function majorAmount(apiHint: unknown): number {
    if (typeof apiHint === 'number' && Number.isFinite(apiHint)) return apiHint;
    if (typeof apiHint === 'string') {
        const v = parseFloat(apiHint);
        if (Number.isFinite(v)) return v;
    }
    return 0;
}

/**
 * Apple Pay **Button Element**（非 Drop-in、非 redirectToCheckout）。
 * @see https://www.airwallex.com/docs/js/payments/applepaybutton/
 * 路由：`/page/demo/airwallex-apple`
 */
export default function DemoAirwallexApple() {
    const intl = useIntl();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const instanceRef = useRef<{ unmount: () => void; destroy: () => void } | null>(null);

    useLayoutEffect(() => {
        const host = mountRef.current;
        if (!host) return;

        let cancelled = false;

        void (async () => {
            let payCreate: Awaited<ReturnType<typeof api<PayCreateResp>>>;
            try {
                payCreate = await api<PayCreateResp>('pay/create', {
                    method: 'post',
                    loading: false,
                    data: {
                        payment: 1,
                        product_id: PRODUCT_ID,
                        redirect: window.location.href,
                    },
                });
            } catch (e) {
                console.error('[demo-applePayButton] pay/create', e);
                return;
            }
            if (cancelled || payCreate.c !== 0 || !payCreate.d) return;

            const initEnv = (payCreate.d.env as 'prod' | 'demo' | undefined) ?? 'demo';
            try {
                await airwallexEnsureShoppingWalletInit(
                    normalizeAirwallexLocale(intl.locale),
                    initEnv,
                );
            } catch (e) {
                console.error('[demo-applePayButton] init', e);
                return;
            }
            if (cancelled) return;

            const d = payCreate.d;
            const intent_id = d.pi;
            const client_secret = d.client_secret;
            const customer_id = d.customer_id;
            const currency = d.currency || 'USD';
            const amountValue = majorAmount(
                d.amount ?? d.amount_major ?? d.pay_amount ?? d.price,
            );

            const applePayButtonOptions = {
                mode: 'recurring' as const,
                intent_id,
                client_secret,
                customer_id,
                amount: { value: amountValue, currency },
                countryCode: 'HK',
                buttonType: 'subscribe' as const,
                buttonColor: 'black' as const,
                style: {
                    width: '100%',
                    height: '48px',
                },
            };

            let el: Awaited<ReturnType<typeof createElement<'applePayButton'>>> | null = null;
            try {
                el = await createElement(
                    'applePayButton',
                    applePayButtonOptions as unknown as Parameters<
                        typeof createElement<'applePayButton'>
                    >[1],
                );
            } catch (e) {
                console.error('[demo-applePayButton] createElement', e);
                return;
            }
            if (!el || cancelled) {
                try {
                    el?.destroy();
                } catch {
                    /* noop */
                }
                return;
            }

            el.mount(host);
            instanceRef.current = el;

            const walletOn = (el as unknown as { on?: (code: string, handler: (ev?: unknown) => void) => void })
                .on;
            const safeOn = (code: string, handler: (ev?: unknown) => void) => {
                try {
                    walletOn?.(code, handler);
                } catch {
                    /* noop */
                }
            };

            safeOn('success', (e) => {
                console.log('[demo-applePayButton] success', e);
                try {
                    window.alert(
                        "[demo applePayButton] element.on('success') — 见控制台 e.detail.intent",
                    );
                } catch {
                    /* noop */
                }
            });
            safeOn('error', (e) => {
                console.error('[demo-applePayButton] error', e);
                try {
                    window.alert("[demo applePayButton] element.on('error')");
                } catch {
                    /* noop */
                }
            });
        })();

        return () => {
            cancelled = true;
            const inst = instanceRef.current;
            instanceRef.current = null;
            if (inst) {
                try {
                    inst.unmount();
                } catch {
                    /* noop */
                }
                try {
                    inst.destroy();
                } catch {
                    /* noop */
                }
            }
            host.replaceChildren();
        };
    }, [intl.locale]);

    return (
        <div className="p-4 max-w-md mx-auto">
            <div
                ref={mountRef}
                style={{ width: '100%', minHeight: 48 }}
            />
        </div>
    );
}
