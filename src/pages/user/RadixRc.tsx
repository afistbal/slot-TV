import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import vipCardBg from '@/assets/images/5c3ff370-f045-11f0-84ad-6b5693b490dc.png';
import iconUnlimitedViewing from '@/assets/images/icon_unlimited_viewing.png';
import icon1080p from '@/assets/images/icon_1080p.png';
import payIconBack from '@/assets/images/pay_icon_back.png';
import iconSecure from '@/assets/icons/shopping-pay/icon_secure.png';
import checkboxChecked from '@/assets/icons/shopping-pay/checkbox_checked.png';
import iconSuccessful from '@/assets/icons/shopping-pay/icon_successful.png';
import btnLoadingIcon from '@/assets/images/btn_loading.svg';
import Countdown from '@/widgets/Countdown';
import coinIcon from '@/assets/coin.svg';
import RadixRcShoppingPaySection from '@/pages/user/RadixRcShoppingPaySection';
import { ShoppingPaidServiceAgreementContent } from '@/pages/user/ShoppingPaidServiceAgreementContent';
import { MembershipInlinePanel } from '@/pages/user/Membership';
import { refreshSessionFromStoredToken } from '@/lib/refreshSessionFromStoredToken';
import { useUserStore } from '@/stores/user';
import type { IPlayerEpisode } from '@/types/videoPlayer';

function paywallImage(file: string) {
    return new URL(`../../assets/images/${file}`, import.meta.url).href;
}

/** 与 `layouts/user` 的 `Page` 顶栏一致（`/shopping` 已 VIP 时用，避免与未 VIP 的 `ReelShortTopNav` 视觉不一致） */
function ShoppingVipMembershipHeader() {
    const navigate = useNavigate();
    if (
        typeof window !== 'undefined' &&
        // @ts-expect-error Flutter InAppWebView
        window.flutter_inappwebview
    ) {
        return null;
    }
    return (
        <div
            className={cn(
                'relative flex shrink-0 items-center justify-center border-b border-white/10 bg-app-canvas text-white',
                'min-h-[calc(44/375*var(--app-vw))]',
            )}
        >
            <div className="absolute left-1 top-1/2 -translate-y-1/2 md:left-6">
                <button
                    type="button"
                    onClick={() => navigate('/profile?tab=topup')}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-white/90 hover:bg-white/10 active:bg-white/15"
                >
                    {document.body.style.direction === 'ltr' ? (
                        <ChevronLeft className="h-7 w-7" />
                    ) : (
                        <ChevronRight className="h-7 w-7" />
                    )}
                </button>
            </div>
            <div className="mx-auto max-w-[70%] truncate text-center text-lg">
                <FormattedMessage id="my_membership" />
            </div>
        </div>
    );
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
    coin?: number;
    bouns?: string;
};

/** 与金币包列表 grid 一致：基础币 + `bouns` 比例折算的赠送币，用于支付弹窗展示（不影响 type=1 订阅分支） */
function totalCoinsForCoinProduct(p: Pick<Product, 'coin' | 'bouns'>): number {
    const baseCoin = p.coin ?? 0;
    const bonus = Number.parseFloat(p.bouns ?? '0');
    const bonusCoins =
        baseCoin > 0 && Number.isFinite(bonus) ? Math.round(baseCoin * bonus) : 0;
    return baseCoin + bonusCoins;
}

function pickDefaultSubscriptionPlanId(list: Product[]): number | null {
    const subs = list.filter((p) => p.type === 1);
    const planPick = subs.length > 0 ? subs : list;
    return planPick[0]?.id ?? null;
}

export type RadixRcLayout = 'page' | 'embed';

