import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import { ReelShortBasicsSpin } from "@/components/ReelShortBasicsSpin";
import { Page } from "@/layouts/user";
import { cn } from "@/lib/utils";
import { createElement, init } from "@airwallex/components-sdk";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useParams, useSearchParams } from "react-router";

/** Airwallex Payment Intent amount 多为「最小货币单位」；无小数货币不除 100 */
const ZERO_DECIMAL_CURRENCY = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

function parsePaymentMethod(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

function majorAmount(
  currency: string,
  intentMinor: number | undefined,
  apiHint: unknown,
): number {
  if (typeof apiHint === "number" && Number.isFinite(apiHint)) {
    return apiHint;
  }
  if (typeof apiHint === "string") {
    const v = parseFloat(apiHint);
    if (Number.isFinite(v)) {
      return v;
    }
  }
  if (intentMinor != null && Number.isFinite(intentMinor)) {
    const c = currency.toUpperCase();
    if (ZERO_DECIMAL_CURRENCY.has(c)) {
      return intentMinor;
    }
    return intentMinor / 100;
  }
  return 0;
}

/** Google Pay 支付单里 `price` 字段用字符串，与 Native API 文档示例一致 */
function googlePayPriceString(value: number, currency: string): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCY.has(c)) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
}

/** createElement 各类型实例在运行时的共有能力（SDK 内部类型未统一导出） */
type AirwallexMounted = {
  mount: (dom: string | HTMLElement) => null | HTMLElement;
  unmount: () => void;
  destroy: () => void;
  on: (code: "success" | "error", handler: (e?: unknown) => void) => void;
};

