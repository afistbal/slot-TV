import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import { ReelShortBasicsSpin } from "@/components/ReelShortBasicsSpin";
import { cn } from "@/lib/utils";
import { createElement, init } from "@airwallex/components-sdk";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useIntl } from "react-intl";

/**
 * Airwallex H5 支付区（无 `Page` 壳）：供 `/page/pay/:id` 与购物页 Drawer 复用。
 * `redirectHref` 传入 `pay/create` 的 `redirect`（如购物页用 `${origin}/shopping`）。
 */

export function parsePaymentMethod(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

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

function majorAmount(apiHint: unknown): number {
  if (typeof apiHint === "number" && Number.isFinite(apiHint)) {
    return apiHint;
  }
  if (typeof apiHint === "string") {
    const v = parseFloat(apiHint);
    if (Number.isFinite(v)) {
      return v;
    }
  }
  return 0;
}

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

type AirwallexInit = NonNullable<Parameters<typeof init>[0]>;
type AirwallexInitLocale = NonNullable<AirwallexInit["locale"]>;

/** 与 `init({ locale })` 对齐（勿写死 `en`，否则 GPay 等控件英文 Subscribe） */
function normalizeAirwallexLocale(reactLocale: string): AirwallexInitLocale {
  const lower = reactLocale.replace(/_/g, "-").toLowerCase();
  if (lower === "zh-hk" || lower === "zh-tw" || lower.startsWith("zh-hant")) {
    return "zh-HK";
  }
  if (lower.startsWith("zh")) {
    return "zh";
  }
  const two = lower.slice(0, 2);
  const supported: AirwallexInitLocale[] = [
    "ar",
    "da",
    "de",
    "en",
    "es",
    "fi",
    "fr",
    "id",
    "it",
    "ja",
    "ko",
    "ms",
    "nl",
    "nl-NL",
    "pl",
    "pt",
    "ro",
    "ru",
    "sv",
    "zh",
    "zh-HK",
  ];
  for (const code of supported) {
    if (code === two || code === lower) {
      return code;
    }
  }
  return "en";
}

type AirwallexMounted = {
  mount: (dom: string | HTMLElement) => null | HTMLElement;
  unmount: () => void;
  destroy: () => void;
  on: (code: "success" | "error", handler: (e?: unknown) => void) => void;
};

function checkoutDbg(说明: string, 详情?: unknown) {
  console.log(`[checkout] ${说明}`, 详情 ?? "");
}

function formatMoneyDisplay(raw: unknown, currency: string): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return `${raw} ${currency}`;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    return `${raw} ${currency}`;
  }
  return currency;
}

