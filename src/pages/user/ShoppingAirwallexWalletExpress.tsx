import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import {
  airwallexEnsureShoppingWalletInit,
  airwallexRunShoppingWalletExclusive,
  normalizeAirwallexLocale,
} from "@/lib/airwallexShoppingWalletEmbedSingleton";
import { createElement } from "@airwallex/components-sdk";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useIntl } from "react-intl";
import { cn } from "@/lib/utils";

/**
 * 购物页专用：**仅** Airwallex Drop-in 的 Google Pay + Apple Pay 按钮区（不含 card）。
 * 与 `CheckoutAirwallexPanel` 独立，不修改老收银组件。
 */

type AirwallexMounted = {
  mount: (dom: string | HTMLElement) => null | HTMLElement;
  unmount: () => void;
  destroy: () => void;
  on: (
    code: "success" | "error" | "cancel",
    handler: (e?: unknown) => void,
  ) => void;
  confirmIntent: (data: { client_secret: string }) => Promise<unknown>;
};

function dbg(说明: string, 详情?: unknown) {
  console.log(`[shopping-airwallex-wallet] ${说明}`, 详情 ?? "");
}

function clampPayCreatePayment(n: number | undefined): 1 | 2 | 3 {
  if (n === 1 || n === 2 || n === 3) {
    return n;
  }
  return 2;
}

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

const ZERO_DECIMAL = new Set([
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

function googlePayPriceString(value: number, currency: string): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
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
        dbg(`已挂载 ${label}`, true);
      } catch (e) {
        dbg(`${label} mount 异常`, e);
      }
      return;
    }
    frames += 1;
    if (frames > 80) {
      dbg(`${label} mount 放弃：ref 为空`, { frames });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * 与 `.rs-shopping__payBtn` 同高/圆角（`34/375*--app-vw`，大屏 `min(40px, …)` 逼近 md 的 40px）。
 * Google Pay 内层为 `.gpay-button-fill` + `button.gpay-button`，且常用 `height: inherit`，
 * 必须在同 iframe 内直接写这些选择器（超出 SDK 文档的 `SelectorAllowed` 时由运行时注入样式）。
 */
const BTN_H = "min(40px, calc(34 / 375 * var(--app-vw, 100vw)))";
const BTN_R = "min(4px, calc(4 / 375 * var(--app-vw, 100vw)))";

/** `.GooglePayButton` 作 `.gpay-button-fill` 的定高父级 */
const googlePayWrapperRules = {
  width: "200px",
  // maxWidth: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  height: BTN_H,
  minHeight: BTN_H,
  maxHeight: BTN_H,
  borderRadius: BTN_R,
  border: "1px solid rgba(255, 255, 255, 0.9)",
} as const;

const applePayBtnSizeRules = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  height: BTN_H,
  minHeight: BTN_H,
  maxHeight: BTN_H,
  borderRadius: BTN_R,
  border: "1px solid rgba(255, 255, 255, 0.9)",
} as const;

/** Google Pay 官方 DOM：`height:inherit` 依赖本层有确定高度 */
const gpayInnerRules = {
  ".gpay-button-fill": {
    width: "100%",
    height: BTN_H,
    minHeight: BTN_H,
    maxHeight: BTN_H,
    boxSizing: "border-box",
  },
  ".gpay-button-fill > .gpay-button.white": {
    width: "100%",
    height: "100%",
    minHeight: "100%",
    borderRadius: BTN_R,
    boxSizing: "border-box",
  },
  ".gpay-button-fill > .gpay-button.black": {
    width: "100%",
    height: "100%",
    minHeight: "100%",
    borderRadius: BTN_R,
    boxSizing: "border-box",
  },
} as const;

const walletRules = {
  ".GooglePayButton": googlePayWrapperRules,
  ".GooglePayButton:hover": { opacity: "0.92" },
  ".ApplePayButton": applePayBtnSizeRules,
  ".ApplePayButton:hover": { opacity: "0.92" },
  ...gpayInnerRules,
} as const;

const walletVariables = {
  // Airwallex theme 算法要求合法的 CSS color（十六进制最稳）
  colorBrand: "#EF4444",
  /** 贴近 `.rs-shopping__payBtn` 的 `#141414` */
  colorBackground: "#141414",
  // 避免 rgba 在部分主题算法里被判 invalid
  colorText: "#FFFFFF",
} as const;

export type ShoppingAirwallexWalletExpressProps = {
  productId: number;
  redirectHref: string;
  /** 写入 `pay/create.payment`；缺省 `2` */
  payment?: number;
};

export type ShoppingAirwallexWalletExpressHandle = {
  handlePayment: () => void;
};

export const ShoppingAirwallexWalletExpress = forwardRef<
  ShoppingAirwallexWalletExpressHandle,
  ShoppingAirwallexWalletExpressProps
