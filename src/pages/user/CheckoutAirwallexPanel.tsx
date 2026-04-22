import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import PaySuccessDialog from "@/components/PaySuccessDialog";
import { isApplePlatform } from "@/lib/isApplePlatform";
import { cn } from "@/lib/utils";
import { createElement, init } from "@airwallex/components-sdk";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useIntl } from "react-intl";

/**
 * Airwallex H5 支付区（无 `Page` 壳）：供 `/page/pay/:id` 与购物页 Drawer 复用。
 * `redirectHref` 传入 `pay/create` 的 `redirect`（如购物页用 `${origin}/shopping`）。
 *
 * Drop-in 集成顺序见官方文档：
 * https://www.airwallex.com/docs/js/payments/dropin/
 *（`createElement('dropIn')` → `element.on('success'|'error')` → `element.mount(dom)`）
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
  /** 成功弹窗点击确认后的行为 */
  successAction?: "navigate" | "reload";
  /**
   * `page`：独立 `/page/pay` 浅色底（默认）。
   * `embed`：深色 + `rs-checkout-h5--embedded`（如将来抽屉内嵌复用）。
   */
  variant?: "page" | "embed";
  /** 外部托管支付状态 UI（例如购物弹窗） */
  externalStatusMode?: boolean;
  /** 向外层回传支付状态 */
  onPayStateChange?: (state: "processing" | "checking" | "success" | "failed") => void;
};

