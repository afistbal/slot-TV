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
  readonly VITE_SKIP_API?: string;
  readonly VITE_PWA_INSTALL_PROMPT?: string;
  /** 设为 `false` 关闭 H5 底部四栏 Tab */
  readonly VITE_BOTTOM_TAB_BAR?: string;
  /** 与 lot-h5 一致：设为 `prod` 时走生产 baseURL */
  readonly VITE_APP_FLAG?: string;
  /** POST 请求加密：`true` / `false`；未设则 dev 加密、build 明文 */
  readonly VITE_API_REQUEST_ENCRYPTION?: string;
  /** 设为 `true` 在非 localhost 环境也启用 disable-devtools.js（默认 prod 且非 5173 端口已启用） */
  readonly VITE_DISABLE_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Safari：由 `applePayWeb.d.ts` 声明 `ApplePaySession` 后，挂到 window 上 */
interface Window {
  ApplePaySession?: typeof ApplePaySession;
  /** Chromium：本地批量写文件（工具页 `/zgjdownload`） */
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

declare const __APP_VERSION__: string;