>(function ShoppingAirwallexWalletExpress(
  { productId, redirectHref, payment: paymentProp },
  ref,
) {
  const payCreatePayment = clampPayCreatePayment(paymentProp);
  const intl = useIntl();
  const [showIncomplete, setShowIncomplete] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const instancesRef = useRef<AirwallexMounted[]>([]);
  const secretRef = useRef<string | null>(null);
  const pendingConfirmRef = useRef(false);

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
    secretRef.current = null;
    pendingConfirmRef.current = false;
  }

  useImperativeHandle(
    ref,
    () => ({
      handlePayment: () => {
        const el = instancesRef.current[0] ?? null;
        const client_secret = secretRef.current;
        if (!el || !client_secret) {
          pendingConfirmRef.current = true;
          dbg("handlePayment：未就绪，已挂起", {
            hasEl: !!el,
            hasSecret: !!client_secret,
          });
          return;
        }
        pendingConfirmRef.current = false;
        void el
          .confirmIntent({ client_secret })
          .catch((e: unknown) => {
            dbg("confirmIntent 异常", e);
            setShowIncomplete(true);
          });
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    cleanupAll();

    async function run() {
      dbg("0 start", { productId, payCreatePayment, redirectHref });

      if (!productId) {
        setShowIncomplete(true);
        return;
      }
      if (!redirectHref?.trim()) {
        dbg("0 无 redirect，跳过");
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
        dbg("1 pay/create 异常", e);
        setShowIncomplete(true);
        return;
      }

      if (result.c !== 0) {
        dbg("1 pay/create 失败", { c: result.c, m: result.m });
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
      const amountValue = majorAmount(
        result.d["amount"] ??
          result.d["amount_major"] ??
          result.d["pay_amount"] ??
          result.d["price"],
      );
      const gPayLine = googlePayPriceString(
        amountValue,
        redirectFields.currency,
      );

      const dropInOptions = {
        mode: "recurring" as const,
        intent_id: redirectFields.intent_id,
        client_secret: redirectFields.client_secret,
        customer_id: redirectFields.customer_id,
        amount: { value: amountValue, currency: redirectFields.currency },
        countryCode: "HK",
        appearance: {
          mode: "dark" as const,
          variables: { ...walletVariables },
          rules: { ...walletRules },
        },
        buttonSizeMode: "fill" as const,
      } as const;

      const onSuccess = () => {
        const url = redirectFields.successUrl;
        if (url) {
          window.location.assign(url);
        }
      };
      const onError = (ev?: unknown) => {
        dbg("wallet error", ev);
        setShowIncomplete(true);
      };
      const onCancel = (ev?: unknown) => {
        dbg("wallet cancel", ev);
      };

      try {
        await airwallexRunShoppingWalletExclusive(async () => {
          try {
            await airwallexEnsureShoppingWalletInit(
              normalizeAirwallexLocale(intl.locale),
              env,
            );
          } catch (e) {
            dbg("2 init 失败", e);
            setShowIncomplete(true);
            return;
          }
          if (isCancelled()) {
            return;
          }
          const elementType =
            payCreatePayment === 1
              ? ("applePayButton" as const)
              : ("googlePayButton" as const);
          dbg("3 createElement", { elementType });

          const raw = await createElement(
            elementType,
            (elementType === "googlePayButton"
              ? ({
                  ...dropInOptions,
                  buttonColor: "white" as const,
                  buttonType: "short" as const,
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
                      price: gPayLine,
                      status: "FINAL" as const,
                      type: "LINE_ITEM" as const,
                    },
                  ],
                } as const)
              : ({
                  ...dropInOptions,
                  buttonType: "plain" as const,
                  buttonColor: "black" as const,
                } as const)) as unknown as Parameters<
              typeof createElement<"googlePayButton">
            >[1],
          );
          const el = raw as unknown as AirwallexMounted | null;
          if (!el) {
            setShowIncomplete(true);
            return;
          }
          el.on("success", onSuccess);
          el.on("error", onError);
          el.on("cancel", onCancel);
          instancesRef.current.push(el);
          secretRef.current = redirectFields.client_secret;
          mountToRef(
            el,
            mountRef,
            isCancelled,
            payCreatePayment === 1 ? "ApplePayButton" : "GooglePayButton",
          );
          dbg("4 ready");

          if (pendingConfirmRef.current) {
            pendingConfirmRef.current = false;
            dbg("4 ready：执行挂起的 handlePayment");
            void el
              .confirmIntent({ client_secret: redirectFields.client_secret })
              .catch((e: unknown) => {
                dbg("confirmIntent 异常", e);
                setShowIncomplete(true);
              });
          }
        });
      } catch (e) {
        dbg("3 异常", e);
        setShowIncomplete(true);
      }
    }

    void run();
    return () => {
      cancelled = true;
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, payCreatePayment, intl.locale, redirectHref]);

  return (
    <>
      <div
        className={cn(
          "rs-shopping-airwallex-wallet",
          "rs-shopping-airwallex-wallet--dark",
        )}
      >
        <div
          ref={mountRef}
          className="rs-shopping-airwallex-wallet__mount"
        />
      </div>
      <PayIncompleteDialog
        open={showIncomplete}
        onOpenChange={setShowIncomplete}
      />
    </>
  );
});
