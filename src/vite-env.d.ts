/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SKIP_API?: string;
  readonly VITE_PWA_INSTALL_PROMPT?: string;
  readonly VITE_BOTTOM_TAB_BAR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