export type RadixRcProps = {
    /** 整页：站点顶栏+底栏；嵌入：仅购物主体，可选 VIP 顶栏 */
    layout?: RadixRcLayout;
    /** `layout=embed` 时：顶栏右侧关闭 */
    onEmbedClose?: () => void;
    /**
     * `layout=embed`：`drawer` 含倒计时条与关闭钮（剧集付费抽屉）；
     * `plain` 仅主体，用于 PC 账户页右栏。
     */
    embedPresentation?: 'drawer' | 'plain';
    /** `product` 接口的 `from` */
    productFrom?: 'shopping' | 'video';
    /** 跳转收银台 URL 的 `from=` */
    checkoutFrom?: 'shopping' | 'video';
    /**
     * 嵌入购物（剧集抽屉 / PC 弹窗）：在 VIP 说明下展示「價格」（解锁所需金币）；不传则不展示该行（如 `/profile?tab=topup`）。
     */
    headerEpisodeUnlockCoins?: number;
    /** `layout=embed` 且 `productFrom=video`：支付成功并刷新 token 后，再打 `movie/episode?id=` 并把 `d` 交给播放器 */
    embedVideoEpisodeRowId?: number;
    onEmbedPaySuccessEpisodeDetail?: (episode: IPlayerEpisode) => void;
};

type ProductFromKey = NonNullable<RadixRcProps['productFrom']>;
type PayModalStatus = 'idle' | 'processing' | 'checking' | 'success' | 'failed';

/** SPA 内复用：整页 / 视频抽屉反复打开不重复打 `product` 接口、不闪骨架 */
const shoppingProductCache = new Map<ProductFromKey, Product[]>();

