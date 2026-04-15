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
 * 开发演示：购物页 3 个套餐卡片（`rs-shopping__plans` / `rs-shopping__plan`）
 * 每个卡片都挂一个半透明 `applePayButton`（真实可点），实现“点套餐=点 Apple Pay”。
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
    const wanted = ["9.99", "24.99", "49.99"];
    const hits = wanted
      .map((v) => products.find((p) => String(p.price) === v))
      .filter(Boolean) as Product[];
    if (hits.length === 3) return hits;
    return products.slice(0, 3);
  }, [products]);

  const ensureMountedForPlans = useCallback(async () => {
    if (!redirectHref.trim()) {
      setError("缺少 redirect 上下文");
      return;
    }
    if (!selectedPlans.length) return;

    await airwallexRunShoppingWalletExclusive(async () => {
      const effectiveEnv: "prod" | "demo" =
        forceEnv === "demo" || forceEnv === "prod" ? forceEnv : "demo";
      setEnvHint(effectiveEnv);
      await airwallexEnsureShoppingWalletInit(
        normalizeAirwallexLocale(intl.locale),
        effectiveEnv,
      );

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
        if (payCreate.c !== 0) continue;

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
          style: {
            width: "100%",
            height: "200px !important",
          },
        };

        const el = await createElement(
          "applePayButton",
          applePayButtonOptions as Parameters<
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

        el.mount(host);
        elementsRef.current.set(p.id, el);
      }
    });
  }, [forceEnv, intl, redirectHref, selectedPlans]);

  useEffect(() => {
    void ensureMountedForPlans();
  }, [ensureMountedForPlans]);

  useEffect(() => {
    const observers: MutationObserver[] = [];
    setRenderedIds(new Set());

    for (const p of selectedPlans) {
      const host = planMountRefs.current.get(p.id);
      if (!host) continue;
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
        每个套餐卡片都挂一个半透明 Apple Pay（真实按钮），点卡片即拉起对应金额支付。
      </p>

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
              demo 环境更适合在本地验证拉起；若仍不弹窗，再重点排查网络是否能访问{" "}
              <code className="text-white">pay.google.com</code>。
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
