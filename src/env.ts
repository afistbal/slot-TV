/** 在 `.env.development` 中设置 `VITE_SKIP_API=true` 可在无后端时进入应用壳与首页 */
export const skipRemoteApi = import.meta.env.VITE_SKIP_API === 'true';

/** `VITE_PWA_INSTALL_PROMPT=true` 时显示「添加到桌面」安装引导（`beforeinstallprompt`）。默认不展示。 */
export const showPwaInstallPrompt = import.meta.env.VITE_PWA_INSTALL_PROMPT === 'true';

/**
 * ReelShort 无底部 Tab；设为 `true` 可恢复旧版三栏底栏（需重启 dev / 重构建）。
 * 默认 `false` = 隐藏底栏，对齐 ReelShort。
 */
export const showBottomTabBar = import.meta.env.VITE_BOTTOM_TAB_BAR === 'true';
