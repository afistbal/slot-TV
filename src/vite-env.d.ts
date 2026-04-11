/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SKIP_API?: string;
  /**
   * axios `baseURL`（不含末尾 `/`），例如 `https://test.yogoshort.com/api`
   * 不设置时默认为 `/api`，开发时由 Vite proxy 转发。
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
