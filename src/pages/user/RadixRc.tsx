import { useEffect, useMemo, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import vipCardBg from '@/assets/images/5c3ff370-f045-11f0-84ad-6b5693b490dc.png';
import iconUnlimitedViewing from '@/assets/images/icon_unlimited_viewing.png';
import icon1080p from '@/assets/images/icon_1080p.png';
import checkedIcon from '@/assets/images/checked.png';
import Countdown from '@/widgets/Countdown';
import RadixRcShoppingPaySection from '@/pages/user/RadixRcShoppingPaySection';

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

export default function RadixRc({
    layout = 'page',
    onEmbedClose,
    productFrom = 'shopping',
    checkoutFrom = 'shopping',
}: RadixRcProps = {}) {
    const intl = useIntl();
    const scrollRef = useRef<HTMLDivElement>(null);

    const [products, setProducts] = useState<Product[]>(() => shoppingProductCache.get(productFrom) ?? []);
    const [loadingProducts, setLoadingProducts] = useState(
        () => !shoppingProductCache.has(productFrom),
    );
    const [currentId, setCurrentId] = useState<number | null>(() => {
        const cached = shoppingProductCache.get(productFrom);
        return cached?.[0]?.id ?? null;
    });

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
    const defaultWalletProductId = useMemo(() => {
        const p999 = planProducts.find((p) => Math.abs(parseFloat(p.price) - 9.99) < 0.001);
        return p999?.id ?? planProducts[0]?.id ?? null;
    }, [planProducts]);
    const walletProductId = currentId ?? defaultWalletProductId;
    const checkoutTargetProductId = currentId ?? defaultWalletProductId ?? planProducts[0]?.id ?? null;

    function handleSelectPlan(productId: number) {
        setCurrentId(productId);
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
                                {currentId === p.id ? (
                                    <img
                                        className="rs-shopping__planCheckedIcon"
                                        src={checkedIcon}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                ) : null}

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

            <RadixRcShoppingPaySection
                walletProductId={walletProductId}
                checkoutTargetProductId={checkoutTargetProductId}
                checkoutFrom={checkoutFrom}
            />
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
