import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import vipCardBg from '@/assets/images/5c3ff370-f045-11f0-84ad-6b5693b490dc.png';
import iconUnlimitedViewing from '@/assets/images/icon_unlimited_viewing.png';
import icon1080p from '@/assets/images/icon_1080p.png';
import visa from '@/assets/visa.svg';
import master from '@/assets/master.svg';
import googlePay from '@/assets/google-pay.svg';
import applePay from '@/assets/apple-pay.svg';

import Countdown from '@/widgets/Countdown';
import { createElement, init, type Payment } from '@airwallex/components-sdk';

function paywallImage(file: string) {
    return new URL(`../../assets/images/${file}`, import.meta.url).href;
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

/** 购物页 Google 钱包预创建数量：先 1 个 demo，稳定后改为 2、3 再补 Apple Pay */
const WALLET_GOOGLE_POOL_SIZE = 1 as const;

type WalletMethod = 1 | 2; // 1: Apple Pay, 2: Google Pay

type PayCreateData = {
    env: 'prod' | 'demo';
    pi: string;
    client_secret: string;
    customer_id: string;
    currency?: string;
    amount?: number | string;
    amount_major?: number | string;
    pay_amount?: number | string;
    price?: number | string;
    success_url?: string;
    fail_url?: string;
};

type WalletInstance = {
    productId: number;
    payment: WalletMethod;
    env: 'prod' | 'demo';
    clientSecret: string;
    successUrl: string;
    container: HTMLDivElement;
    element: Payment.ApplePayButtonElementType | Payment.GooglePayButtonElementType;
    ready: boolean;
};

function majorAmount(apiHint: unknown): number {
    if (typeof apiHint === 'number' && Number.isFinite(apiHint)) {
        return apiHint;
    }
    if (typeof apiHint === 'string') {
        const v = parseFloat(apiHint);
        if (Number.isFinite(v)) {
            return v;
        }
    }
    return 0;
}

/** 与 `init({ locale })` 对齐：避免 i18n 回退英文 */
function normalizeAirwallexLocale(reactLocale: string): NonNullable<Parameters<typeof init>[0]>['locale'] {
    const lower = reactLocale.replace(/_/g, '-').toLowerCase();
    if (lower === 'zh-hk' || lower === 'zh-tw' || lower.startsWith('zh-hant')) {
        return 'zh-HK';
    }
    if (lower.startsWith('zh')) {
        return 'zh';
    }
    const two = lower.slice(0, 2);
    const supported: NonNullable<Parameters<typeof init>[0]>['locale'][] = [
        'ar',
        'da',
        'de',
        'en',
        'es',
        'fi',
        'fr',
        'id',
        'it',
        'ja',
        'ko',
        'ms',
        'nl',
        'nl-NL',
        'pl',
        'pt',
        'ro',
        'ru',
        'sv',
        'zh',
        'zh-HK',
    ];
    for (const code of supported) {
        if (code === two || code === lower) {
            return code;
        }
    }
    return 'en';
}

export default function RadixRc({
    layout = 'page',
    onEmbedClose,
    productFrom = 'shopping',
    checkoutFrom = 'shopping',
}: RadixRcProps = {}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const location = useLocation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const walletRootRef = useRef<HTMLDivElement>(null);

    // 不依赖 ?walletDebug=1：钱包按钮始终挂在每个套餐卡下方（可切换显示/隐藏）
    const walletDebug = false;
    // false：在离屏 `walletRootRef` 挂载 Google Pay 按钮；套餐卡点击用同一用户手势 `confirmIntent` 拉起（无需在卡面上放 iframe 占位）
    const walletInline = false;

    const walletRedirectHref = useMemo(() => {
        if (typeof window === 'undefined') {
            return '';
        }
        return `${window.location.origin}${location.pathname}${location.search}`;
    }, [location.pathname, location.search]);

    const [products, setProducts] = useState<Product[]>(() => shoppingProductCache.get(productFrom) ?? []);
    const [loadingProducts, setLoadingProducts] = useState(
        () => !shoppingProductCache.has(productFrom),
    );
    const [currentId, setCurrentId] = useState<number | null>(() => {
        const cached = shoppingProductCache.get(productFrom);
        return cached?.[0]?.id ?? null;
    });

    const [payment, setPayment] = useState<number>(() => 2);
    const [walletReadyCount, setWalletReadyCount] = useState(0);
    const [walletInlineErrors, setWalletInlineErrors] = useState<Record<string, string>>({});
    const [walletConfirming, setWalletConfirming] = useState<Record<string, boolean>>({});
    const walletPoolTriggeredRef = useRef(false);
    /** 仅 `walletDebug` 调试用占位套餐；正式逻辑用接口返回的 `products` */
    const quickWalletPlans = useMemo<Product[]>(
        () => [
            { id: 1, type: 0, name: 'plan_1', price: '9.99', renewal_price: '0' },
        ],
        [],
    );
    /** 参与预加载的套餐（当前仅前 N 个做 Google Pay；N 见 `WALLET_GOOGLE_POOL_SIZE`） */
    const walletGooglePoolProducts = useMemo(
        () => products.slice(0, WALLET_GOOGLE_POOL_SIZE),
        [products],
    );

    /** Google Pay（payment===2）预创建实例数，与 `walletReadyCount` 对齐 */
    const walletTotalCount = useMemo(
        () => (payment === 2 ? walletGooglePoolProducts.length : 0),
        [payment, walletGooglePoolProducts.length],
    );

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

    function goCheckout(productId: number, payMethod: number) {
        navigate(`/page/pay/${productId}?payment=${payMethod}&from=${checkoutFrom}`);
    }

    const walletInitRef = useRef<{ env: 'prod' | 'demo'; done: boolean } | null>(null);
    const walletInstancesRef = useRef<Map<string, WalletInstance>>(new Map());

    const paymentConsent = useMemo(
        () =>
            ({
                next_triggered_by: 'merchant',
                merchant_trigger_reason: 'scheduled',
            }) as const,
        [],
    );

    const ensureWalletPool = useCallback(
        async (list: Product[]) => {
            if (!list.length) return;

            const root = walletDebug || walletInline ? null : walletRootRef.current;
            if (!walletDebug && !walletInline && !root) return;

            let appleGroup: HTMLDivElement | null = null;
            let googleGroup: HTMLDivElement | null = null;
            if (!walletDebug && !walletInline && root) {
                // 已挂载过分组则复用，避免再次 innerHTML 把 iframe 清掉但 Map 里还留着实例 → 永远 Loading
                const existingApple = root.querySelector<HTMLDivElement>('[data-wallet-group="apple"]');
                const existingGoogle = root.querySelector<HTMLDivElement>('[data-wallet-group="google"]');
                if (existingApple && existingGoogle) {
                    appleGroup = existingApple;
                    googleGroup = existingGoogle;
                } else {
                    root.innerHTML = '';
                    appleGroup = document.createElement('div');
                    appleGroup.dataset.walletGroup = 'apple';
                    googleGroup = document.createElement('div');
                    googleGroup.dataset.walletGroup = 'google';
                    appleGroup.style.position = 'absolute';
                    appleGroup.style.left = '-99999px';
                    appleGroup.style.top = '0';
                    googleGroup.style.position = 'absolute';
                    googleGroup.style.left = '-99999px';
                    googleGroup.style.top = '0';
                    root.appendChild(appleGroup);
                    root.appendChild(googleGroup);
                }
            }

            const createFor = async (p: Product, m: WalletMethod) => {
                const key = `${m}:${p.id}`;
                if (walletInstancesRef.current.has(key)) return;

                const res = await api<PayCreateData>('pay/create', {
                    method: 'post',
                    loading: false,
                    data: {
                        payment: m,
                        product_id: p.id,
                        redirect: walletRedirectHref,
                    },
                });
                if (res.c !== 0) {
                    return;
                }

                const d = res.d;
                if (!walletInitRef.current) {
                    walletInitRef.current = { env: d.env, done: false };
                }
                // env 不一致时以第一次为准（同一环境不应混用）
                const env = walletInitRef.current.env;

                if (!walletInitRef.current.done) {
                    await init({
                        locale: normalizeAirwallexLocale(intl.locale),
                        env,
                        enabledElements: ['payments'],
                    });
                    walletInitRef.current.done = true;
                }

                const currency = d.currency || 'USD';
                const amountValue = majorAmount(d.amount ?? d.amount_major ?? d.pay_amount ?? d.price);
                // googlePayButton 不需要 displayItems，这里无需 gPayLinePrice

                let container: HTMLDivElement | null = null;
                if (walletInline) {
                    container = document.querySelector<HTMLDivElement>(
                        `[data-wallet-inline-container="${m}:${p.id}"]`,
                    );
                    if (!container) {
                        // React 还没渲染出占位节点，跳过本次（下次 effect 会再跑）
                        return;
                    }
                    // iframe 按钮在握手(postMessage)失败时可能一直是 height:0；
                    // 但也要允许 SDK 自适应高度（不能长期固定 height，否则错误/提示会被裁掉）
                    container.style.minHeight = '44px';
                    container.style.display = 'block';
                    container.style.overflow = 'visible';
                } else if (walletDebug) {
                    container = document.querySelector<HTMLDivElement>(
                        `[data-wallet-debug-container="${m}:${p.id}"]`,
                    );
                    if (!container) {
                        // React 还没渲染出占位节点，跳过本次（下次 effect 会再跑）
                        return;
                    }
                    // 让调试挂载区有可见高度，方便你确认 iframe 是否出现
                    container.style.minHeight = '52px';
                } else {
                    container = document.createElement('div');
                    container.dataset.walletProductId = String(p.id);
                    container.style.width = '1px';
                    container.style.height = '1px';
                    container.style.overflow = 'hidden';

                    if (m === 1) {
                        appleGroup?.appendChild(container);
                    } else {
                        googleGroup?.appendChild(container);
                    }
                }

                const common = {
                    mode: 'recurring' as const,
                    intent_id: d.pi,
                    client_secret: d.client_secret,
                    customer_id: d.customer_id,
                    amount: { value: amountValue, currency },
                    payment_consent: paymentConsent,
                    autoCapture: true,
                };

                // 需求：点击白框任意区域即可拉起支付，因此用 Button Element（支持 confirmIntent）
                const element =
                    m === 1
                        ? ((await createElement('applePayButton', {
                              ...common,
                              countryCode: 'HK',
                              buttonType: 'subscribe',
                              appearance: { style: 'black' },
                          } as Payment.ApplePayButtonOptions)) as unknown as Payment.ApplePayButtonElementType)
                        : ((await createElement('googlePayButton', {
                              ...common,
                              countryCode: 'HK',
                              totalPriceStatus: 'FINAL',
                              totalPriceLabel: intl.formatMessage({
                                  id: 'checkout_googlepay_total_label',
                                  defaultMessage: 'Subscription due today',
                              }),
                              appearance: { theme: 'dark' },
                          } as Payment.GooglePayButtonOptions)) as unknown as Payment.GooglePayButtonElementType);

                const inst: WalletInstance = {
                    productId: p.id,
                    payment: m,
                    env,
                    clientSecret: d.client_secret,
                    successUrl: d.success_url || '',
                    container,
                    element,
                    ready: false,
                };

                const anyEl = element as unknown as {
                    on: (
                        code: 'ready' | 'success' | 'error',
                        handler: (e?: unknown) => void,
                    ) => void;
                };

                anyEl.on('ready', () => {
                    if (!inst.ready) {
                        inst.ready = true;
                        setWalletReadyCount((c) => c + 1);
                    }
                });

                anyEl.on('success', () => {
                    if (inst.successUrl) {
                        window.location.assign(inst.successUrl);
                    }
                });
                anyEl.on('error', (e) => {
                    const key = `${m}:${p.id}`;
                    let msg = '';
                    try {
                        msg = typeof e === 'string' ? e : JSON.stringify(e);
                    } catch {
                        msg = String(e);
                    }
                    setWalletInlineErrors((prev) => ({
                        ...prev,
                        [key]: msg || 'unknown error',
                    }));
                    console.warn('[shopping] wallet element error', { productId: p.id, m, e });
                });

                // 先 mount（在屏幕外），确保后续切换不需要重新渲染
                try {
                    element.mount(container);
                    // 兜底：如果 iframe 仍为 0 高度，延迟强制设置一次（避免按钮“挂了但看不见”）
                    if (walletInline) {
                        window.setTimeout(() => {
                            try {
                                const iframe = container?.querySelector<HTMLIFrameElement>('iframe');
                                const h = iframe?.style?.height ?? '';
                                const hv = Number.isFinite(parseFloat(h)) ? parseFloat(h) : 0;
                                if (iframe && hv <= 0) {
                                    iframe.style.height = '44px';
                                    iframe.style.minHeight = '44px';
                                }
                            } catch {
                                // ignore
                            }
                        }, 350);
                    }
                } catch {
                    // ignore
                }

                walletInstancesRef.current.set(key, inst);
            };

            // 并发预创建：仅 Google Pay
            await Promise.all(list.map((p) => createFor(p, 2)));
        },
        [intl, paymentConsent, walletRedirectHref, walletDebug, walletInline],
    );

    const walletPoolProductKey = walletGooglePoolProducts.map((p) => p.id).join(',');

    useEffect(() => {
        // `ensureWalletPool` 内只对每个套餐调用 `createFor(p, 2)`（Google Pay）
        if (walletDebug && walletInline) return;
        if (payment !== 2) return;
        if (!walletGooglePoolProducts.length) return;
        if (walletPoolTriggeredRef.current) return;

        let cancelled = false;
        let frames = 0;
        const maxFrames = 90;

        const tick = () => {
            if (cancelled) return;
            frames += 1;
            const root = walletRootRef.current;
            if (!root && frames < maxFrames) {
                requestAnimationFrame(tick);
                return;
            }
            if (!root || cancelled) {
                return;
            }
            walletPoolTriggeredRef.current = true;
            void ensureWalletPool(walletGooglePoolProducts).finally(() => {
                if (cancelled) return;
                const ok = walletGooglePoolProducts.every((p) =>
                    walletInstancesRef.current.has(`2:${p.id}`),
                );
                if (!ok) {
                    walletPoolTriggeredRef.current = false;
                    toast.error(
                        intl.formatMessage({
                            id: 'shopping_wallet_init_failed',
                            defaultMessage: 'Google Pay failed to initialize. Check network or refresh.',
                        }),
                    );
                }
            });
        };
        requestAnimationFrame(tick);
        return () => {
            cancelled = true;
            walletPoolTriggeredRef.current = false;
        };
    }, [
        payment,
        ensureWalletPool,
        walletGooglePoolProducts,
        walletPoolProductKey,
        walletDebug,
        walletInline,
        intl,
    ]);

    // 调试/内嵌：React 的占位容器渲染时机可能晚于预创建，这里做短时间重试确保 mount 上
    useEffect(() => {
        if (!walletDebug && !walletInline) return;
        if (payment !== 2) return;
        if (!quickWalletPlans.length) return;
        if (walletPoolTriggeredRef.current) return;

        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 60; // ~60 * 100ms = 6s

        const tick = async () => {
            if (cancelled) return;
            attempts += 1;
            const target = quickWalletPlans.length;
            const current = walletInstancesRef.current.size;
            if (current >= target) return;
            await ensureWalletPool(quickWalletPlans);
            if (attempts < maxAttempts) {
                window.setTimeout(tick, 100);
            }
        };

        window.setTimeout(tick, 0);
        return () => {
            cancelled = true;
        };
    }, [walletDebug, walletInline, payment, quickWalletPlans, ensureWalletPool]);

    // 切换方式只做 show/hide（节点不销毁）。调试模式下不做隐藏，直接全展示在每个套餐下方
    useEffect(() => {
        if (walletDebug || walletInline) {
            return;
        }
        const root = walletRootRef.current;
        if (!root) return;
        const apple = root.querySelector<HTMLDivElement>('[data-wallet-group="apple"]');
        const google = root.querySelector<HTMLDivElement>('[data-wallet-group="google"]');
        if (!apple || !google) return;
        const active: WalletMethod | null = payment === 1 ? 1 : payment === 2 ? 2 : null;
        apple.style.display = active === 1 ? 'block' : 'none';
        google.style.display = active === 2 ? 'block' : 'none';
    }, [payment, walletDebug, walletInline]);

    const triggerWalletPay = useCallback(
        async (productId: number, m: WalletMethod) => {
            const key = `${m}:${productId}`;
            const inst = walletInstancesRef.current.get(key);
            if (!inst) {
                toast.warning(intl.formatMessage({ id: 'loading', defaultMessage: 'Loading' }));
                return;
            }
            if (walletConfirming[key]) {
                return;
            }
            try {
                // Apple：部分环境依赖 SDK ready。Google：离屏/0 尺寸挂载时可能长期不触发 ready，用户点击仍须直接 confirmIntent（用户手势已满足）。
                if (!walletDebug && !inst.ready && m === 1) {
                    toast.warning(intl.formatMessage({ id: 'loading', defaultMessage: 'Loading' }));
                    return;
                }
                setWalletConfirming((prev) => ({ ...prev, [key]: true }));
                const confirmPromise = inst.element.confirmIntent({
                    client_secret: inst.clientSecret,
                    payment_consent: paymentConsent,
                } as Payment.ConfirmIntentData);
                const timeoutMs = 25_000;
                let timeoutId: number | null = null;
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutId = window.setTimeout(() => {
                        reject(new Error(`confirmIntent timeout after ${timeoutMs}ms`));
                    }, timeoutMs);
                });
                await Promise.race([confirmPromise, timeoutPromise]);
                if (timeoutId != null) {
                    window.clearTimeout(timeoutId);
                }
            } catch (e) {
                console.warn('[shopping] wallet confirmIntent failed', { productId, m, e });
                const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Payment failed';
                setWalletInlineErrors((prev) => ({ ...prev, [key]: msg }));
                // 有时 Airwallex 弹窗 iframe 已创建但样式为 display:none，这里兜底尝试展示出来
                try {
                    const popup = document.querySelector<HTMLIFrameElement>('iframe[title="Airwallex action popup"]');
                    if (popup) {
                        popup.style.display = 'block';
                    }
                } catch {
                    // ignore
                }
                toast.error(msg);
            } finally {
                setWalletConfirming((prev) => ({ ...prev, [key]: false }));
            }
        },
        [intl, paymentConsent, walletDebug, walletConfirming],
    );

    function handleSelectAndPay(productId: number) {
        setCurrentId(productId);
        if (payment === 3) {
            goCheckout(productId, payment);
            return;
        }
        if (payment === 1 || payment === 2) {
            // Demo：仅预建 `WALLET_GOOGLE_POOL_SIZE` 个 Google 实例；点击任意套餐卡都用池内 id 触发 confirmIntent → 谷歌原生支付层
            const walletProductId =
                payment === 2 && walletGooglePoolProducts[0]
                    ? walletGooglePoolProducts[0].id
                    : productId;
            void triggerWalletPay(walletProductId, payment as WalletMethod);
        }
    }

    function handlePaymentPick(payMethod: number) {
        setPayment(payMethod);
    }

    // 钱包节点池挂载点：避免 0×0 + z-index:-1 导致 iframe 不加载、ready 永不触发
    const walletPoolMount = (
        <div
            ref={walletRootRef}
            style={{
                position: 'fixed',
                left: -9999,
                top: 0,
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
            }}
            aria-hidden="true"
        />
    );

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

            {/* 调试：内嵌白框 + 透明按钮触发 Google Pay；正式环境用套餐卡 + 离屏钱包池 */}
            {walletDebug && walletInline && quickWalletPlans.length ? (
                <div className="mb-4 rounded-lg bg-white/5 p-3">
                    <div className="mb-2 text-sm font-semibold text-white/90">
                        Google Pay × 3 套餐（点击白框任意区域即可拉起支付）
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {quickWalletPlans.map((p, idx) => (
                            <div key={p.id} className="rounded bg-black/20 p-2">
                                <div className="mb-2 text-xs text-white/70">
                                    套餐 {idx + 1}（product_id={p.id}）${p.price}
                                </div>
                                <div className="relative rounded bg-white px-2 py-2">
                                    <div className="mb-1 text-xs font-semibold text-black/70">
                                        Google Pay ${p.price}
                                    </div>
                                    <div
                                        className="pointer-events-none"
                                        data-wallet-inline-container={`2:${p.id}`}
                                    />
                                    <button
                                        type="button"
                                        className={cn(
                                            'absolute inset-0 z-20 block h-full w-full bg-transparent',
                                            walletConfirming[`2:${p.id}`] ? 'cursor-not-allowed' : 'cursor-pointer',
                                        )}
                                        aria-label={`Google Pay ${p.price}`}
                                        onClick={() => {
                                            void triggerWalletPay(p.id, 2);
                                        }}
                                        disabled={walletConfirming[`2:${p.id}`]}
                                    />
                                    {walletConfirming[`2:${p.id}`] ? (
                                        <div className="mt-1 text-[11px] text-black/60">处理中…</div>
                                    ) : null}
                                    {walletInlineErrors[`2:${p.id}`] ? (
                                        <div className="mt-1 break-all text-[11px] text-red-600">
                                            {walletInlineErrors[`2:${p.id}`]}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                    {!walletDebug && walletReadyCount < walletTotalCount ? (
                        <div className="mt-2 text-xs text-white/60">
                            钱包加载中：{walletReadyCount}/{walletTotalCount}（加载完成后按钮可点击）
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="rs-shopping__plans">
                {(loadingProducts ? [] : products).map((p) => (
                    <div key={p.id}>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                handleSelectAndPay(p.id);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelectAndPay(p.id);
                                }
                            }}
                            className={cn(
                                'rs-shopping__plan',
                                currentId === p.id && 'rs-shopping__plan--selected',
                            )}
                        >
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
                                <img className="rs-shopping__planBenefitIcon" src={icon1080p} alt="" />
                                <FormattedMessage id="shopping_benefit_1080p" />
                            </div>
                        </div>
                        </div>

                        {walletDebug ? (
                            <div className="mt-2 rounded bg-white/10 p-2">
                                <div className="mb-2 text-xs text-white/70">
                                    Wallet pool ready: {walletReadyCount}/{walletTotalCount} (debug)
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        className="mb-2 w-full rounded bg-white px-3 py-2 text-sm font-bold text-black"
                                        onClick={() => {
                                            void triggerWalletPay(p.id, 2);
                                        }}
                                    >
                                        Google Pay (debug)
                                    </button>
                                    <div
                                        data-wallet-debug-container={`2:${p.id}`}
                                        className="w-full overflow-visible rounded bg-white/5 p-2"
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
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
                </div>
            </div>
        </div>
    );

    if (layout === 'embed') {
        const closeAria = intl.formatMessage({ id: 'close', defaultMessage: 'Close' });
        return (
            <>
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
            {walletPoolMount}
            </>
        );
    }

    return (
        <>
        <div className="rs-shopping">
            <div ref={scrollRef} className="rs-shopping__scroll">
                <ReelShortTopNav scrollParentRef={scrollRef} showSearch={true} />
                {main}
                <ReelShortFooter />
            </div>
        </div>
        {walletPoolMount}
        </>
    );
}
