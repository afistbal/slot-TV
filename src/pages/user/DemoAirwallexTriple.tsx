import { api } from '@/api';
import {
    airwallexEnsureShoppingWalletInit,
    normalizeAirwallexLocale,
} from '@/lib/airwallexShoppingWalletEmbedSingleton';
import { createElement, type ElementTypes } from '@airwallex/components-sdk';
import { useLayoutEffect, useRef, useState } from 'react';
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
 * 单次 `pay/create`，同时挂载 Apple / Google / Card 三种方式。
 * 路由：`/page/demo/airwallex-triple`
 */
export default function DemoAirwallexTriple() {
    const intl = useIntl();
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
    const [status, setStatus] = useState('初始化中...');

    useLayoutEffect(() => {
        const appleHost = appleMountRef.current;
        const googleHost = googleMountRef.current;
        const cardHost = cardMountRef.current;
        if (!appleHost || !googleHost || !cardHost) return;

        let cancelled = false;

        void (async () => {
            setStatus('调用 pay/create...');
            let payCreate: Awaited<ReturnType<typeof api<PayCreateResp>>>;
            try {
                payCreate = await api<PayCreateResp>('pay/create', {
                    method: 'post',
                    loading: false,
                    data: {
                        // 仅创建一次支付意图，后续三种方式共享同一组凭据
                        payment: 2,
                        product_id: PRODUCT_ID,
                        redirect: window.location.href,
                    },
                });
            } catch (e) {
                console.error('[demo-triple] pay/create', e);
                setStatus('pay/create 异常');
                return;
            }
            if (cancelled || payCreate.c !== 0 || !payCreate.d) {
                setStatus(`pay/create 失败: c=${payCreate.c}`);
                return;
            }

            const d = payCreate.d;
            const intent_id = d.pi;
            const client_secret = d.client_secret;
            const customer_id = d.customer_id;
            const currency = d.currency || 'USD';
            const amountValue = majorAmount(
                d.amount ?? d.amount_major ?? d.pay_amount ?? d.price,
            );
            const initEnv = (d.env as 'prod' | 'demo' | undefined) ?? 'demo';

            setStatus(`intent: ${intent_id}，初始化 SDK...`);
            try {
                await airwallexEnsureShoppingWalletInit(
                    normalizeAirwallexLocale(intl.locale),
                    initEnv,
                );
            } catch (e) {
                console.error('[demo-triple] init', e);
                setStatus('Airwallex SDK 初始化失败');
                return;
            }
            if (cancelled) return;

            const common = {
                mode: 'recurring' as const,
                intent_id,
                client_secret,
                customer_id,
                amount: { value: amountValue, currency },
                countryCode: 'HK',
            };

            try {
                const apple = await createElement('applePayButton', {
                    ...common,
                    buttonType: 'plain',
                    buttonColor: 'black',
                    style: { width: '100%', height: '44px' },
                } as Parameters<typeof createElement<'applePayButton'>>[1]);
                if (apple && !cancelled) {
                    apple.mount(appleHost);
                    apple.on('success', (e) => console.log('[demo-triple][apple] success', e));
                    apple.on('error', (e) => console.error('[demo-triple][apple] error', e));
                    apple.on('cancel', () => console.log('[demo-triple][apple] cancel'));
                    instancesRef.current.push(apple);
                }

                const google = await createElement('googlePayButton', {
                    ...common,
                    buttonSizeMode: 'fill',
                    buttonColor: 'default',
                    style: { width: '100%', height: '44px' },
                } as Parameters<typeof createElement<'googlePayButton'>>[1]);
                if (google && !cancelled) {
                    google.mount(googleHost);
                    google.on('success', (e) => console.log('[demo-triple][google] success', e));
                    google.on('error', (e) => console.error('[demo-triple][google] error', e));
                    google.on('cancel', () => console.log('[demo-triple][google] cancel'));
                    instancesRef.current.push(google);
                }

                const dropIn = await createElement('dropIn', {
                    mode: 'recurring',
                    intent_id,
                    client_secret,
                    customer_id,
                    currency,
                    methods: ['card'],
                    country_code: 'HK',
                    submitType: 'subscribe',
                } as Parameters<typeof createElement<'dropIn'>>[1]);
                if (dropIn && !cancelled) {
                    dropIn.mount(cardHost);
                    dropIn.on('success', (e) => console.log('[demo-triple][card] success', e));
                    dropIn.on('error', (e) => console.error('[demo-triple][card] error', e));
                    instancesRef.current.push(dropIn);
                }

                setStatus(`已挂载：intent=${intent_id}（单次 create）`);
            } catch (e) {
                console.error('[demo-triple] createElement', e);
                setStatus('挂载三方式失败，请看控制台');
            }
        })();

        return () => {
            cancelled = true;
            for (const inst of instancesRef.current) {
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
            instancesRef.current = [];
            appleHost.replaceChildren();
            googleHost.replaceChildren();
            cardHost.replaceChildren();
        };
    }, [intl.locale]);

    return (
        <div className="p-4 max-w-xl mx-auto text-white">
            <h1 className="text-lg font-bold mb-2">Airwallex Single Intent Triple Demo</h1>
            <p className="text-sm text-white/70 mb-4">
                固定商品 ID: {PRODUCT_ID}，仅调用一次 <code>pay/create</code>，三种支付方式共享同一 intent。
            </p>
            <div className="text-xs text-white/60 mb-4">{status}</div>

            <div className="space-y-4">
                <section className="p-3 border border-white/15 rounded-md">
                    <div className="text-sm mb-2">Apple Pay</div>
                    <div ref={appleMountRef} style={{ minHeight: 44 }} />
                </section>
                <section className="p-3 border border-white/15 rounded-md">
                    <div className="text-sm mb-2">Google Pay</div>
                    <div ref={googleMountRef} style={{ minHeight: 44 }} />
                </section>
                <section className="p-3 border border-white/15 rounded-md">
                    <div className="text-sm mb-2">Card (Drop-in)</div>
                    <div ref={cardMountRef} />
                </section>
            </div>
        </div>
    );
}
