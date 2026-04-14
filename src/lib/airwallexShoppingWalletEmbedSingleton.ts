import { init } from "@airwallex/components-sdk";

type AirwallexInit = NonNullable<Parameters<typeof init>[0]>;
type AirwallexInitLocale = NonNullable<AirwallexInit["locale"]>;

/** 与 `CheckoutAirwallexPanel` 的 `normalizeAirwallexLocale` 行为一致（本文件仅供购物新组件使用） */
export function normalizeAirwallexLocale(
  reactLocale: string,
): AirwallexInitLocale {
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

let initLocale: string | null = null;
let initEnv: "prod" | "demo" | null = null;
let initPromise: Promise<unknown> | null = null;

export async function airwallexEnsureShoppingWalletInit(
  locale: AirwallexInitLocale,
  env: "prod" | "demo",
): Promise<void> {
  if (initPromise && initLocale === locale && initEnv === env) {
    await initPromise;
    return;
  }
  initLocale = locale;
  initEnv = env;
  initPromise = init({
    locale,
    env,
    enabledElements: ["payments"],
  });
  await initPromise;
}

let embedChain: Promise<unknown> = Promise.resolve();

/** 同页仅串行一次 `createElement`+`mount`，避免与多实例抢 SDK */
export function airwallexRunShoppingWalletExclusive<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const next = embedChain.then(fn, fn);
  embedChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