export function CheckoutAirwallexPanel({
  productId,
  payment,
  redirectHref,
  successAction = "navigate",
  variant = "page",
  externalStatusMode = false,
  onPayStateChange,
}: CheckoutAirwallexPanelProps) {
  const intl = useIntl();

  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successUrl, setSuccessUrl] = useState("");
  const successAlertShownRef = useRef(false);
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

  function handleSuccessConfirm(successUrl: string) {
    if (successAction === "reload") {
      window.location.reload();
      return;
    }
    goSuccess(successUrl);
  }

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    cleanupAll();
    setSuccessUrl("");
    successAlertShownRef.current = false;

    async function run() {
      const payCreatePayment =
        payment === 3 ? (isApplePlatform() ? 1 : 2) : payment;
      checkoutDbg("0 Airwallex 面板", {
        productId,
        payment,
        payCreatePayment,
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
            payment: payCreatePayment,
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

      const redirectFields = {
        intent_id: result.d["pi"] as string,
        client_secret: result.d["client_secret"] as string,
        customer_id: result.d["customer_id"] as string,
        currency: (result.d["currency"] as string) || "USD",
        successUrl: result.d["success_url"] as string,
        failUrl: (result.d["fail_url"] as string) || "",
      };

      const env = result.d["env"] as "prod" | "demo";

      let payments:
        | (Awaited<ReturnType<typeof init>>["payments"] | undefined)
        | null = null;
      try {
        const initResult = await init({
          locale: normalizeAirwallexLocale(intl.locale),
          env,
          enabledElements: ["payments"],
        });
        payments = initResult.payments;
      } catch (e) {
        checkoutDbg("2 init 失败", e);
        setShowIncomplete(true);
        return;
      }

      if (isCancelled()) {
        return;
      }

      // /page/pay/:id?payment=1：苹果支付参数与 tv-web 的 Airwallex.tsx 保持一致
      if (payment === 1) {
        if (!payments) {
          checkoutDbg("2 payments 未就绪（apple redirect）");
          setShowIncomplete(true);
          return;
        }
        const appleCheckoutPayload: Parameters<
          NonNullable<typeof payments>["redirectToCheckout"]
        >[0] = {
          intent_id: redirectFields.intent_id,
          mode: "recurring",
          recurringOptions: {
            next_triggered_by: "merchant",
            merchant_trigger_reason: "scheduled",
          },
          customer_id: redirectFields.customer_id,
          client_secret: redirectFields.client_secret,
          currency: redirectFields.currency,
          successUrl: redirectFields.successUrl,
          failUrl: redirectFields.failUrl,
          methods: ["applepay"],
          applePayRequestOptions: {
            buttonType: "subscribe",
            countryCode: "HK",
          },
        };
        checkoutDbg("2.5 apple redirectToCheckout 参数", appleCheckoutPayload);
        try {
          await payments.redirectToCheckout(appleCheckoutPayload);
          return;
        } catch (e) {
          checkoutDbg("2.6 apple redirectToCheckout 异常", e);
          setShowIncomplete(true);
          return;
        }
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

      /** payment=1/2 时展示钱包+卡；未传或 payment=3 时仅卡 */
      const dropInMethods =
        payment === 1 || payment === 2
          ? (["card", "googlepay", "applepay"] as const)
          : (["card"] as const);

      const dropInAppearanceMode = variant === "page" ? "light" : "dark";
      const dropInAppearance =
        dropInAppearanceMode === "dark"
          ? {
              mode: "dark" as const,
              variables: {
                colorBackground: "#222222",
              },
              rules: {
                ".Input": {
                  backgroundColor: "#333333",
                },
                ".Button": {
                  backgroundColor: "#FF3D5DFF",
                  color: "#FFFFFF",
                },
                ".Button > div": {
                  color: "#FFFFFF",
                },
              },
            }
          : {
              mode: "light" as const,
            };
      const includeWalletInDropIn = payment === 1 || payment === 2;
      const dropInAllMethods = {
        mode: "recurring" as const,
        intent_id: redirectFields.intent_id,
        client_secret: redirectFields.client_secret,
        customer_id: redirectFields.customer_id,
        currency: redirectFields.currency,
        payment_consent: paymentConsent,
        recurringOptions,
        methods: dropInMethods,
        appearance: dropInAppearance,
        country_code: "HK",
        submitType: "subscribe" as const,
        ...(includeWalletInDropIn
          ? {
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
            }
          : {}),
      };

      let dropInOutcomeHandled = false;
      /** 与文档 `element.on('success', (e) => { const { intent } = e.detail })` 一致 */
      const onSuccess = (e: unknown) => {
        if (dropInOutcomeHandled) {
          return;
        }
        console.log("[结账下拉支付探针] 下拉支付.成功", e);
        try {
          alert("[结账下拉支付探针] 下拉支付.成功 已触发");
        } catch {
          // 当运行环境不支持 alert 时忽略异常。
        }
        dropInOutcomeHandled = true;
        const detail = (e as CustomEvent<{ intent?: unknown }>).detail;
        const { intent } = detail ?? {};
        checkoutDbg("支付成功", {
          intent,
          successUrl: redirectFields.successUrl?.slice(0, 80),
        });
        if (!successAlertShownRef.current) {
          successAlertShownRef.current = true;
          window.alert("[checkout-dropin] success callback triggered");
        }
        onPayStateChange?.("success");
        setSuccessUrl(redirectFields.successUrl || "");
        if (!externalStatusMode) {
          setShowSuccess(true);
        }
      };

      const onCardError = (ev?: unknown) => {
        if (dropInOutcomeHandled) {
          return;
        }
        console.log("[结账下拉支付探针] 下拉支付.失败", ev);
        try {
          alert("[结账下拉支付探针] 下拉支付.失败 已触发");
        } catch {
          // 当运行环境不支持 alert 时忽略异常。
        }
        dropInOutcomeHandled = true;
        checkoutDbg("dropIn(card) error", {
          ev,
          failUrl: redirectFields.failUrl?.slice(0, 80),
        });
        onPayStateChange?.("failed");
        if (!externalStatusMode) {
          setShowIncomplete(true);
        }
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
        pushInstance(dropInEl);
        /**
         * 与官方一致：https://www.airwallex.com/docs/js/payments/dropin/
         * createElement → element.on(...) → element.mount(dom)
         */
        console.log(dropInEl);
        dropInEl.on("success", onSuccess);
        dropInEl.on("error", onCardError);
        if (externalStatusMode) {
          (
            dropInEl as unknown as {
              on?: (code: string, handler: (ev?: unknown) => void) => void;
            }
          ).on?.("clickConfirmButton", () => {
            console.log("[结账下拉支付探针] 下拉支付.点击确认按钮");
            try {
              alert("[结账下拉支付探针] 下拉支付.点击确认按钮 已触发");
            } catch {
              // 当运行环境不支持 alert 时忽略异常。
            }
            onPayStateChange?.("processing");
          });
        }
        mountToRef(dropInEl, dropInMountRef, isCancelled, "DropIn");
        if (!isCancelled()) {
          checkoutDbg("4 就绪");
        }
      } catch (e) {
        checkoutDbg("3 dropIn 异常", e);
        setShowIncomplete(true);
        return;
      }
    }

    void run();

    return () => {
      cancelled = true;
      cleanupAll();
    };
  }, [productId, payment, intl, redirectHref, variant, externalStatusMode, onPayStateChange]);

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
          <div
            ref={dropInMountRef}
            className="rs-checkout-h5__dropInMount"
          />
        </div>
      </div>

      {!externalStatusMode ? (
        <>
          <PayIncompleteDialog
            open={showIncomplete}
            onOpenChange={setShowIncomplete}
            dismissNavigateToShopping={false}
          />
          <PaySuccessDialog
            open={showSuccess}
            onOpenChange={setShowSuccess}
            onConfirm={() => handleSuccessConfirm(successUrl)}
          />
        </>
      ) : null}
    </>
  );
}
