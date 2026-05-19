/** 在 `.env.development` 中设置 `VITE_SKIP_API=true` 可在无后端时进入应用壳与首页 */
export const skipRemoteApi = import.meta.env.VITE_SKIP_API === 'true';

/** `VITE_PWA_INSTALL_PROMPT=true` 时显示「添加到桌面」安装引导（`beforeinstallprompt`）。默认不展示。 */
export const showPwaInstallPrompt = import.meta.env.VITE_PWA_INSTALL_PROMPT === 'true';

/**
 * H5 底部四栏 Tab；设为 `false` 可关闭（`VITE_BOTTOM_TAB_BAR=false`，需重启 dev / 重构建）。
 * 默认开启，对齐 YogoShort 底栏。
 */
export const showBottomTabBar = import.meta.env.VITE_BOTTOM_TAB_BAR !== 'false';

/**
 * 可选：分享链接基础域名（用于开发环境替换 localhost）。
 * 示例：VITE_SHARE_ORIGIN=https://testwww.yogoshort.com
 */
export const shareOrigin = String(import.meta.env.VITE_SHARE_ORIGIN ?? '').trim();
