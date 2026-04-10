import { useEffect, useMemo, useRef, useState } from 'react';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { FormattedMessage, useIntl } from 'react-intl';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import { BRAND_DISPLAY_NAME } from '@/constants/brand';
import { useNavigate } from 'react-router';

import vipCardBg from '@/assets/images/5c3ff370-f045-11f0-84ad-6b5693b490dc.png';
import iconUnlimitedViewing from '@/assets/images/icon_unlimited_viewing.png';
import icon1080p from '@/assets/images/icon_1080p.png';

import visa from '@/assets/visa.svg';
import master from '@/assets/master.svg';
import googlePay from '@/assets/google-pay.svg';
import applePay from '@/assets/apple-pay.svg';
import Countdown from '@/widgets/Countdown';

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

export default function Component() {
  const intl = useIntl();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const defaultPayment = useMemo(() => {
    // 老版本 payment drawer：iOS 默认 Apple Pay，否则 Google Pay
    const isIos = /Mac|iPhone|iPad|iPod/gi.test(navigator.userAgent);
    return isIos ? 1 : 2;
  }, []);
  const [payment, setPayment] = useState<number>(defaultPayment);

  useEffect(() => {
    let alive = true;
    api<Product[]>('product', {
      data: { from: 'shopping' },
      loading: false,
    })
      .then((res) => {
        if (!alive) return;
        if (res.c !== 0) return;
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
  }, []);

  function handleSelectAndPay(productId: number) {
    setCurrentId(productId);
    navigate(`/airwallex/${productId}?payment=${payment}`);
  }

  return (
    <div className="rs-shopping">
      <div ref={scrollRef} className="rs-shopping__scroll">
        <ReelShortTopNav scrollParentRef={scrollRef} showSearch={true} />

        <div className="rs-shopping__main">
          {/* VIP 卡片区（无金币） */}
          <div className="rs-shopping__intro">
            <div className="rs-shopping__introTitle">
              <FormattedMessage id="shopping_vip_unlock_all" />
            </div>
            <div className="rs-shopping__introSub">
              <FormattedMessage id="shopping_auto_renew_cancel_anytime" />
            </div>
          </div>

          {!loadingProducts && products.length > 0 ? (
            <div className="rs-shopping__countdown">
              <Countdown />
            </div>
          ) : null}

          <div className="rs-shopping__plans">
            {(loadingProducts ? [] : products).map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectAndPay(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectAndPay(p.id);
                  }
                }}
                className={cn('rs-shopping__plan', currentId === p.id && 'rs-shopping__plan--selected')}
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
                    <img className="rs-shopping__planBenefitIcon" src={iconUnlimitedViewing} alt="" />
                    <FormattedMessage id="shopping_benefit_unlimited_viewing" />
                  </div>
                  <div className="rs-shopping__planBenefit">
                    <img className="rs-shopping__planBenefitIcon" src={icon1080p} alt="" />
                    <FormattedMessage id="shopping_benefit_1080p" />
                  </div>
                </div>
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

          {/* 付款方式（样式见 styles/shopping-reelshort.scss） */}
          <div className="rs-shopping__pay">
            <div className="rs-shopping__payTitle">
              <FormattedMessage id="payment_method" />
            </div>
            <div className="rs-shopping__payGrid">
              <button
                type="button"
                onClick={() => setPayment(1)}
                className={cn('rs-shopping__payBtn', payment === 1 && 'rs-shopping__payBtn--active')}
              >
                <img className="rs-shopping__payLogo rs-shopping__payLogo--apple" src={applePay} alt="Apple Pay" />
              </button>
              <button
                type="button"
                onClick={() => setPayment(2)}
                className={cn('rs-shopping__payBtn', payment === 2 && 'rs-shopping__payBtn--active')}
              >
                <img className="rs-shopping__payLogo rs-shopping__payLogo--google" src={googlePay} alt="Google Pay" />
              </button>
              <button
                type="button"
                onClick={() => setPayment(3)}
                className={cn(
                  'rs-shopping__payBtn rs-shopping__payBtn--cardPair',
                  payment === 3 && 'rs-shopping__payBtn--active',
                )}
              >
                <img src={visa} alt="Visa" className="rs-shopping__payLogo rs-shopping__payLogo--visa" />
                <img src={master} alt="Master" className="rs-shopping__payLogo rs-shopping__payLogo--master" />
              </button>
            </div>
          </div>

          {/* 訂閱說明 */}
          <div className="rs-shopping__terms">
            <div className="rs-shopping__termsLine">
              <FormattedMessage id="shopping_subscription_about" />
            </div>
            <div className="rs-shopping__termsLine">
              <FormattedMessage id="shopping_subscription_item1" values={{ site: BRAND_DISPLAY_NAME }} />
            </div>
            <div className="rs-shopping__termsLine">
              <FormattedMessage id="shopping_subscription_item2" />
            </div>
            <div className="rs-shopping__termsLine">
              <FormattedMessage id="shopping_subscription_item3" values={{ site: BRAND_DISPLAY_NAME }} />
            </div>
          </div>
        </div>

        <ReelShortFooter />
      </div>
    </div>
  );
}

