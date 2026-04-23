import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import PaySuccessDialog from "@/components/PaySuccessDialog";
import {
  airwallexEnsureShoppingWalletInit,
  normalizeAirwallexLocale,
} from "@/lib/airwallexShoppingWalletEmbedSingleton";
import { isApplePlatform } from "@/lib/isApplePlatform";
import { cn } from "@/lib/utils";
import { createElement, type ElementTypes, type Payment } from "@airwallex/components-sdk";
import { useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

/**
 * 仅银行卡 Airwallex Drop-in（逻辑对齐 `/page/demo/airwallex-card`：`pay/create` → singleton `init` → `createElement` → `mount` → `on`）。
 * @see https://www.airwallex.com/docs/js/payments/dropin/
 */
export type CardsProps = {
  productId: number;
  redirectHref: string;
  successAction?: "navigate" | "reload";
  variant?: "page" | "embed";
  externalStatusMode?: boolean;
  onPayStateChange?: (
    state: "processing" | "checking" | "success" | "failed",
  ) => void;
  /**
   * 购物 `aria-modal` 弹层内建议开启：延后 `alert`，与独立页同步 `alert` 区分。
   */
  deferAlerts?: boolean;
  /**
   * 购物内嵌：关掉**我们自写的**联调 `window.alert` / `console`。
   * **不改动** Airwallex：`createElement` / `mount` / `el.on` 及 `success|error|clickConfirmButton` 里除上述调试输出外的逻辑（`onPayStateChange`、Dialog 等仍照旧）。
   */
  silent?: boolean;
};

function fireAlert(message: string, defer: boolean) {
  const run = () => {
    try {
      window.alert(message);
    } catch {
      /* noop */
    }
  };
  if (defer) {
    window.setTimeout(run, 180);
  } else {
    run();
  }
}

export function Cards({
  productId,
  redirectHref,
  successAction = "navigate",
  variant = "page",
  externalStatusMode = false,
  onPayStateChange,
  deferAlerts = false,
  silent = false,
}: CardsProps) {
  const intl = useIntl();
  const cardDbg = (说明: string, 详情?: unknown) => {
    if (!silent) {
      console.log(`[cards] ${说明}`, 详情 ?? "");
    }
  };
  const mountRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ElementTypes["dropIn"] | null>(null);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successUrl, setSuccessUrl] = useState("");
  const successAlertOnceRef = useRef(false);
  const outcomeHandledRef = useRef(false);

  function goSuccess(url: string) {
    if (url) {
      window.location.assign(url);
    }
  }

  function handleSuccessConfirm(url: string) {
    if (successAction === "reload") {
      window.location.reload();
      return;
    }
    goSuccess(url);
  }

  useLayoutEffect(() => {
    const host = mountRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    outcomeHandledRef.current = false;
    successAlertOnceRef.current = false;
    setSuccessUrl("");

    void (async () => {
      const payCreatePayment = isApplePlatform() ? 1 : 2;
      cardDbg("pay/create", { productId, payCreatePayment, redirectHref });

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
        cardDbg("pay/create 异常", e);
        setShowIncomplete(true);
        return;
      }

      if (cancelled || result.c !== 0) {
        if (result.c !== 0) {
          cardDbg("pay/create 失败", { c: result.c, m: result.m });
          setShowIncomplete(true);
        }
        return;
      }

      const d = result.d;
      const intent_id = d["pi"] as string;
      const client_secret = d["client_secret"] as string;
      const customer_id = d["customer_id"] as string;
      const currency = (d["currency"] as string) || "USD";
      const env = d["env"] as "prod" | "demo";
      const redirectSuccessUrl = (d["success_url"] as string) || "";
      const redirectFailUrl = (d["fail_url"] as string) || "";

      try {
        await airwallexEnsureShoppingWalletInit(
          normalizeAirwallexLocale(intl.locale),
          env,
        );
      } catch (e) {
        cardDbg("init 失败", e);
        setShowIncomplete(true);
        return;
      }

      if (cancelled) {
        return;
      }

      const recurringOptions = {
        next_triggered_by: "merchant" as const,
        merchant_trigger_reason: "scheduled" as const,
      };

      const appearance =
        variant === "embed"
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
          : { mode: "light" as const };

      const dropInOptions = {
        mode: "recurring" as const,
        intent_id,
        client_secret,
        customer_id,
        currency,
        payment_consent: recurringOptions,
        recurringOptions,
        methods: ["card"] as const,
        appearance,
        country_code: "HK",
        submitType: "subscribe" as const,
      };

      let el: Awaited<ReturnType<typeof createElement<"dropIn">>> | null = null;
      try {
        el = await createElement(
          "dropIn",
          dropInOptions as unknown as Parameters<typeof createElement<"dropIn">>[1],
        );
      } catch (e) {
        cardDbg("createElement(dropIn) 异常", e);
        setShowIncomplete(true);
        return;
      }

      if (!el || cancelled) {
        try {
          el?.destroy();
        } catch {
          /* noop */
        }
        return;
      }

      /** 与当前可工作的 `DemoAirwallexCard` 一致：先 `mount` 再注册 `on` */
      el.mount(host);
      instanceRef.current = el;

      const onSuccess: Payment.DropInElementEventHandler<"success"> = (e) => {
        if (outcomeHandledRef.current || cancelled) {
          return;
        }
        outcomeHandledRef.current = true;
        const { intent, consent } = e.detail;
        cardDbg("success", { intent, consent });
        if (!silent) {
          console.log("[cards-dropIn] success detail", { intent, consent });
        }
        if (!successAlertOnceRef.current) {
          successAlertOnceRef.current = true;
          if (!silent) {
            const userLine = intl.formatMessage({
              id: "checkout_card_pay_success_alert",
              defaultMessage: "银行卡支付成功（以订单/扣款结果为准）。",
            });
            fireAlert(
              `${userLine}\n[cards dropIn] element.on('success') — 见控制台 intent / consent`,
              deferAlerts,
            );
          }
        }
        onPayStateChange?.("success");
        setSuccessUrl(redirectSuccessUrl);
        if (!externalStatusMode) {
          setShowSuccess(true);
        }
      };

      const onError: Payment.DropInElementEventHandler<"error"> = (ev) => {
        if (outcomeHandledRef.current || cancelled) {
          return;
        }
        outcomeHandledRef.current = true;
        const { error } = ev.detail;
        cardDbg("error", { error, failUrl: redirectFailUrl?.slice(0, 80) });
        if (!silent) {
          console.error("[cards-dropIn] error detail", error, ev);
        }
        if (!silent) {
          const userLine = intl.formatMessage({
            id: "checkout_card_pay_error_alert",
            defaultMessage: "银行卡支付失败，请重试或更换支付方式。",
          });
          fireAlert(
            `${userLine}\n[cards dropIn] element.on('error') — 见控制台 e.detail.error`,
            deferAlerts,
          );
        }
        onPayStateChange?.("failed");
        if (!externalStatusMode) {
          setShowIncomplete(true);
        }
      };

      el.on("ready", () => {
        if (!silent) {
          console.log("[cards-dropIn] ready");
          fireAlert("[cards dropIn] element.on('ready')", deferAlerts);
        }
      });
      el.on("success", onSuccess);
      el.on("error", onError);
      try {
        el.on("clickConfirmButton", () => {
          if (externalStatusMode) {
            onPayStateChange?.("processing");
          }
          if (!silent) {
            console.log("[cards-dropIn] clickConfirmButton");
            fireAlert("[cards dropIn] element.on('clickConfirmButton')", deferAlerts);
          }
        });
      } catch (e) {
        cardDbg("clickConfirmButton 未注册", e);
      }
    })();

    return () => {
      cancelled = true;
      const inst = instanceRef.current;
      instanceRef.current = null;
      if (inst) {
        try {
          inst.unmount();
        } catch {
          /* noop */
        }
        try {
          inst.destroy();
        } catch {
          /* noop */
        }
      }
      host.replaceChildren();
    };
  }, [
    productId,
    intl.locale,
    redirectHref,
    variant,
    externalStatusMode,
    deferAlerts,
    silent,
    onPayStateChange,
  ]);

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
          <div ref={mountRef} className="rs-checkout-h5__dropInMount" />
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
