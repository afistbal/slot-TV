import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage, useIntl } from 'react-intl';
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
import RadixRcShoppingPaySection from '@/pages/user/RadixRcShoppingPaySection';
import { ShoppingPaidServiceAgreementContent } from '@/pages/user/ShoppingPaidServiceAgreementContent';

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
type PayModalStatus = 'idle' | 'processing' | 'checking' | 'success' | 'failed';

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
    const [showPayModal, setShowPayModal] = useState(false);
    const [showPaidServiceAgreement, setShowPaidServiceAgreement] = useState(false);
    const [payModalStatus, setPayModalStatus] = useState<PayModalStatus>('idle');
    const [paySessionSeed, setPaySessionSeed] = useState(0);
    const successAlertShownRef = useRef(false);

    function closePayModal() {
        setShowPaidServiceAgreement(false);
        setPayModalStatus('idle');
        setShowPayModal(false);
        setPaySessionSeed((prev) => prev + 1);
        successAlertShownRef.current = false;
    }

    useEffect(() => {
        if (payModalStatus !== 'success' || !showPayModal) return;
        if (!successAlertShownRef.current) {
            successAlertShownRef.current = true;
            window.alert('[shopping] success callback triggered');
        }
        const timer = window.setTimeout(() => {
            setShowPaidServiceAgreement(false);
            setPayModalStatus('idle');
            setShowPayModal(false);
            window.location.reload();
        }, 3000);
        return () => window.clearTimeout(timer);
    }, [payModalStatus, showPayModal]);

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

    const planProducts = useMemo(() => products, [products]);
    const defaultWalletProductId = useMemo(() => {
        const p999 = planProducts.find((p) => Math.abs(parseFloat(p.price) - 9.99) < 0.001);
        return p999?.id ?? planProducts[0]?.id ?? null;
    }, [planProducts]);
    const walletProductId = currentId ?? defaultWalletProductId;
    const checkoutTargetProductId = currentId ?? defaultWalletProductId ?? planProducts[0]?.id ?? null;
    const currentCheckoutProduct = useMemo(
        () => planProducts.find((p) => p.id === checkoutTargetProductId) ?? null,
        [planProducts, checkoutTargetProductId],
    );
    const retryAmount = currentCheckoutProduct?.price ? `$${currentCheckoutProduct.price}` : '';

    function handleSelectPlan(productId: number) {
        setCurrentId(productId);
        setPayModalStatus('idle');
        setShowPaidServiceAgreement(false);
        setShowPayModal(true);
        setPaySessionSeed((prev) => prev + 1);
        successAlertShownRef.current = false;
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
                            <div className="rs-shopping__payStack">
                                <RadixRcShoppingPaySection
                                    key={`${walletProductId ?? 'none'}-${paySessionSeed}`}
                                    walletProductId={walletProductId}
                                    checkoutTargetProductId={checkoutTargetProductId}
                                    checkoutFrom={checkoutFrom}
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
        const closeAria = intl.formatMessage({ id: 'close', defaultMessage: 'Close' });
        return (
            <div className="rs-shopping-drawer-sheet">
                {/* embed 须包 `.rs-shopping`，否则 SCSS 中 `.rs-shopping .rs-shopping__*`（含顶栏倒计时）无法命中 */}
                <div className="rs-shopping rs-shopping--drawerEmbed">
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
