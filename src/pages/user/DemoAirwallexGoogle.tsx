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
 * Google Pay **Button Element**（非 Drop-in）。
 * @see https://www.airwallex.com/docs/js/payments/googlepaybutton/#on
 * 路由：`/page/demo/airwallex-google`
 */
export default function DemoAirwallexGoogle() {
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
                        payment: 2,
                        product_id: PRODUCT_ID,
                        redirect: window.location.href,
                    },
                });
            } catch (e) {
                console.error('[demo-googlePayButton] pay/create', e);
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
                console.error('[demo-googlePayButton] init', e);
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

            let el: Awaited<ReturnType<typeof createElement<'googlePayButton'>>> | null = null;
            const googlePayButtonOptions = {
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
                            height: '48px',
                            borderRadius: '4px',
                        },
                    },
                },
                style: {
                    width: '100%',
                    height: '48px',
                },
            };
            try {
                el = await createElement(
                    'googlePayButton',
                    googlePayButtonOptions as Parameters<
                        typeof createElement<'googlePayButton'>
                    >[1],
                );
            } catch (e) {
                console.error('[demo-googlePayButton] createElement', e);
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

            const demoAlert = (message: string) => {
                try {
                    window.alert(message);
                } catch {
                    /* noop */
                }
            };

            el.on('ready', () => {
                console.log('[demo-googlePayButton] ready');
                demoAlert("[demo googlePayButton] element.on('ready')");
            });
            el.on('success', (e) => {
                console.log('[demo-googlePayButton] success', e);
                const { intent, consent } = e.detail;
                console.log('[demo-googlePayButton] success detail', { intent, consent });
                demoAlert(
                    "[demo googlePayButton] element.on('success') — 见控制台 intent / consent",
                );
            });
            el.on('error', (e) => {
                const { error } = e.detail;
                console.error('[demo-googlePayButton] error', error, e);
                demoAlert("[demo googlePayButton] element.on('error') — 见控制台 e.detail.error");
            });
            el.on('cancel', () => {
                console.log('[demo-googlePayButton] cancel');
                demoAlert("[demo googlePayButton] element.on('cancel')");
            });
            el.on('shippingMethodChange', (e) => {
                const { intermediatePaymentData } = e.detail;
                console.log(
                    '[demo-googlePayButton] shippingMethodChange',
                    intermediatePaymentData,
                );
                demoAlert(
                    "[demo googlePayButton] element.on('shippingMethodChange') — 见控制台 intermediatePaymentData",
                );
            });
            el.on('shippingAddressChange', (e) => {
                const { intermediatePaymentData } = e.detail;
                console.log(
                    '[demo-googlePayButton] shippingAddressChange',
                    intermediatePaymentData,
                );
                demoAlert(
                    "[demo googlePayButton] element.on('shippingAddressChange') — 见控制台 intermediatePaymentData",
                );
            });
            el.on('click', () => {
                console.log('[demo-googlePayButton] click');
                demoAlert("[demo googlePayButton] element.on('click')");
            });
            el.on('authorized', (e) => {
                const { paymentData } = e.detail;
                console.log('[demo-googlePayButton] authorized', paymentData);
                demoAlert(
                    "[demo googlePayButton] element.on('authorized') — 见控制台 paymentData",
                );
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