export default function RadixRc({
    layout = 'page',
    onEmbedClose,
    embedPresentation = 'drawer',
    productFrom = 'shopping',
    checkoutFrom = 'shopping',
    headerEpisodeUnlockCoins,
    embedVideoEpisodeRowId,
    onEmbedPaySuccessEpisodeDetail,
}: RadixRcProps = {}) {
    const intl = useIntl();
    const userStore = useUserStore();
    const [searchParams] = useSearchParams();
    /** 仅整页 `/shopping` 支持从外链强制展示套餐；嵌入 profile / 抽屉不带该语义。 */
    const forceShowPlans = layout === 'page' && searchParams.get('show_plans') === '1';
    const scrollRef = useRef<HTMLDivElement>(null);

    /** 整页 `/shopping`：已 VIP 展示会员信息，否则展示订阅套餐；`?show_plans=1` 时强制展示套餐。 */
    const showMembershipOnShoppingPage =
        layout === 'page' && productFrom === 'shopping' && userStore.isVIP() && !forceShowPlans;
    /** PC `/profile?tab=topup`（embed plain）：已 VIP 也展示会员信息。 */
    const showMembershipOnProfileEmbedTopup =
        layout === 'embed' &&
        embedPresentation === 'plain' &&
        productFrom === 'shopping' &&
        userStore.isVIP() &&
        !forceShowPlans;

    const [products, setProducts] = useState<Product[]>(() => shoppingProductCache.get(productFrom) ?? []);
    const [loadingProducts, setLoadingProducts] = useState(
        () => !shoppingProductCache.has(productFrom),
    );
    const [currentId, setCurrentId] = useState<number | null>(() => {
        const cached = shoppingProductCache.get(productFrom);
        return cached?.length ? pickDefaultSubscriptionPlanId(cached) : null;
    });
    const [showPayModal, setShowPayModal] = useState(false);
    const [showPaidServiceAgreement, setShowPaidServiceAgreement] = useState(false);
    const [payModalStatus, setPayModalStatus] = useState<PayModalStatus>('idle');
    const [paySessionSeed, setPaySessionSeed] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function syncSession() {
            if (!localStorage.getItem('token')) {
                return;
            }
            try {
                await refreshSessionFromStoredToken();
            } catch {
                // 静默失败：保留当前会话，不阻塞页面渲染。
            }
        }

        /** 进入页面时拉一次会话即可 */
        void syncSession();

        /**
         * 不在 `window` 上监听 `focus`：嵌入 Profile 时，点登录弹窗等操作会误触 focus，
         * 导致频繁 `login/token`。切回标签页用 visibility 即可覆盖「后台回来」场景。
         */
        let tabWasHidden = document.visibilityState === 'hidden';
        function handleVisibilityChange() {
            if (cancelled) return;
            if (document.visibilityState === 'hidden') {
                tabWasHidden = true;
                return;
            }
            if (document.visibilityState === 'visible' && tabWasHidden) {
                tabWasHidden = false;
                void syncSession();
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (!localStorage.getItem('token')) return;
        const needBalance =
            layout === 'embed' || (layout === 'page' && productFrom === 'shopping');
        if (!needBalance) return;
        void api<number>('user/balance', { loading: false }).then((res) => {
            if (res.c === 0) useUserStore.getState().setBalance(res.d);
        });
    }, [layout, productFrom]);

    function closePayModal() {
        setShowPaidServiceAgreement(false);
        setPayModalStatus('idle');
        setShowPayModal(false);
        setPaySessionSeed((prev) => prev + 1);
    }

    useEffect(() => {
        if (payModalStatus !== 'success' || !showPayModal) return;
        const timer = window.setTimeout(() => {
            void (async () => {
                setShowPaidServiceAgreement(false);
                setPayModalStatus('idle');
                setShowPayModal(false);
                setPaySessionSeed((prev) => prev + 1);
                await refreshSessionFromStoredToken();
                if (
                    layout === 'embed' &&
                    productFrom === 'video' &&
                    embedVideoEpisodeRowId != null &&
                    embedVideoEpisodeRowId > 0
                ) {
                    const viewerIsVip = useUserStore.getState().isVIP();
                    const res = await api<IPlayerEpisode>('movie/episode', {
                        data: {
                            id: embedVideoEpisodeRowId,
                            auto_unlock: viewerIsVip ? 0 : 1,
                        },
                        loading: false,
                    });
                    if (res.c === 0) {
                        onEmbedPaySuccessEpisodeDetail?.(res.d);
                    }
                }
                if (layout === 'embed') {
                    onEmbedClose?.();
                }
            })();
        }, 2500);
        return () => window.clearTimeout(timer);
    }, [
        payModalStatus,
        showPayModal,
        layout,
        onEmbedClose,
        productFrom,
        embedVideoEpisodeRowId,
        onEmbedPaySuccessEpisodeDetail,
    ]);

    useEffect(() => {
        if (payModalStatus !== 'processing' || !showPayModal) return;
        const timer = window.setTimeout(() => {
            setPayModalStatus((prev) => (prev === 'processing' ? 'checking' : prev));
        }, 1200);
        return () => window.clearTimeout(timer);
    }, [payModalStatus, showPayModal]);

    useEffect(() => {
        if ((payModalStatus !== 'processing' && payModalStatus !== 'checking') || !showPayModal) return;
        const timer = window.setTimeout(() => {
            setPayModalStatus('failed');
        }, 30000);
        return () => window.clearTimeout(timer);
    }, [payModalStatus, showPayModal]);

    useEffect(() => {
        const cached = shoppingProductCache.get(productFrom);
        if (cached?.length) {
            setProducts(cached);
            setCurrentId(pickDefaultSubscriptionPlanId(cached));
            setLoadingProducts(false);
            return;
        }

        let alive = true;
        setLoadingProducts(true);
        setProducts([]);
        setCurrentId(null);
        api<Product[]>('product', {
            data: { from: productFrom, type: 10 },
            loading: false,
        })
            .then((res) => {
                if (!alive) return;
                if (res.c !== 0) return;
                shoppingProductCache.set(productFrom, res.d);
                setProducts(res.d);
                setCurrentId(pickDefaultSubscriptionPlanId(res.d));
            })
            .finally(() => {
                if (!alive) return;
                setLoadingProducts(false);
            });
        return () => {
            alive = false;
        };
    }, [productFrom]);

    const planProducts = useMemo(() => {
        const subs = products.filter((p) => p.type === 1);
        return subs.length > 0 ? subs : products;
    }, [products]);
    const coinProducts = useMemo(() => {
        const rows = products.filter((p) => p.type === 2);
        return [...rows].sort((a, b) => {
            const ao = a.name.includes('off') ? 1 : 0;
            const bo = b.name.includes('off') ? 1 : 0;
            if (ao !== bo) return bo - ao;
            return a.id - b.id;
        });
    }, [products]);
    const defaultWalletProductId = useMemo(() => {
        const p999 = planProducts.find((p) => Math.abs(parseFloat(p.price) - 9.99) < 0.001);
        return p999?.id ?? planProducts[0]?.id ?? null;
    }, [planProducts]);
    const walletProductId = currentId ?? defaultWalletProductId;
    const checkoutTargetProductId = currentId ?? defaultWalletProductId ?? planProducts[0]?.id ?? null;
    const currentCheckoutProduct = useMemo(
        () => products.find((p) => p.id === checkoutTargetProductId) ?? null,
        [products, checkoutTargetProductId],
    );
    const retryAmount = currentCheckoutProduct?.price ? `$${currentCheckoutProduct.price}` : '';

    function handleSelectPlan(productId: number) {
        setCurrentId(productId);
        setPayModalStatus('idle');
        setShowPaidServiceAgreement(false);
        setShowPayModal(true);
        setPaySessionSeed((prev) => prev + 1);
    }

    const showCountdown = !loadingProducts && products.length > 0;
    const countdownMainEl = showCountdown ? (
        <div className="rs-shopping__countdown">
            <Countdown />
        </div>
    ) : null;

    const showIntroWalletAndCountdown =
        layout === 'embed' || (layout === 'page' && productFrom === 'shopping');
    const isEmbedDrawer = layout === 'embed' && embedPresentation === 'drawer';
    /** 整页 `/shopping`：顶栏式账户条（与参考 H5 布局一致），餘額不再叠在副标题下 */
    const showShoppingPageWalletBar = layout === 'page' && productFrom === 'shopping';

    /** 整页 `/shopping` 顶栏钱包条：仅展示金幣总额（与 PC 侧栏一致），不重复帳戶餘額/贈送 */
    const shoppingPageWalletDisplay = useMemo(() => {
        if (!userStore.signed || userStore.balance < 0) {
            return { total: 0, pending: userStore.signed && userStore.balance === -1 };
        }
        return { total: userStore.balance, pending: false };
    }, [userStore.signed, userStore.balance]);

    function formatWalletAmount(n: number, pending: boolean) {
        if (pending) return '···';
        return intl.formatNumber(n);
    }

    const embedWalletRowsEl = (
        <>
            {headerEpisodeUnlockCoins !== undefined ? (
                <div className="flex items-center text-sm text-white/75">
                    <FormattedMessage id="episode_unlock_price" />
                    <img src={coinIcon} width={18} height={18} className="ml-1 shrink-0" alt="" />
                    <div className="text-orange-400 font-bold tabular-nums">
                        {intl.formatNumber(headerEpisodeUnlockCoins)}
                    </div>
                </div>
            ) : null}
            <div
                className={cn(
                    'flex items-center text-sm text-white/75',
                    headerEpisodeUnlockCoins !== undefined && 'mt-1',
                )}
            >
                <FormattedMessage id="balance" />
                <img src={coinIcon} width={18} height={18} className="ml-1 shrink-0" alt="" />
                <div className="text-orange-400 font-bold tabular-nums">
                    {!userStore.signed ? 0 : userStore.balance === -1 ? '···' : intl.formatNumber(userStore.balance)}
                </div>
            </div>
        </>
    );

    const main = (
        <div className="rs-shopping__main">
            <div className="rs-shopping__intro">
                {showShoppingPageWalletBar ? (
                    <div className="rs-shopping__pageWalletBar">
                        <div className="rs-shopping__pageWalletBar__row rs-shopping__pageWalletBar__row--singleCoins">
                            <div className="rs-shopping__pageWalletBar__stat">
                                <span className="rs-shopping__pageWalletBar__statInner">
                                    <span className="rs-shopping__pageWalletBar__muted">
                                        <FormattedMessage id="shopping_bar_coins" />
                                    </span>
                                    <span className="rs-shopping__pageWalletBar__colon">:</span>
                                    <span className="rs-shopping__pageWalletBar__statValue tabular-nums">
                                        <img src={coinIcon} alt="" aria-hidden />
                                        {formatWalletAmount(
                                            shoppingPageWalletDisplay.total,
                                            shoppingPageWalletDisplay.pending,
                                        )}
                                    </span>
                                </span>
                            </div>
                            <Link to="/user/my-balance" className="rs-shopping__pageWalletBar__history">
                                <span className="rs-shopping__pageWalletBar__historyLabel">
                                    <FormattedMessage id="shopping_bar_history" />
                                </span>
                                <ChevronRight className="rs-shopping__pageWalletBar__historyChev" aria-hidden />
                            </Link>
                        </div>
                    </div>
                ) : null}
                <div className="rs-shopping__introTitle">
                    <FormattedMessage id="shopping_vip_unlock_all" />
                </div>
                <div className="rs-shopping__introSub">
                    <FormattedMessage id="shopping_auto_renew_cancel_anytime" />
                </div>
                {showIntroWalletAndCountdown && (!isEmbedDrawer || countdownMainEl) ? (
                    <div className="rs-shopping__introEmbedExtras">
                        {isEmbedDrawer || showShoppingPageWalletBar ? null : (
                            <div className="rs-shopping__embedWallet">{embedWalletRowsEl}</div>
                        )}
                        {countdownMainEl}
                    </div>
                ) : null}
            </div>

            <div className={cn('rs-shopping__plans', 'rs-shopping__plans--vipSubscriptions')}>
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
                                {/* {currentId === p.id ? (
                                    <img
                                        className="rs-shopping__planCheckedIcon"
                                        src={checkedIcon}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                ) : null} */}

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

            {!loadingProducts && coinProducts.length > 0 ? (
                <div className="mt-3 w-full shadow-none">
                    <div className="mb-3 w-full text-[calc(16/375*var(--app-vw,100vw))] font-bold leading-tight text-white/90 md:text-[16px]">
                        <FormattedMessage id="shopping_top_up_coins" />
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 shadow-none md:grid-cols-4">
                        {coinProducts.map((p) => {
                            const baseCoin = p.coin ?? 0;
                            const totalCoins = totalCoinsForCoinProduct(p);
                            const bonus = Number.parseFloat(p.bouns ?? '0');
                            const bonusCoins =
                                baseCoin > 0 && Number.isFinite(bonus)
                                    ? Math.round(baseCoin * bonus)
                                    : 0;
                            const bonusPct = bonus > 0 ? Math.round(bonus * 100) : 0;
                            return (
                                <div
                                    key={p.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleSelectPlan(p.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleSelectPlan(p.id);
                                        }
                                    }}
                                    className={cn(
                                        'rs-shopping__coinSku relative flex w-full cursor-pointer flex-col rounded-[4px] p-4 shadow-none',
                                        'outline-none focus-visible:outline-none',
                                    )}
                                >
                                    {bonusPct > 0 ? (
                                        <div
                                            className={cn(
                                                'absolute right-0 top-0 flex h-4 min-w-[2.25rem] items-center justify-center rounded-tr-[4px] rounded-bl-[4px] px-2',
                                                'bg-gradient-to-r from-[#E52E2E] to-[#EB4C46]',
                                                'text-[10px] font-medium leading-none text-white md:text-xs',
                                            )}
                                        >
                                            +{bonusPct}%
                                        </div>
                                    ) : null}
                                    <div className="mb-1 flex items-center text-base font-bold text-white md:text-lg">
                                        <img src={coinIcon} alt="" className="mr-1 h-5 w-5 shrink-0 md:h-6 md:w-6" />
                                        <span className="tabular-nums">
                                            {intl.formatNumber(totalCoins)}
                                        </span>
                                    </div>
                                    {bonusCoins > 0 ? (
                                        <div className="min-h-[2rem] text-[10px] font-normal leading-snug text-white/50 md:text-xs md:leading-[17px]">
                                            <div>
                                                <FormattedMessage
                                                    id="shopping_coin_immediate"
                                                    values={{ n: intl.formatNumber(baseCoin) }}
                                                />
                                            </div>
                                            <div>
                                                <FormattedMessage
                                                    id="shopping_coin_free"
                                                    values={{ n: intl.formatNumber(bonusCoins) }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="min-h-[2rem] text-[10px] text-white/50 md:text-xs">
                                            <FormattedMessage
                                                id="shopping_coin_total_only"
                                                values={{ n: intl.formatNumber(baseCoin) }}
                                            />
                                        </div>
                                    )}
                                    <div className="mt-2 text-left text-base font-medium text-white/90 md:mt-3">
                                        ${p.price}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}

        </div>
    );

    const payModal = showPayModal ? (
        <>
            <div
                className={cn(
                    'rs-shopping__payModalMask',
                    layout === 'embed' && 'rs-shopping__payModalMask--nested',
                )}
            >
                <div className="rs-shopping__payModalPanel" role="dialog" aria-modal="true">
                    <div className="rs-shopping__payModalBody">
                        <div
                            className={cn(
                                'rs-shopping__payStage rs-shopping__payStage--base',
                                payModalStatus !== 'idle' && 'rs-shopping__payStage--hidden',
                            )}
                        >
                            <div className="rs-shopping__payModalHeader">
                                <button
                                    type="button"
                                    className="rs-shopping__payModalBackBtn"
                                    onClick={closePayModal}
                                    aria-label={intl.formatMessage({ id: 'close', defaultMessage: 'Close' })}
                                >
                                    <img src={payIconBack} alt="" className="rs-shopping__payModalBackIcon" />
                                </button>
                                <div className="rs-shopping__payModalTitle">
                                    <FormattedMessage id="payment_processing_title" />
                                </div>
                            </div>
                            <div className="rs-shopping__payModalCopy">
                                {currentCheckoutProduct?.type === 2 &&
                                totalCoinsForCoinProduct(currentCheckoutProduct) > 0 ? (
                                    <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white">
                                        <img src={coinIcon} alt="" width={16} height={16} />
                                        <span>
                                            {intl.formatNumber(
                                                totalCoinsForCoinProduct(currentCheckoutProduct),
                                            )}
                                        </span>
                                        <span className="text-white/70">·</span>
                                        <span>${currentCheckoutProduct.price}</span>
                                    </p>
                                ) : null}
                                <p>
                                    <FormattedMessage id="payment_processing_line_1" />
                                </p>
                                <p>
                                    <FormattedMessage id="payment_processing_line_2" />
                                </p>
                                <p>
                                    <FormattedMessage id="payment_processing_line_3" />
                                </p>
                                <p className="rs-shopping__payModalCopyLine4">
                                    <span>
                                        <FormattedMessage id="payment_processing_line_4" />
                                    </span>
                                    <span className="rs-shopping__payModalCopyAmount">{retryAmount}</span>
                                </p>
                            </div>
                            {/* 支付进行中勿用 key 整棵卸载本区，以免 destroy 丢 on('success')/on('error')；重试用 paySessionSeed prop 重建钱包 effect。redirectToCheckout 以回跳+Webhook/查单为准。 */}
                            <div className="rs-shopping__payStack">
                                <RadixRcShoppingPaySection
                                    key={String(walletProductId ?? 'wallet')}
                                    walletProductId={walletProductId}
                                    checkoutTargetProductId={checkoutTargetProductId}
                                    checkoutFrom={checkoutFrom}
                                    checkoutProductMeta={
                                        currentCheckoutProduct
                                            ? {
                                                  id: currentCheckoutProduct.id,
                                                  name: currentCheckoutProduct.name,
                                                  price: currentCheckoutProduct.price,
                                              }
                                            : null
                                    }
                                    paySessionSeed={paySessionSeed}
                                    onPayStateChange={setPayModalStatus}
                                />
                            </div>
                        </div>

                        <div
                            className={cn(
                                'rs-shopping__payStage rs-shopping__payStage--status',
                                payModalStatus === 'idle' && 'rs-shopping__payStage--hidden',
                            )}
                            aria-live="polite"
                        >
                            {payModalStatus === 'success' ? (
                                <div className="rs-shopping__payStatusPanel rs-shopping__payStatusPanel--processing rs-shopping__payStatusPanel--success">
                                    <div className="rs-shopping__payStatusLead">
                                        <div className="rs-shopping__payStatusLeadTitle">
                                            <FormattedMessage
                                                id="shopping_pay_status_success"
                                                defaultMessage="Payment successful"
                                            />
                                        </div>
                                    </div>
                                    <img
                                        className="rs-shopping__payStatusSuccessIcon"
                                        src={iconSuccessful}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                    <p className="rs-shopping__payStatusDesc">
                                        <FormattedMessage id="shopping_pay_status_patience" />
                                    </p>
                                </div>
                            ) : null}

                            {payModalStatus === 'failed' ? (
                                <div className="rs-shopping__payStatusPanel rs-shopping__payStatusPanel--failed">
                                    <div className="rs-shopping__payStatusTitle">
                                        <FormattedMessage id="shopping_pay_status_failed" />
                                    </div>
                                    <p className="rs-shopping__payStatusDesc">
                                        <FormattedMessage id="shopping_pay_status_failed_desc" />
                                    </p>
                                    <button
                                        type="button"
                                        className="rs-shopping__payStatusRetryBtn"
                                        onClick={() => {
                                            // 强制重建支付组件，避免复用已消费/失效的 Airwallex intent。
                                            setPaySessionSeed((prev) => prev + 1);
                                            setPayModalStatus('idle');
                                        }}
                                    >
                                        <FormattedMessage id="shopping_pay_status_return" />
                                    </button>
                                </div>
                            ) : null}

                            {payModalStatus === 'processing' || payModalStatus === 'checking' ? (
                                <div className="rs-shopping__payStatusPanel rs-shopping__payStatusPanel--processing">
                                    <div className="rs-shopping__payStatusLead">
                                        <div className="rs-shopping__payStatusLeadTitle">
                                            <FormattedMessage
                                                id={
                                                    payModalStatus === 'checking'
                                                        ? 'shopping_pay_status_checking_title'
                                                        : 'payment_processing_title'
                                                }
                                                defaultMessage={
                                                    payModalStatus === 'checking'
                                                        ? 'The payment status is being checked'
                                                        : 'Processing Your Payment'
                                                }
                                            />
                                        </div>
                                        {payModalStatus === 'checking' ? (
                                            <p className="rs-shopping__payStatusLeadBody">
                                                <FormattedMessage
                                                    id="shopping_pay_status_checking_desc"
                                                    defaultMessage="Please wait a moment. Thank you!!!"
                                                />
                                            </p>
                                        ) : (
                                            <>
                                                <p className="rs-shopping__payStatusLeadBody">
                                                    <FormattedMessage id="payment_processing_line_1" />
                                                </p>
                                                <p className="rs-shopping__payStatusLeadBody">
                                                    <FormattedMessage id="payment_processing_line_2" />
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <img
                                        className="rs-shopping__payStatusSpinner"
                                        src={btnLoadingIcon}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                    <div className="rs-shopping__payStatusTitle">
                                        <FormattedMessage id="loading" defaultMessage="Loading" />
                                    </div>
                                    <p className="rs-shopping__payStatusDesc">
                                        <FormattedMessage id="shopping_pay_status_patience" />
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="rs-shopping__payModalFooter">
                        <div className="rs-shopping__payModalSecure">
                            <img src={iconSecure} alt="" className="rs-shopping__payModalSecureIcon" />
                            <span>
                                <FormattedMessage id="payment_secure_notice" />
                            </span>
                        </div>
                        <div className="rs-shopping__payModalAgreement">
                            <span className="rs-shopping__payModalAgreementMark" aria-hidden="true">
                                <img
                                    src={checkboxChecked}
                                    alt=""
                                    className="rs-shopping__payModalAgreementCheckImg"
                                />
                            </span>
                            <div className="rs-shopping__payModalAgreementCopy">
                                <span className="rs-shopping__payModalAgreementText">
                                    <FormattedMessage id="shopping_pay_agreement_prefix" />
                                    <button
                                        type="button"
                                        className="rs-shopping__payModalAgreementLink"
                                        onClick={() => setShowPaidServiceAgreement(true)}
                                    >
                                        <FormattedMessage id="shopping_pay_agreement_link" />
                                    </button>
                                    {/* <FormattedMessage id="shopping_pay_agreement_suffix" /> */}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Drawer
                direction="bottom"
                open={showPaidServiceAgreement}
                onOpenChange={setShowPaidServiceAgreement}
            >
                <DrawerContent
                    aria-labelledby="rs-shopping-paid-agreement-title"
                    aria-describedby="rs-shopping-paid-agreement-desc"
                    overlayClassName="rs-shopping__paidAgreementDialogOverlay"
                    className="rs-shopping__paidAgreementPanel rs-shopping__paidAgreementDialogContent"
                >
                    <DrawerTitle className="sr-only">
                        {intl.formatMessage({ id: 'shopping_paid_service_agreement_title' })}
                    </DrawerTitle>
                    <DrawerDescription id="rs-shopping-paid-agreement-desc" className="sr-only">
                        {intl.formatMessage({
                            id: 'payment_processing_line_1',
                            defaultMessage: 'Please read the paid service agreement carefully.',
                        })}
                    </DrawerDescription>
                    <div className="rs-shopping__paidAgreementHead">
                        <button
                            type="button"
                            className="rs-shopping__paidAgreementBackBtn"
                            onClick={() => setShowPaidServiceAgreement(false)}
                            aria-label={intl.formatMessage({ id: 'close', defaultMessage: 'Close' })}
                        >
                            <svg
                                className="rs-shopping__paidAgreementBackSvg"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                        <h1 id="rs-shopping-paid-agreement-title" className="rs-shopping__paidAgreementHeadTitle">
                            <FormattedMessage id="shopping_paid_service_agreement_title" />
                        </h1>
                    </div>
                    <div className="rs-shopping__paidAgreementScroll">
                        <ShoppingPaidServiceAgreementContent />
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    ) : null;

    if (layout === 'embed') {
        if (showMembershipOnProfileEmbedTopup) {
            return (
                <div className="rs-shopping-drawer-sheet rs-shopping-drawer-sheet--profilePlain">
                    <div className="rs-shopping rs-shopping--drawerEmbed rs-shopping--vipMembership">
                        <div ref={scrollRef} className="rs-shopping__membershipPageBody">
                            <MembershipInlinePanel />
                        </div>
                        {showPayModal && typeof document !== 'undefined'
                            ? createPortal(
                                  <div className="rs-shopping rs-shopping--payModalEmbedPortal">{payModal}</div>,
                                  document.body,
                              )
                            : null}
                    </div>
                </div>
            );
        }

        const closeAria = intl.formatMessage({ id: 'close', defaultMessage: 'Close' });
        const showDrawerChrome = embedPresentation === 'drawer';
        return (
            <div
                className={cn(
                    'rs-shopping-drawer-sheet',
                    embedPresentation === 'plain' && 'rs-shopping-drawer-sheet--profilePlain',
                    embedPresentation === 'drawer' && 'rs-shopping-drawer-sheet--videoDrawer',
                )}
            >
                {/* embed 须包 `.rs-shopping`，否则 SCSS 中 `.rs-shopping .rs-shopping__*`（含顶栏倒计时）无法命中 */}
                <div className="rs-shopping rs-shopping--drawerEmbed">
                    {showDrawerChrome ? (
                        <>
                            <div className="rs-shopping-drawer-head rs-shopping-drawer-head--reelshort">
                                <div className="rs-shopping-drawer-head__kvGroup">
                                    <div className="rs-shopping-drawer-head__kvStack">
                                        <div
                                            className={cn(
                                                'rs-shopping__embedWallet',
                                                'rs-shopping-drawer-head__embedWallet',
                                            )}
                                        >
                                            {embedWalletRowsEl}
                                        </div>
                                    </div>
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
                            <div className="rs-shopping-drawer-embedBody">{main}</div>
                        </>
                    ) : (
                        main
                    )}
                    {showPayModal && typeof document !== 'undefined'
                        ? createPortal(
                              <div className="rs-shopping rs-shopping--payModalEmbedPortal">{payModal}</div>,
                              document.body,
                          )
                        : null}
                </div>
            </div>
        );
    }

    /* 已 VIP：与 `layouts/user` 的 `Page` 同级结构 — 顶栏在滚动区外，正文单独 `overflow-auto`，避免顶栏跟着滚、也避免会员区 `min-height:100%` 在嵌套滚动里撑出大块空档 */
    if (showMembershipOnShoppingPage) {
        return (
            <div className="rs-shopping rs-shopping--vipMembership">
                <ShoppingVipMembershipHeader />
                <div ref={scrollRef} className="rs-shopping__membershipPageBody">
                    <MembershipInlinePanel />
                </div>
                {payModal}
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
            {payModal}
        </div>
    );
}
