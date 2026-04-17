/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SKIP_API?: string;
  readonly VITE_PWA_INSTALL_PROMPT?: string;
  readonly VITE_BOTTOM_TAB_BAR?: string;
  /** 与 lot-h5 一致：设为 `prod` 时走生产 baseURL */
  readonly VITE_APP_FLAG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Safari：由 `applePayWeb.d.ts` 声明 `ApplePaySession` 后，挂到 window 上 */
interface Window {
  ApplePaySession?: typeof ApplePaySession;
}

declare const __APP_VERSION__: string;
