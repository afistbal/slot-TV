import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import { ReelShortBasicsSpin } from "@/components/ReelShortBasicsSpin";
import { cn } from "@/lib/utils";
import { createElement, init } from "@airwallex/components-sdk";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useIntl } from "react-intl";

/**
 * Airwallex H5 支付区（无 `Page` 壳）：供 `/page/checkout/:id` 与购物页 Drawer 复用。
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
   * `page`：独立 `/page/checkout` 浅色底（默认）。
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

  const appleMountRef = useRef<HTMLDivElement | null>(null);
  const googleMountRef = useRef<HTMLDivElement | null>(null);
  const cardMountRef = useRef<HTMLDivElement | null>(null);
  const instancesRef = useRef<AirwallexMounted[]>([]);

  const isLikelyIos =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent);

  /** 非 iOS 不展示 Apple Pay 行，避免 iframe 高度为 0 时先出现两行再缩成一行 */
  const [appleRowHidden, setAppleRowHidden] = useState(() => !isLikelyIos);

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
    setAppleRowHidden(!isLikelyIos);

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
          locale: "en",
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

      const recurringExpressBase = {
        mode: "recurring" as const,
        intent_id: redirectFields.intent_id,
        client_secret: redirectFields.client_secret,
        customer_id: redirectFields.customer_id,
        amount: { value: amountValue, currency: redirectFields.currency },
        countryCode: "HK",
        buttonType: "subscribe" as const,
        payment_consent: paymentConsent,
      };

      const dropInCardOnly = {
        mode: "recurring" as const,
        intent_id: redirectFields.intent_id,
        client_secret: redirectFields.client_secret,
        customer_id: redirectFields.customer_id,
        currency: redirectFields.currency,
        payment_consent: paymentConsent,
        methods: ["card"],
        appearance: { mode: "dark" as const },
        country_code: "HK",
        submitType: "subscribe" as const,
        googlePayRequestOptions: { countryCode: "HK" },
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

      const mountApple = async () => {
        try {
          checkoutDbg("3 创建 applePayButton", { amount: recurringExpressBase.amount });
          const raw = await createElement(
            "applePayButton",
            recurringExpressBase as Parameters<
              typeof createElement<"applePayButton">
            >[1],
          );
          const appleEl = raw as unknown as AirwallexMounted | null;
          if (appleEl && !isCancelled()) {
            appleEl.on("success", onSuccess);
            appleEl.on("error", (ev) => checkoutDbg("Apple error", ev));
            pushInstance(appleEl);
            mountToRef(appleEl, appleMountRef, isCancelled, "Apple");
          }
        } catch (e) {
          checkoutDbg("3 applePayButton 创建失败（可忽略）", e);
        }
      };

      const mountGoogle = async () => {
        try {
          const gPayLinePrice = googlePayPriceString(
            amountValue,
            redirectFields.currency,
          );
          checkoutDbg("4 创建 googlePayButton", { amount: recurringExpressBase.amount });
          const raw = await createElement(
            "googlePayButton",
            {
              ...recurringExpressBase,
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
            } as Parameters<typeof createElement<"googlePayButton">>[1],
          );
          const googleEl = raw as unknown as AirwallexMounted | null;
          if (googleEl && !isCancelled()) {
            googleEl.on("success", onSuccess);
            googleEl.on("error", (ev) => checkoutDbg("Google error", ev));
            pushInstance(googleEl);
            mountToRef(googleEl, googleMountRef, isCancelled, "Google");
          }
        } catch (e) {
          checkoutDbg("4 googlePayButton 创建失败（可忽略）", e);
        }
      };

      if (isLikelyIos) {
        await mountApple();
        if (isCancelled()) {
          return;
        }
        await mountGoogle();
      } else {
        await mountGoogle();
        if (isCancelled()) {
          return;
        }
        await mountApple();
      }

      if (isCancelled()) {
        return;
      }

      try {
        checkoutDbg("5 创建 dropIn（仅 card）");
        const rawCard = await createElement(
          "dropIn",
          dropInCardOnly as Parameters<typeof createElement<"dropIn">>[1],
        );
        const cardEl = rawCard as unknown as AirwallexMounted | null;
        if (!cardEl) {
          checkoutDbg("5 dropIn 返回空");
          setShowIncomplete(true);
          return;
        }
        cardEl.on("success", onSuccess);
        cardEl.on("error", onCardError);
        pushInstance(cardEl);
        mountToRef(cardEl, cardMountRef, isCancelled, "Card");
      } catch (e) {
        checkoutDbg("5 dropIn 异常", e);
        setShowIncomplete(true);
        return;
      }

      if (!isCancelled()) {
        setSdkReady(true);
        checkoutDbg("6 就绪");
      }
    }

    void run();

    return () => {
      cancelled = true;
      cleanupAll();
    };
  }, [productId, payment, isLikelyIos, intl, redirectHref]);

  useEffect(() => {
    if (!sdkReady || !isLikelyIos) {
      return;
    }
    const root = appleMountRef.current;
    if (!root) {
      return;
    }

    let alive = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      if (!alive) {
        return;
      }
      const ifr = root.querySelector("iframe");
      const h = ifr?.getBoundingClientRect().height ?? 0;
      setAppleRowHidden(h < 2);
    };

    const ro = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(measure, 120);
    });
    ro.observe(root);
    debounce = setTimeout(measure, 2400);

    return () => {
      alive = false;
      clearTimeout(debounce);
      ro.disconnect();
    };
  }, [sdkReady, productId, isLikelyIos]);

  const summaryCurrency =
    (orderSummary?.["currency"] as string) || "USD";
  const planName = orderSummary?.["name"] as string | undefined;
  const renewalRaw =
    orderSummary?.["renewal_price"] ?? orderSummary?.["renewal"];
  const hasRenewal = renewalRaw != null && String(renewalRaw).trim() !== "";
  const hasOrderMeta = Boolean(planName) || hasRenewal;

  const appleWrapClass =
    `rs-checkout-h5__mountWrap rs-checkout-h5__mountWrap--apple${
      appleRowHidden ? " rs-checkout-h5__mountWrap--hidden" : ""
    }`;

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

          <div className="rs-checkout-h5__express">
            {isLikelyIos ? (
              <>
                <div className={appleWrapClass}>
                  <div
                    ref={appleMountRef}
                    className="rs-checkout-h5__mount rs-checkout-h5__mount--apple"
                  />
                </div>
                <div className="rs-checkout-h5__mountWrap rs-checkout-h5__mountWrap--google">
                  <div
                    ref={googleMountRef}
                    className="rs-checkout-h5__mount rs-checkout-h5__mount--google"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rs-checkout-h5__mountWrap rs-checkout-h5__mountWrap--google">
                  <div
                    ref={googleMountRef}
                    className="rs-checkout-h5__mount rs-checkout-h5__mount--google"
                  />
                </div>
                <div className={appleWrapClass}>
                  <div
                    ref={appleMountRef}
                    className="rs-checkout-h5__mount rs-checkout-h5__mount--apple"
                  />
                </div>
              </>
            )}
          </div>

          {payment === 2 && isLikelyIos ? (
            <p className="rs-checkout-h5__hint">
              {intl.formatMessage({
                id: "checkout_googlepay_ios_hint",
                defaultMessage:
                  "Google Pay often does not show on iPhone Safari. Use Apple Pay or card below.",
              })}
            </p>
          ) : null}

          <div className="rs-checkout-h5__divider">
            <span>
              {intl.formatMessage({
                id: "checkout_or_alternate_methods",
                defaultMessage: "Or pay using the following methods",
              })}
            </span>
          </div>

          <div className="rs-checkout-h5__cardPanel">
            <div className="rs-checkout-h5__cardTitle">
              {intl.formatMessage({
                id: "checkout_bank_card",
                defaultMessage: "Bank card",
              })}
            </div>
            <div
              ref={cardMountRef}
              className="rs-checkout-h5__mount rs-checkout-h5__mount--card"
            />
          </div>

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
