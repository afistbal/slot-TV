# slot-TV（YogoShort）项目上下文与改造计划

> **用途**：本次大规模改造期间，请优先阅读本文档后再改代码或讨论方案。更新计划时同步修改本文档。

---

## 1. 项目是什么

| 项 | 说明 |
|----|------|
| 名称 | 前端项目（产品名常见为 **YogoShort**） |
| 路径 | `slot-TV` 仓库根目录 |
| 技术栈 | **Vite 6** + **React** + **TypeScript** + **Tailwind CSS v4** + **Sass（SCSS）** + **PWA**（vite-plugin-pwa） |
| 路由 | React Router 7 |
| 国际化 | react-intl，文案在 `src/locales/*.json` |
| 状态 | Zustand（如 `stores/home`、`stores/config`、`stores/user`） |
| HTTP | `ky`，`prefixUrl: '/api'`（`src/api.ts`） |

---

## 2. 环境与运行

| 项 | 说明 |
|----|------|
| **推荐 Node** | **≥18.18**，更稳妥 **20 LTS**（勿长期使用 Node 16） |
| 开发 | `npm run dev` → 默认 `http://localhost:5173/` |
| 构建 | `npm run build` |
| **本地后端** | `vite.config.ts` 将 `/api` 代理到 `http://127.0.0.1:8000`；无后端时会出现代理错误，属预期 |

### 2.1 无后端开发（离线壳）

- 在 **`.env.development`** 中设置 **`VITE_SKIP_API=true`**（见 `src/env.ts` 的 `skipRemoteApi`）。
- 作用：跳过初始化 `config` / 登录 / 心跳等接口；首页、列表、视频详情等使用 **mock 数据**。
- **改完 `.env.*` 后需重启** `npm run dev`。

### 2.2 PWA「安装到桌面」弹窗

- **`VITE_PWA_INSTALL_PROMPT`**（`src/env.ts` 的 `showPwaInstallPrompt`）：为 **`true`** 时才监听 `beforeinstallprompt` 并显示原 `#install` 卡片；**默认未设置即为隐藏**。
- 需要打开时：在 `.env.development` / 生产环境变量中写 `VITE_PWA_INSTALL_PROMPT=true` 并重启构建或 dev。

---

## 3. 改造背景与目的

### 3.1 总体目标