function mountToRef(
  el: AirwallexMounted,
  containerRef: RefObject<HTMLDivElement | null>,
  cancelled: () => boolean,
  label: string,
) {
  let frames = 0;
  const tick = () => {
    if (cancelled()) {
      return;
    }
    const node = containerRef.current;
    if (node) {
      try {
        el.mount(node);
        checkoutDbg(`已挂载 ${label}`, true);
      } catch (e) {
        checkoutDbg(`${label} mount 异常`, e);
      }
      return;
    }
    frames += 1;
    if (frames > 80) {
      checkoutDbg(`${label} mount 放弃：ref 为空`, { frames });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export type CheckoutAirwallexPanelProps = {
  productId: number;
  payment: number;
  /** `pay/create` 的 `redirect`，须与当前业务回跳一致 */
  redirectHref: string;
  /**
   * `page`：独立 `/page/pay` 浅色底（默认）。
   * `embed`：深色 + `rs-checkout-h5--embedded`（如将来抽屉内嵌复用）。
   */
  variant?: "page" | "embed";
};

export function CheckoutAirwallexPanel({
  productId,
  payment,
  redirectHref,
  variant = "page",
}: CheckoutAirwallexPanelProps) {
  const intl = useIntl();

  const [showIncomplete, setShowIncomplete] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [orderSummary, setOrderSummary] = useState<TData | null>(null);

  const dropInMountRef = useRef<HTMLDivElement | null>(null);
  const instancesRef = useRef<AirwallexMounted[]>([]);

  function cleanupAll() {
    for (const el of instancesRef.current) {
      try {
        el.unmount();
        el.destroy();
      } catch {
        /* noop */
      }
    }
    instancesRef.current = [];
  }

  function goSuccess(successUrl: string) {
    if (successUrl) {
      window.location.assign(successUrl);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    cleanupAll();
    setSdkReady(false);
    setOrderSummary(null);

    async function run() {
      checkoutDbg("0 Airwallex 面板", {
        productId,
        payment,
        redirectHref,
      });

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
            payment,
            product_id: productId,
            redirect: redirectHref,
          },
        });
      } catch (e) {
        checkoutDbg("1 pay/create 异常", e);
        setShowIncomplete(true);
        return;
      }

      if (result.c !== 0) {
        checkoutDbg("1 pay/create 失败", { c: result.c, m: result.m });
        setShowIncomplete(true);
        return;
      }

      if (!isCancelled()) {
        setOrderSummary(result.d);
      }

      const redirectFields = {
        intent_id: result.d["pi"] as string,
        client_secret: result.d["client_secret"] as string,
        customer_id: result.d["customer_id"] as string,
        currency: (result.d["currency"] as string) || "USD",
        successUrl: result.d["success_url"] as string,
        failUrl: (result.d["fail_url"] as string) || "",
      };

      const env = result.d["env"] as "prod" | "demo";

      try {
        await init({
          locale: normalizeAirwallexLocale(intl.locale),
          env,
          enabledElements: ["payments"],
        });
      } catch (e) {
        checkoutDbg("2 init 失败", e);
        setShowIncomplete(true);
        return;
      }

      if (isCancelled()) {
        return;
      }

      const amountValue = majorAmount(
        result.d["amount"] ??
          result.d["amount_major"] ??
          result.d["pay_amount"] ??
          result.d["price"],
      );

      const recurringOptions = {
        next_triggered_by: "merchant" as const,
        merchant_trigger_reason: "scheduled" as const,
      } as const;

      const paymentConsent = recurringOptions;

      const gPayLinePrice = googlePayPriceString(
        amountValue,
        redirectFields.currency,
      );

      /** 与 `slot-TV/Airwallex.tsx` 的 `redirectToCheckout({ methods: [...] })` 一致：单 Drop-in 内嵌三种方式 */
      const dropInAppearanceMode = variant === "page" ? "light" : "dark";
      const dropInAllMethods = {
        mode: "recurring" as const,
        intent_id: redirectFields.intent_id,
        client_secret: redirectFields.client_secret,
        customer_id: redirectFields.customer_id,
        currency: redirectFields.currency,
        payment_consent: paymentConsent,
        recurringOptions,
        methods: ["card", "googlepay", "applepay"],
        appearance: {
          mode: dropInAppearanceMode as "light" | "dark",
        },
        country_code: "HK",
        submitType: "subscribe" as const,
        googlePayRequestOptions: {
          countryCode: "HK",
          totalPriceStatus: "FINAL" as const,
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
              status: "FINAL" as const,
              type: "LINE_ITEM" as const,
            },
          ],
        },
        applePayRequestOptions: {
          buttonType: "subscribe" as const,
          countryCode: "HK",
        },
      };

      const onSuccess = () => {
        checkoutDbg("支付成功", {
          successUrl: redirectFields.successUrl?.slice(0, 80),
        });
        goSuccess(redirectFields.successUrl);
      };

      const onCardError = (ev?: unknown) => {
        checkoutDbg("dropIn(card) error", {
          ev,
          failUrl: redirectFields.failUrl?.slice(0, 80),
        });
        setShowIncomplete(true);
      };

      const pushInstance = (el: AirwallexMounted | null) => {
        if (el) {
          instancesRef.current.push(el);
        }
      };

      try {
        checkoutDbg("3 创建 dropIn（card + googlepay + applepay）");
        const rawDropIn = await createElement(
          "dropIn",
          dropInAllMethods as unknown as Parameters<
            typeof createElement<"dropIn">
          >[1],
        );
        const dropInEl = rawDropIn as unknown as AirwallexMounted | null;
        if (!dropInEl) {
          checkoutDbg("3 dropIn 返回空");
          setShowIncomplete(true);
          return;
        }
        dropInEl.on("success", onSuccess);
        dropInEl.on("error", onCardError);
        pushInstance(dropInEl);
        mountToRef(dropInEl, dropInMountRef, isCancelled, "DropIn");
      } catch (e) {
        checkoutDbg("3 dropIn 异常", e);
        setShowIncomplete(true);
        return;
      }

      if (!isCancelled()) {
        setSdkReady(true);
        checkoutDbg("4 就绪");
      }
    }

    void run();

    return () => {
      cancelled = true;
      cleanupAll();
    };
  }, [productId, payment, intl, redirectHref, variant]);

  const summaryCurrency =
    (orderSummary?.["currency"] as string) || "USD";
  const planName = orderSummary?.["name"] as string | undefined;
  const renewalRaw =
    orderSummary?.["renewal_price"] ?? orderSummary?.["renewal"];
  const hasRenewal = renewalRaw != null && String(renewalRaw).trim() !== "";
  const hasOrderMeta = Boolean(planName) || hasRenewal;

  return (
    <>
      <div
        className={cn(
          "rs-checkout rs-checkout-h5",
          variant === "embed" && "rs-checkout-h5--embedded",
          variant === "page" && "rs-checkout-h5--pageLight",
        )}
      >
        <div className="rs-checkout-h5__inner">
          <div className="rs-checkout-h5__header">
            <h1 className="rs-checkout-h5__h1">
              {intl.formatMessage({ id: "payment_method" })}
            </h1>
            <p className="rs-checkout-h5__sub">
              {intl.formatMessage({
                id: "shopping_auto_renew_short",
              })}
            </p>
          </div>

          {orderSummary ? (
            <div className="rs-checkout-h5__orderBox">
              <div className="rs-checkout-h5__orderAmountRow">
                <span className="rs-checkout-h5__amountLabel">
                  {intl.formatMessage({
                    id: "checkout_amount_due_label",
                    defaultMessage: "Amount due",
                  })}
                </span>
                <span className="rs-checkout-h5__amountValue">
                  {formatMoneyDisplay(
                    orderSummary["price"],
                    summaryCurrency,
                  )}
                </span>
              </div>
              {hasOrderMeta ? (
                <div className="rs-checkout-h5__orderMeta">
                  {planName ? (
                    <div className="rs-checkout-h5__summaryRow">
                      <span className="rs-checkout-h5__summaryLabel">
                        {intl.formatMessage({
                          id: "checkout_plan",
                          defaultMessage: "Plan",
                        })}
                      </span>
                      <span>{planName}</span>
                    </div>
                  ) : null}
                  {hasRenewal ? (
                    <div className="rs-checkout-h5__summaryRow">
                      <span className="rs-checkout-h5__summaryLabel">
                        {intl.formatMessage({
                          id: "checkout_renews_at",
                          defaultMessage: "Renews at",
                        })}
                      </span>
                      <span className="rs-checkout-h5__summaryMuted">
                        {formatMoneyDisplay(renewalRaw, summaryCurrency)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <h2 className="rs-checkout-h5__pickTitle rs-checkout-h5__pickTitle--section">
            {intl.formatMessage({
              id: "checkout_select_payment_method",
              defaultMessage: "Please select a payment method",
            })}
          </h2>

          <div
            ref={dropInMountRef}
            className="rs-checkout-h5__dropInMount"
          />

          {!sdkReady && !showIncomplete ? (
            <div className="rs-checkout-h5__loading">
              <ReelShortBasicsSpin
                visible
                variant="inline"
                withOverlay={false}
                label={intl.formatMessage({ id: "loading" })}
              />
            </div>
          ) : null}
        </div>
      </div>

      <PayIncompleteDialog
        open={showIncomplete}
        onOpenChange={setShowIncomplete}
      />
    </>
  );
}
