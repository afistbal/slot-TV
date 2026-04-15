import { api, type TData } from "@/api";
import {
  airwallexEnsureShoppingWalletInit,
  airwallexRunShoppingWalletExclusive,
  normalizeAirwallexLocale,
} from "@/lib/airwallexShoppingWalletEmbedSingleton";
import { Page } from "@/layouts/user";
import { createElement, type ElementTypes } from "@airwallex/components-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router";

type Product = {
  id: number;
  type: number;
  name: string;
  price: string;
  renewal_price: string;
};

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

/**
 * 开发演示：购物页套餐卡片（`rs-shopping__plans` / `rs-shopping__plan`）
 * 当前先只保留 1 个 9.99 套餐做 Apple Pay 单点排查。
 */
export default function AirwallexGooglePayButtonDemo() {
  const intl = useIntl();
  const [searchParams] = useSearchParams();
  const forceEnv = searchParams.get("awenv"); // demo/prod，仅用于本演示页

  const elementsRef = useRef<Map<number, ElementTypes["applePayButton"]>>(
    new Map(),
  );
  const planMountRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const [error, setError] = useState<string | null>(null);
  const [envHint, setEnvHint] = useState<"prod" | "demo" | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [renderedIds, setRenderedIds] = useState<Set<number>>(() => new Set());
  /** 仅作提示，不拦截挂载（避免误判；真正能否弹窗由 Apple + Airwallex 决定） */
  const [applePaySupported, setApplePaySupported] = useState<boolean | null>(
    null,
  );
  const [applePayHint, setApplePayHint] = useState<string | null>(null);
  /** Apple Pay 要求安全上下文；用局域网 IP 打开 http 会触发 InvalidAccessError: insecure document */
  const [secureContextOk, setSecureContextOk] = useState<boolean | null>(null);

  const redirectHref =
    typeof window !== "undefined" ? window.location.href : "";

  const cleanupElements = useCallback(() => {
    for (const [, el] of elementsRef.current) {
      try {
        el.unmount();
        el.destroy();
      } catch {
        /* noop */
      }
    }
    elementsRef.current.clear();
    setRenderedIds(new Set());
  }, []);

  useEffect(() => {
    setSecureContextOk(
      typeof window !== "undefined" ? window.isSecureContext : null,
    );
  }, []);

  useEffect(() => {
    let supported = false;
    try {
      const maybeSession = (
        globalThis as { ApplePaySession?: unknown }
      ).ApplePaySession as { canMakePayments?: () => boolean } | undefined;
      if (maybeSession && typeof maybeSession.canMakePayments === "function") {
        supported = Boolean(maybeSession.canMakePayments());
      }
    } catch {
      supported = false;
    }
    setApplePaySupported(supported);
    if (!supported) {
      setApplePayHint(
        "本机 ApplePaySession.canMakePayments() 为 false：请确认已在「钱包」添加可支付卡片、未使用无痕窗口；部分 Mac 需在系统设置中启用 Apple Pay 或使用 iPhone/Apple Watch 确认。",
      );
    } else {
      setApplePayHint(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    setLoadingProducts(true);
    cleanupElements();

    api<Product[]>("product", { data: { from: "shopping" }, loading: false })
      .then((res) => {
        if (!alive) return;
        if (res.c !== 0) return;
        setProducts(res.d || []);
      })
      .finally(() => {
        if (!alive) return;
        setLoadingProducts(false);
      });

    return () => {
      alive = false;
      cleanupElements();
    };
  }, [cleanupElements]);

  const selectedPlans = useMemo(() => {
    const target = products.find((p) => String(p.price) === "9.99");
    if (target) return [target];
    return products.slice(0, 1);
  }, [products]);

  const ensureMountedForPlans = useCallback(async () => {
    if (!redirectHref.trim()) {
      setError("缺少 redirect 上下文");
      return;
    }
    if (!selectedPlans.length) return;

    await airwallexRunShoppingWalletExclusive(async () => {
      for (const p of selectedPlans) {
        if (elementsRef.current.has(p.id)) continue;
        const host = planMountRefs.current.get(p.id) ?? null;
        if (!host) continue;

        const payCreate = await api<TData>("pay/create", {
          method: "post",
          loading: false,
          data: {
            payment: 1,
            product_id: p.id,
            redirect: redirectHref,
          },
        });
        if (payCreate.c !== 0) {
          setError(
            payCreate.m
              ? String(payCreate.m)
              : `pay/create 失败（c=${String(payCreate.c)}）`,
          );
          continue;
        }

        const backendEnv = payCreate.d["env"] as "prod" | "demo" | undefined;
        const sdkEnv: "prod" | "demo" =
          forceEnv === "demo" || forceEnv === "prod"
            ? forceEnv
            : backendEnv === "prod" || backendEnv === "demo"
              ? backendEnv
              : "demo";
        setEnvHint(sdkEnv);
        await airwallexEnsureShoppingWalletInit(
          normalizeAirwallexLocale(intl.locale),
          sdkEnv,
        );

        const intent_id = payCreate.d["pi"] as string;
        const client_secret = payCreate.d["client_secret"] as string;
        const customer_id = payCreate.d["customer_id"] as string;
        const currency = (payCreate.d["currency"] as string) || "USD";
        const amountValue = majorAmount(
          payCreate.d["amount"] ??
            payCreate.d["amount_major"] ??
            payCreate.d["pay_amount"] ??
            payCreate.d["price"],
        );
        const recurringOptions = {
          next_triggered_by: "merchant" as const,
          merchant_trigger_reason: "scheduled" as const,
        };

        const applePayButtonOptions = {
          mode: "recurring" as const,
          intent_id,
          client_secret,
          customer_id,
          amount: { value: amountValue, currency },
          payment_consent: recurringOptions,
          countryCode: "HK",
          submitType: "subscribe" as const,
          buttonColor: "black" as const,
          buttonType: "plain" as const,
          merchantCapabilities: [{ supports3DS: true }],
          style: {
            width: "100%",
            height: "56px !important",
          },
        };

        const el = await createElement(
          "applePayButton",
          applePayButtonOptions as unknown as Parameters<
            typeof createElement<"applePayButton">
          >[1],
        );
        if (!el) continue;

        (el as unknown as {
          on: (code: string, cb: (ev?: unknown) => void) => void;
        }).on("success", () => {
          const url = payCreate.d["success_url"] as string;
          if (url) window.location.assign(url);
        });
        (el as unknown as {
          on: (code: string, cb: (ev?: unknown) => void) => void;
        }).on("error", (ev?: unknown) => {
          const detail = (
            ev as { detail?: { error?: { message?: string } } }
          )?.detail?.error?.message;
          setError(detail || "applePayButton error");
        });
        (el as unknown as {
          on: (code: string, cb: (ev?: unknown) => void) => void;
        }).on("cancel", () => {
          /* 用户取消，不当作错误 */
        });

        el.mount(host);
        elementsRef.current.set(p.id, el);
      }
    });
  }, [cleanupElements, forceEnv, intl, redirectHref, selectedPlans]);

  useEffect(() => {
    void ensureMountedForPlans();
  }, [ensureMountedForPlans]);

  useEffect(() => {
    const observers: MutationObserver[] = [];
    const initialRendered = new Set<number>();
    setRenderedIds(new Set());

    for (const p of selectedPlans) {
      const host = planMountRefs.current.get(p.id);
      if (!host) continue;
      if (host.childElementCount > 0) {
        initialRendered.add(p.id);
      }
      const obs = new MutationObserver(() => {
        setRenderedIds((prev) => {
          const n = new Set(prev);
          if (host.childElementCount > 0) n.add(p.id);
          return n;
        });
      });
      obs.observe(host, { childList: true, subtree: true });
      observers.push(obs);
    }
    if (initialRendered.size > 0) {
      setRenderedIds(initialRendered);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, [selectedPlans]);

  return (
    <Page
      title="airwallex_google_pay_demo_title"
      bodyClassName="p-4 max-w-md mx-auto"
    >
      <p className="text-sm text-white/70 mb-4">
        数据来自 <code className="text-white">/api/product?from=shopping</code>，并复用
        <code className="text-white">/shopping</code> 的 DOM：
        <code className="text-white">rs-shopping__plans</code> /{" "}
        <code className="text-white">rs-shopping__plan</code>。
        当前仅渲染一个 <code className="text-white">$9.99</code> 套餐用于排查 Apple
        Pay 按钮展示与拉起。
      </p>

      {secureContextOk === false ? (
        <div className="rounded-md border border-red-500/60 bg-red-950/50 p-3 text-sm text-red-100 mb-4 space-y-2">
          <div className="font-medium">
            当前不是安全上下文，Apple Pay 无法启动（控制台常见：InvalidAccessError: Trying to start an Apple Pay session from an insecure document）。
          </div>
          <p className="text-xs text-red-100/80 border-t border-red-500/30 pt-2 mt-1">
            这是浏览器 / Apple Pay 的安全策略，不是 React 或 pay/create 等业务代码写错；需改访问协议或域名（见下），而不是在业务里「修一行」就能消除该错误。
          </p>
          <ul className="list-disc pl-4 text-xs text-red-100/90 space-y-1">
            <li>
              不要用局域网地址打开，例如{" "}
              <code className="text-white">http://192.168.x.x:5173</code>；请改用{" "}
              <code className="text-white">http://localhost:5173</code> 或{" "}
              <code className="text-white">http://127.0.0.1:5173</code> 同一台机器调试。
            </li>
            <li>
              若必须用局域网 IP 或 Safari 仍要求加密，请用本地 HTTPS（例如 mkcert 签发证书后配置 Vite{" "}
              <code className="text-white">server.https</code>，或{" "}
              <code className="text-white">@vitejs/plugin-basic-ssl</code>）。
            </li>
          </ul>
        </div>
      ) : null}

      {applePaySupported === false && applePayHint ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-100/90 mb-4">
          {applePayHint}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200 mb-4">
          {error}
        </div>
      ) : null}

      {envHint ? (
        <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/70 mb-4 space-y-1">
          <div>
            当前 Airwallex 环境：<code className="text-white">{envHint}</code>
          </div>
          {envHint === "prod" ? (
            <div className="text-white/60">
              提示：在 <code className="text-white">localhost</code> 上使用{" "}
              <code className="text-white">prod</code>，Apple Pay 可能因域名/商户校验无法弹出。
              你可以加参数{" "}
              <code className="text-white">?awenv=demo</code> 仅用于演示验证“能不能弹”。
            </div>
          ) : (
            <div className="text-white/60">
              SDK 环境已与 <code className="text-white">pay/create</code> 返回的{" "}
              <code className="text-white">env</code> 对齐；若开发者工具里对{" "}
              <code className="text-white">checkout-demo.airwallex.com</code> 的请求出现{" "}
              <code className="text-white">401</code>，请核对 intent 与{" "}
              <code className="text-white">init</code> 的 <code className="text-white">env</code>{" "}
              是否一致，或临时加{" "}
              <code className="text-white">?awenv=demo</code> / <code className="text-white">?awenv=prod</code> 强制覆盖。
            </div>
          )}
        </div>
      ) : null}

      <div className="rs-shopping__plans rs-shopping__plans--demoSingleCol">
        {loadingProducts ? (
          <div className="text-xs text-white/50">加载套餐中…</div>
        ) : null}
        {selectedPlans.map((p) => (
          <div key={p.id} className="rs-shopping__plan relative">
            <div
              ref={(node) => {
                planMountRefs.current.set(p.id, node);
              }}
              className="rs-shopping__planPayMount absolute inset-0 z-10"
              style={{
                opacity: renderedIds.has(p.id) ? 0.35 : 0,
                pointerEvents: renderedIds.has(p.id) ? "auto" : "none",
              }}
            />

            <div className="rs-shopping__planBody">
              <div className="rs-shopping__planText">
                <div className="rs-shopping__planName">{p.name}</div>
                <div className="rs-shopping__planPriceRow">
                  <div className="rs-shopping__planPrice">${p.price}</div>
                </div>
                <div className="rs-shopping__planRenew">
                  {intl.formatMessage({ id: "shopping_auto_renew_short" })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