- 对应用进行 **大规模 UI/UX 与结构改造**，整体风格参考 **竖屏短剧类产品**（如 [ReelShort](https://www.reelshort.com/)）的 **版式与体验**，而非复制其业务或素材。
- 保持 **自有品牌（YogoShort）** 与 **现有后端契约**（`/api`），在「像行业头部产品」与「可维护、可接真接口」之间平衡。

### 3.2 已明确的取向

- **首页 Banner**：全宽深色氛围（`#12081b`）、全幅 `object-cover`、**多层 `absolute` 叠图 + `opacity` 淡入淡出（约 600ms，`transition-all ease`）**（与 ReelShort 同款 crossfade，非横向滑动）、自动轮播、指示点与轻扫切帧、左右黑色渐变、Banner 上方 **顶栏叠层 + 负 margin 与顶部渐变**（与 ReelShort 叠在首图上的观感一致）、首图 preload/LCP 优化（实现见 `src/pages/user/Home.tsx` + `src/index.css` 中 `.home-hero-*`）。**底部指示点**：`role="tablist"` 容器 **`home-hero-banner-dots`**，每项为 **`button.home-hero-banner-dots__tab` > `span.home-hero-banner-dots__thumb`**；未选为小圆渐变，**选中为纯白 `#fff` 圆角 pill** + 轻阴影，写在 **`src/styles/reelshort.scss`**（`button[aria-selected="true"] span`），勿在 TSX 堆 Tailwind。
- **顶栏导航（ReelShort 式）**：**透明 sticky 双行**——上行：左侧 **汉堡 SVG**（与镜像内联图一致）+ **圆形头像位**（链到 `/profile`）、中间 **Logo + 字标**、右侧留白；下行：**Home / Categories / Fandom / Brand** 文本链（下划线激活态）。汉堡打开 **左侧抽屉**（Radix `Dialog` 定制全高左栏），内含搜索、个人、语言、关于。字标图 **`/brand-wordmark.png`**，缺失时自动回退为 `site_name` 文案。实现：`src/components/ReelShortTopNav.tsx`；文案键 `nav_*` 见 `src/locales/*.json`。
- **默认字体**：镜像全站为 `html { font-family: var(--fontFamily) }`（具体栈由 Next/Ant 注入，与中文移动 Web 常见 **PingFang SC / -apple-system / Helvetica Neue / 微软雅黑** 一致）。本项目在 `src/index.css` 的 `:root` 使用 **`--app-font-sans`**，并赋给 `html, body, #root` 与 Tailwind `@theme` 的 **`--font-sans`**。
- **侧栏 `bg-app-surface` 内边距**：抽屉顶栏（关按钮一行）为 **`padding: 16px 24px`**（竖 16px、横 24px，与对标侧栏顶区一致）；列表主区仍为 **`min(6.4vw, 1.5rem)`**，`md` 为 **24px**。样式在 **`src/styles/reelshort.scss`** 的 **`.reelshort-nav-drawer__header` / `__scroll` / `__content`**；结构见 `src/components/ReelShortNavDrawer.tsx`。
- **侧栏关闭按钮**：结构对标 Ant **`.ant-drawer-close`**（`margin-inline-end: 12px`、`font-weight: 600`、`line-height: 1` 等）；图标 **`min(6.4vw, 1.5rem)`** + SVG `1em`。SVG 无 `fill="currentColor"`，**`path { fill: #fff }`**（默认与悬停均为纯白）。类名 **`button.reelshort-nav-drawer__close`**（`src/styles/reelshort.scss`）。
- **底栏 Tab**：与顶栏同色系 **`#12081b`**、白字/半透、激活态纯白（`src/layouts/user.tsx`）。图标暂为 **lucide-react**（Home / ListVideo / User），若要对齐 ReelShort 官方矢量资源，可替换为自有 SVG/PNG 并保持 20×20dp 量级。
- **本地参考**：若存在镜像目录 `D:\JJ-TV\reelshort\www.reelshort.com\`，仅作 **HTML/CSS 结构、head preload、资源策略** 的参考，**不**维护对方打包 JS 逻辑。对方站点为 **Next.js + React**；Banner 切换为 **CSS `transition` + 叠层 `opacity`**，非独立轮播插件。

#### 对标 ReelShort 时的执行优先级（给 AI / 实现者）

当需求是「与 ReelShort 1:1」或「和对方一致」时，**不要凭感觉写 Tailwind**，按顺序查：

1. **DOM 结构**：`reelshort/www.reelshort.com/index.html` 中对应区块的 **类名层级**（如 `Footer_footer__*`、`Footer_community__*`）。
2. **具体数值**：`reelshort/www.reelshort.com/_next/static/css/` 下打包 CSS（常为单文件超长行）里 **搜索同一类名字符串**，读出 `padding`、`border`、`font-size`（多为 **vw**，375 设计稿）、`flex`/`text-align` 等。
3. **落到本项目**：用 **语义化 class**，写在 **`src/styles/reelshort.scss`**（层级嵌套、Banner 点、侧栏抽屉）或 **`src/index.css`**（Tailwind、`@theme`、`@layer`、`.reelshort-footer*` 等仍放此文件）；组件里 **只写类名**。AI **grep `reelshort-`、`home-hero-banner-dots`**。若要用 **Less**：`npm i -D less`，新建 `.less` 并在 `main.tsx` 中 `import` 即可（与 SCSS 可并存）。

- **页脚（移动）**：`src/components/ReelShortFooter.tsx` + `src/index.css` 中 `.reelshort-footer*` 已对齐全站镜像里 `.Footer_footer__wSzLt`、`.Footer_community__p3HfK` 等规则（半透明顶栏底、顶边框、折叠行 vw 内边距、COMMUNITY 标题居中 + 图标行 `justify-content:center` 与链接 `8.53333vw` 等）。

### 3.3 合规与边界

- **不**直接拷贝第三方 **商标、剧照、逐字文案、受版权保护资源**。
- **可**：布局、间距、组件层级、交互模式、性能手段（preload、srcset、CDN 图片参数）等通用实现。

---

## 4. 当前实现速查（与改造相关）

| 模块 | 路径 / 说明 |
|------|-------------|
| 离线开关 | `src/env.ts`，`VITE_SKIP_API` |
| 首页 mock | `src/mocks/homeOffline.ts` |
| 视频详情 mock | `src/mocks/videoOffline.ts`，`src/types/videoPlayer.ts` |
| 视频页 | `src/pages/user/Video.tsx`（含离线分支） |
| 首页 | `src/pages/user/Home.tsx`（Banner + 内嵌顶栏叠层 + **ReelShort 式书架** `HomePage_main__BzEnK` / `HomeBookShelf`） |
| 首页顶栏 | `src/components/ReelShortTopNav.tsx`（汉堡、字标、二级导航、侧栏） |
| 用户壳层 | `src/layouts/user.tsx`（底栏 Tab + `Page` 内页顶栏） |
| 全局样式 | `src/index.css`（Tailwind、`@theme`、`@layer`、`.home-hero-shell`、渐变、`.reelshort-footer*` 等）+ **`src/styles/reelshort.scss`** + **`src/styles/home-reelshort.scss`**（镜像 class：`HomePage_main__*`、`BookItem_*`、`HomePage_type_1` / `type_5`） |
| 首页页脚 | `src/components/ReelShortFooter.tsx`（折叠区 + COMMUNITY + 版权，结构对齐镜像 Footer） |
| Vite 代理 | `vite.config.ts` → `server.proxy['/api']` |

---

## 5. 改造计划（分阶段，可勾选）

> 下列顺序可按实际调整；完成一项建议在本文档打勾或更新说明。

### 阶段 A — 设计与基础

- [ ] 定稿：**配色 / 字体层级 / 圆角 / 间距**（首页已用 `#12081b` 顶底栏，内容区仍为 `#f2f3f4`，是否全局暗色待定）
- [ ] 将设计 token 写入 `index.css` 或 Tailwind `@theme`，避免魔法数字散落
- [x] **PWA / 底栏** 与首页暗色顶栏视觉已对齐（`layouts/user.tsx`）

### 阶段 B — 首页与内容流

- [ ] 首页：Banner 与下方「为你推荐 / 排行 / 最新」区块的 **间距与卡片** 统一
- [x] Banner 与顶栏 **overlap**（负 margin + 顶栏透明 sticky + Banner 顶渐变）已按 ReelShort 思路实现
- [ ] 加载态 / 空态与 ReelShort 式骨架或占位策略

### 阶段 C — 列表与详情

- [ ] `/my-list`（收藏 / 历史）与全局样式统一
- [ ] `/video/:id`：播放器控件与全屏短剧体验是否继续优化
- [ ] 与真实 API 联调时关闭 `VITE_SKIP_API`，逐步去掉 mock 依赖

### 阶段 D — 性能与工程

- [ ] 首屏关键图 **preload** 策略与真实接口字段对齐
- [ ] 图片 CDN/OSS 参数（resize、quality）与 `config.static` 拼接规则文档化
- [ ] `npm run build` / Lighthouse 抽查（LCP、CLS）

### 阶段 E — 文案与国际化

- [ ] 新增/调整文案键（含 `FREE` 等产品名来自 API 时的 **i18n 兜底**）
- [ ] 各语言 `locales/*.json` 同步策略

---

## 6. 给 AI / 协作者的使用方式

1. **新开任务或大改前**，先说明：「请阅读 `docs/PROJECT_CONTEXT.md`」。
2. **计划有变**时，直接改本文档的「§5 改造计划」或「§3 目的」，避免口头约定丢失。
3. **重大决策**（例如：完全暗色顶栏、是否放弃桌面窄屏模式）记在 §3 或 §5 下单独小节。
4. **改 ReelShort 对标样式时**：搜 **`src/styles/reelshort.scss`** 与 **`src/index.css`** 中的 **`reelshort-`** / **`home-hero-banner-dots`**，避免在 TSX 堆叠长串 Tailwind。

---

## 7. 文档维护

| 日期 | 变更摘要 |
|------|----------|
| 2026-03-28 | 初版：项目信息、离线开发、ReelShort 参考方向、改造阶段清单 |
| 2026-03-28 | 补充：Banner crossfade、ReelShort 式顶栏（`ReelShortTopNav`）、底栏深色 Tab、字标资源说明、阶段 A/B 部分勾选 |
| 2026-03-28 | PWA 安装弹窗改为 `VITE_PWA_INSTALL_PROMPT` 开关（默认隐藏） |
| 2026-03-28 | 补充：对标 ReelShort 页脚（`.reelshort-footer*` + `ReelShortFooter` DOM）及 §3.2「对标执行优先级」 |
| 2026-03-28 | 补充：`--app-font-sans` 默认字体栈；`ReelShortNavDrawer` 顶栏/内容区 padding 对标 `Nav_navContainer` 4.8vw 与 6.4vw（24px） |
| 2026-03-28 | 约定：对标块布局用 `src/index.css` 语义 class（`.reelshort-nav-drawer__*`）；抽屉滚动区等与 TSX 内联 style 合并进 CSS |
| 2026-03-28 | 抽屉顶栏 `.reelshort-nav-drawer__header` 改为固定 `padding: 16px 24px`（替代 4.8vw / 18px 横向） |
| 2026-03-28 | 抽屉关闭钮 `.reelshort-nav-drawer__close` 对标 Ant `.ant-drawer-close`（深色用白通道透明度） |
| 2026-03-28 | 抽屉关闭图标改为 `min(6.4vw, 1.5rem)` + `rgb(255 255 255 / …)`，对齐镜像 SVG 尺寸与 Uno 白字透明度 |
| 2026-03-28 | 抽屉关闭图标改为 `#fff` + SVG `opacity`（显式 `fill`，修复白字未生效） |
| 2026-03-28 | 首页 Banner 指示点改为 `button > span` + `index.css` 层级嵌套样式（`.home-hero-banner-dots`），选中态 `aria-selected` 控制 |
| 2026-03-28 | Banner 指示点选中态改为纯色 `#fff`（去掉尾部半透明渐变） |
| 2026-03-28 | 增加 **`sass`**，新增 **`src/styles/reelshort.scss`**（Banner 点 + 侧栏抽屉），`main.tsx` 在 `index.css` 后引入 |
| 2026-03-28 | 侧栏关闭图标：去 SVG `fill="currentColor"`，改 `path` 的 `fill: rgba(白,α)`（替代 SVG `opacity`） |
| 2026-03-28 | 侧栏关闭图标默认 **`#fff`**（SCSS + `<path fill="#fff">` 双保险） |
| 2026-03-28 | 首页影视书架对标 ReelShort：`HomeBookShelf` / `HomeBookItem` + `home-reelshort.scss`；首栏标题 **`home_shelf_drama_world`（觀劇寰宇）** |

---

*文件路径：`docs/PROJECT_CONTEXT.md`*