export default function Component() {
  const intl = useIntl();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const paymentMethod = parsePaymentMethod(searchParams.get("payment"));
  const elementRef = useRef<AirwallexMounted | null>(null);

  function cleanupElement() {
    const el = elementRef.current;
    if (!el) {
      return;
    }
    try {
      el.unmount();
      el.destroy();
    } catch {
      /* noop */
    }
    elementRef.current = null;
  }

  function goSuccess(successUrl: string) {
    if (successUrl) {
      window.location.assign(successUrl);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSdkReady(false);
      cleanupElement();

      const productId = parseInt(params["id"] ?? "0", 10);
      if (!productId) {
        setShowIncomplete(true);
        return;
      }

      let result: Awaited<ReturnType<typeof api<TData>>>;
      try {
        result = await api<TData>("pay/create", {
          method: "post",
          loading: false,
          data: {
            payment: paymentMethod,
            product_id: productId,
            redirect: window.location.href,
          },
        });
      } catch {
        setShowIncomplete(true);
        return;
      }

      if (result.c !== 0) {
        setShowIncomplete(true);
        return;
      }

      const intentId = result.d["pi"] as string;
      const clientSecret = result.d["client_secret"] as string;
      const customerId = result.d["customer_id"] as string;
      const currency = (result.d["currency"] as string) || "USD";
      const successUrl = result.d["success_url"] as string;
      const env = result.d["env"] as "prod" | "demo";

      const locale = intl.locale?.toLowerCase().startsWith("zh") ? "zh" : "en";

      let payments;
      try {
        const initResult = await init({
          locale,
          env,
          enabledElements: ["payments"],
        });
        payments = initResult.payments;
      } catch {
        setShowIncomplete(true);
        return;
      }

      if (!payments || cancelled) {
        setShowIncomplete(true);
        return;
      }

      let intentMinor: number | undefined;
      try {
        const intent = await payments.getPaymentIntent(intentId, clientSecret);
        if (intent && typeof intent === "object" && "amount" in intent) {
          intentMinor = (intent as { amount?: number }).amount;
        }
      } catch {
        /* 金额可从后端字段兜底 */
      }

      const amountValue = majorAmount(
        currency,
        intentMinor,
        result.d["amount"] ?? result.d["amount_major"] ?? result.d["pay_amount"],
      );

      const recurringOptions = {
        next_triggered_by: "merchant" as const,
        merchant_trigger_reason: "scheduled" as const,
      };

      const paymentConsent = {
        next_triggered_by: "merchant" as const,
        merchant_trigger_reason: "scheduled" as const,
      } as const;

      const onSuccess = () => {
        goSuccess(successUrl);
      };

      const onError = () => {
        setShowIncomplete(true);
      };

      try {
        if (paymentMethod === 1) {
          const raw = await createElement("applePayButton", {
            mode: "recurring",
            intent_id: intentId,
            client_secret: clientSecret,
            customer_id: customerId,
            amount: { value: amountValue, currency },
            countryCode: "HK",
            buttonType: "subscribe",
            payment_consent: paymentConsent,
          });
          const el = raw as unknown as AirwallexMounted | null;
          if (cancelled || !el) {
            return;
          }
          elementRef.current = el;
          el.on("success", onSuccess);
          el.on("error", onError);
          el.mount("#apple-pay");
        } else if (paymentMethod === 2) {
          /**
           * 订阅场景在支付单展示订单说明：对齐 Airwallex Google Pay Native API 文档中的
           * `displayItems` 示例（Subscription payments → Google Pay payment data request）。
           * @see https://www.airwallex.com/docs/payments/payment-methods/global/google-paytm/native-api
           */
          const gPayLinePrice = googlePayPriceString(amountValue, currency);
          const raw = await createElement("googlePayButton", {
            mode: "recurring",
            intent_id: intentId,
            client_secret: clientSecret,
            customer_id: customerId,
            amount: { value: amountValue, currency },
            countryCode: "HK",
            buttonType: "subscribe",
            payment_consent: paymentConsent,
            totalPriceStatus: "FINAL",
            totalPriceLabel: intl.formatMessage({
              id: "checkout_googlepay_total_label",
              defaultMessage: "Subscription due today",
            }),
            displayItems: [
              {
                label: intl.formatMessage({
                  id: "checkout_googlepay_line_recurring",
                  defaultMessage: "Recurring subscription",
                }),
                price: gPayLinePrice,
                status: "FINAL",
                type: "LINE_ITEM",
              },
            ],
          });
          const el = raw as unknown as AirwallexMounted | null;
          if (cancelled || !el) {
            return;
          }
          elementRef.current = el;
          el.on("success", onSuccess);
          el.on("error", onError);
          el.mount("#google-pay");
        } else {
          const raw = await createElement("dropIn", {
            mode: "recurring",
            intent_id: intentId,
            client_secret: clientSecret,
            customer_id: customerId,
            currency,
            recurringOptions,
            methods: ["card"],
            appearance: { mode: "dark" },
          });
          const el = raw as unknown as AirwallexMounted | null;
          if (cancelled || !el) {
            return;
          }
          elementRef.current = el;
          el.on("success", onSuccess);
          el.on("error", onError);
          el.mount("#card");
        }
      } catch {
        setShowIncomplete(true);
        return;
      }

      if (!cancelled) {
        setSdkReady(true);
      }
    }

    void run();

    return () => {
      cancelled = true;
      cleanupElement();
    };
  }, [params, paymentMethod, intl]);

  return (
    <>
      <Page title="payment_method">
        <div className="rs-checkout">
          <div className="rs-checkout__content">
            <div className="rs-checkout__header">
              <h1 className="rs-checkout__h1">
                {intl.formatMessage({ id: "payment_method" })}
              </h1>
              <p className="rs-checkout__sub">
                {intl.formatMessage({ id: "shopping_auto_renew_short" })}
              </p>
            </div>

            <div className="rs-checkout__section">
              <div
                className={cn(
                  "rs-checkout__dropinWrap",
                  paymentMethod !== 1 && "hidden",
                )}
              >
                <div id="apple-pay" className="rs-checkout__dropin min-h-[48px]" />
              </div>
              <div
                className={cn(
                  "rs-checkout__dropinWrap",
                  paymentMethod !== 2 && "hidden",
                )}
              >
                <div id="google-pay" className="rs-checkout__dropin min-h-[48px]" />
              </div>
              <div
                className={cn(
                  "rs-checkout__dropinWrap",
                  paymentMethod !== 3 && "hidden",
                )}
              >
                <div id="card" className="rs-checkout__dropin min-h-[160px]" />
              </div>

              {!sdkReady && !showIncomplete ? (
                <div className="rs-checkout__skeleton">
                  <ReelShortBasicsSpin
                    visible
                    variant="inline"
                    withOverlay={false}
                    label={intl.formatMessage({
                      id: "loading",
                      defaultMessage: "Loading",
                    })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Page>

      <PayIncompleteDialog
        open={showIncomplete}
        onOpenChange={setShowIncomplete}
      />
    </>
  );
}
