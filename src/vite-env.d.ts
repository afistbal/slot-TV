/// <reference types="vite/client" />

declare module 'swiper/css';

declare module 'xgplayer' {
    export default class Player {
        video?: HTMLVideoElement;
        constructor(config: Record<string, unknown>);
        play(): Promise<void>;
        pause(): void;
        destroy(): void;
        on(event: string, handler: (...args: unknown[]) => void): void;
        off(event: string, handler: (...args: unknown[]) => void): void;
    }
}

declare module 'xgplayer-mp4' {
    const Mp4Plugin: unknown;
    export default Mp4Plugin;
}

declare module 'xgplayer/dist/index.min.css';

interface ImportMetaEnv {
  readonly VITE_PLATFORM?: string;
  readonly VITE_TIKTOK_MONETIZATION_MODE?: 'iaa' | 'iap';
  readonly VITE_TIKTOK_REWARDED_AD_UNIT_ID?: string;
  readonly VITE_SKIP_API?: string;
  readonly VITE_PWA_INSTALL_PROMPT?: string;
  /** 设为 `false` 关闭 H5 底部四栏 Tab */
  readonly VITE_BOTTOM_TAB_BAR?: string;
  /** 与 lot-h5 一致：设为 `prod` 时走生产 baseURL */
  readonly VITE_APP_FLAG?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SHARE_ORIGIN?: string;
  readonly VITE_BRAND_DISPLAY_NAME?: string;
  readonly VITE_BRAND_DOMAIN_DISPLAY?: string;
  readonly VITE_BRAND_DESCRIPTION?: string;
  readonly VITE_BRAND_CONTACT_EMAIL?: string;
  readonly VITE_BRAND_COPYRIGHT_COMPANY?: string;
  readonly VITE_BRAND_ASSET_BASE?: string;
  readonly VITE_BRAND_COIN_ICON_SRC?: string;
  readonly VITE_BRAND_LEGAL_SITE_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /** 设为 `true` 在非 localhost 环境也启用 disable-devtools.js（默认 prod 且非 5173 端口已启用） */
  readonly VITE_DISABLE_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Safari：由 `applePayWeb.d.ts` 声明 `ApplePaySession` 后，挂到 window 上 */
interface Window {
  ApplePaySession?: typeof ApplePaySession;
}

declare const __APP_VERSION__: string;
