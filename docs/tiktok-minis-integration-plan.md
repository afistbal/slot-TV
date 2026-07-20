# TikTok Mini Drama 接入任务清单

> 目标：在不影响现有 Web H5 的前提下，把 `slot_old` 构建为可在 TikTok 内运行和提审的 Mini Drama。
>
> 执行方式：按任务编号逐个完成。每项完成后更新本文档的状态，并做对应验收；没有通过验收不进入下一项。

## 0. 当前结论与范围

- 采用**单仓库、双平台构建**，不新写一套前端。
- **H5 兼容性红线**：不替换既有 H5 入口、构建脚本、播放器或支付实现；TikTok 只使用独立入口、独立产物目录和新增适配文件。任何共享代码改动必须以 `tiktok` 构建模式为条件，且先完成 H5 回归构建。
- 页面、路由、剧集列表、收藏、进度、搜索、国际化等业务能力继续复用当前 H5。
- 平台能力通过适配层隔离：登录、播放器、支付/广告、生命周期、分享与导航。
- TikTok 版不能继续使用现有 XGPlayer/原生 `<video>` 播放已审核剧集，必须接入 `TTMinis` 提供的 VePlayer。
- TikTok 版默认采用 `TTMinis.login()` 识别 TikTok 用户；邮箱/Google 仅可作为“迁移/绑定旧 H5 账户”的可选能力。

## 1. 首发决策（由产品/运营确认）

| 编号 | 决策 | 当前值 | 说明 |
| --- | --- | --- | --- |
| D-01 | 首发地区 | 待确认 | 建议先选一个地区，避免多语言和审核工作同时扩大。 |
| D-02 | 首发语言 | 待确认 | 美国建议英语；日本建议英语 + 日语。不要一开始配置全部语言。 |
| D-03 | 首发变现 | 待确认 | 选择 IAP（TikTok Beans）、IAA（广告解锁）或两者。 |
| D-04 | 老用户迁移 | 待确认 | 是否允许 H5 邮箱/Google 用户绑定 TikTok 用户并迁移资产。 |
| D-05 | 首批内容 | 待确认 | 选 1～3 部有完整版权、封面、英文字幕的剧用于首轮联调和审核。 |

## 2. 平台后台前置（不是代码，但会阻塞开发/发布）

已完成：企业认证、行业资质认证。

- [ ] OPS-00：确认 TikTok 开发者权限：应用必须归公司 Organization；至少保留 2 名 Organization Admin；前端/后端/运营成员加入 Organization 并能访问该应用。需要修改成员、应用、密钥、营收或提交审核的账号使用 Admin；仅开发联调可使用 Member。不要共享 TikTok 开发者账号。
- [ ] OPS-01：提交“基本信息”：图标、名称、描述、条款 URL、隐私 URL、服务域名、Apple Team ID、联系邮箱、版权自检与首发地区。
- [ ] OPS-02：在“开发配置 → Security”登记所有请求域名（API、静态资源/CDN、WebSocket 如有）。
- [ ] OPS-03：从 Credentials 取得 `Client Key`；`Client Secret` 仅保存到后端密钥系统，**不得写入仓库、`.env` 前端变量或聊天记录**。
- [ ] OPS-04：激活并绑定 BytePlus 媒体资产管理；准备 AccessKey/SecretKey 给后端密钥系统。
- [ ] OPS-05：按 D-03 在“营收”启用 IAP/IAA 并签署协议。
- [ ] OPS-06：把测试 TikTok 账号加入 Test Users；iOS 预览需要上传包后扫码。
- [ ] OPS-07：按 D-02 添加后台本地化信息。英语默认存在；每增加一种语言，都要补应用名、描述、条款 URL、隐私 URL 与分享素材。

## 3. 代码任务总览

状态：`未开始` / `进行中` / `已完成` / `阻塞`

| 任务 | 类型 | 状态 | 依赖 | 产出 |
| --- | --- | --- | --- | --- |
| DEV-01 | 前端 | 已完成 | 无 | TikTok 独立构建入口、CLI 配置、类型声明 |
| DEV-02 | 前端 | 已完成 | DEV-01 | 平台适配层与 Web 默认实现 |
| BE-01 | 后端 | 未开始 | OPS-03 | TikTok 静默登录换 token、用户映射接口 |
| DEV-03 | 前端 | 未开始 | DEV-01、BE-01 | `TTMinis.login()` 登录接入 |
| BE-02 | 后端/内容 | 未开始 | OPS-04、D-05 | 剧/集/视频 ID 映射和播放数据接口 |
| DEV-04 | 前端 | 未开始 | DEV-02、BE-02 | VePlayer 播放器适配和进度上报 |
| BE-03 | 后端 | 未开始 | OPS-05 | IAP/IAA 订单、回调验签、权益发放 |
| DEV-05 | 前端 | 未开始 | DEV-02、BE-03 | TikTok 支付/广告解锁 UI |
| DEV-06 | 前端 | 未开始 | D-02、DEV-04 | TikTok 版文案、协议、错误页及平台限制处理 |
| QA-01 | 联调 | 未开始 | DEV-03～06 | 真机测试矩阵与问题修复 |
| REL-01 | 发布 | 未开始 | QA-01、OPS-01～07 | 上传、预览、审核、上线 |

---

## 4. 逐项开发任务

### DEV-01：建立 TikTok 构建基础

**目的**：让同一仓库可单独产出 TikTok Minis 包，且原有 `npm run build:*` 行为不变。

**前端工作**

- [ ] 安装并固定 `tiktok-minis-cli` 的开发依赖或明确全局 CLI 版本。
- [ ] 添加 `minis.config.json`，配置 Vite 开发端口、构建产物目录和 HTML 入口。
- [ ] 增加 `build:tiktok`、`dev:tiktok`、`minis:package` 脚本；不复用当前会清理外部目录的生产脚本。
- [ ] 新增 `VITE_PLATFORM=web|tiktok` 环境区分；默认仍是 `web`。
- [ ] 为 `window.TTMinis` 建立 TypeScript 声明，未在 TikTok 内运行时不能导致页面崩溃。
- [ ] 增加 TikTok 构建自检：构建包内不包含前端密钥、私钥或 Web 支付密钥。

**验收**

```powershell
npm run build:tiktok
```

- 成功得到 Minis CLI 可上传的包。
- `npm run build:prod` 与本地 H5 仍可正常构建。
- 在普通浏览器访问 TikTok 构建产物时，只出现受控的开发提示，不因 `TTMinis` 缺失报错。

**本地使用方式**

```powershell
Copy-Item .env.tiktok.example .env.tiktok.local
# 在 .env.tiktok.local 填入 VITE_TIKTOK_MINIS_CLIENT_KEY（Client Key 不是 Client Secret）
npm run dev:tiktok
# 另开一个终端：npm run minis:dev -- --client-key <同一个 Client Key>
```

**需要你提供**：当前构建不需要。真机 TikTok 调试前，需要 OPS-03 提供 Client Key 和 OPS-06 配置测试用户。

---

### DEV-02：建立最小平台适配层

**目的**：以后新增 H5 功能默认两端共用，只有平台 API 被隔离；本任务不迁移、不重写现有 H5 业务代码。

**前端工作**

- [x] 新建 `src/platform/`，定义统一接口：`auth`、`payment`、`player`、`lifecycle`、`navigation`。
- [x] 新建 `src/platform/web/`，只定义对现有 Web 实现的引用边界，不移动原有登录、支付、播放器代码。
- [x] 新建 `src/platform/tiktok/`，所有新增 `window.TTMinis` 调用只在此目录出现。
- [x] 提供单一的 `getPlatform()` 入口，并以 TypeScript 构建作最小验证。
- [x] 列出后续替换点：PayPal/Airwallex（`widgets/`、`pages/user/RadixRc*`）、XGPlayer/原生 video（`components/douyin-feed-player`、`pages/user/VDemo`、`pages/user/ForDemo`）、Google/Firebase 登录（`pages/user/Login.tsx`）。

**验收**

- [x] Web H5 的登录、播放、付款入口行为不变；原有 `main.tsx` 和既有 `build:*` 脚本不修改。
- [x] 新页面接平台能力时只从统一入口导入，不直接读取 `window.TTMinis`。

**需要你提供**：无。

---

### BE-01：TikTok 静默登录与用户映射

**目的**：将 TikTok 身份安全地映射到现有站内用户与 JWT。

**后端工作**

- [ ] 新增 `POST /auth/tiktok/minis/login`：接收前端的临时 `code`。
- [ ] 服务端调用 TikTok OAuth token 接口；`client_secret` 只在服务端使用。
- [ ] 以 `open_id` 建立 TikTok 身份表，并关联现有用户表。
- [ ] 返回与现有 H5 兼容的本站 access token / 用户资料。
- [ ] 处理 code 重放、token 刷新、错误码、审计日志与幂等性。
- [ ] 若 D-04 为“是”，增加登录后绑定旧 H5 账户的安全流程；不自动合并两个账户。

**验收**

- 同一 TikTok 用户多次登录得到同一站内用户。
- 后端日志与数据库均不存储明文 `client_secret`。
- 失败时前端可显示可理解的错误并允许重试。

**需要你提供**：后端项目位置/负责人；OPS-03 完成后的密钥安全配置方式。

---

### DEV-03：接入 TTMinis 初始化和静默登录

**目的**：在 TikTok 容器中无感登录；普通 H5 不改变原有登录流程。

**前端工作**

- [ ] 在 TikTok 构建入口加载 `https://connect.tiktok-minis.com/drama/sdk.js`，使用 `Client Key` 初始化。
- [ ] 应用启动时调用 `TTMinis.login()`，将 code 发送给 BE-01。
- [ ] 写入现有用户 store 与 token 存储；处理启动时序、超时、取消和重复调用。
- [ ] TikTok 版隐藏/替换默认邮箱、Google 等首选登录入口；若做 D-04，仅在“绑定已有账户”页展示。
- [ ] 用测试用户在 TikTok 真机环境验证首次登录、重启、退出后重登。

**验收**

- TikTok 内启动后不出现不必要的登录弹窗，且用户、进度、资产可稳定识别。
- Web H5 匿名/已有登录流程无回归。

**需要你提供**：OPS-03 的 `Client Key`；BE-01 已部署测试环境。

---

### BE-02：媒体资产与播放数据服务

**目的**：让审核上架的剧集可通过 TikTok 的播放管控播放。

**后端/内容工作**

- [ ] 将首批剧集上传/同步到 BytePlus，并通过 TikTok 媒体资产审核与上架。
- [ ] 保存本站剧集与 TikTok `album_id`、`episode_id`、BytePlus `vid` 的映射。
- [ ] 新增 TikTok 专用播放数据接口：只对已登录、有权限且已上架剧集返回播放参数。
- [ ] 按需生成短期播放凭证；不可把长期播放密钥返回浏览器。
- [ ] 上传英文字幕；若 D-02 含其他语言，同步上传相应字幕。
- [ ] 保留现有 H5 视频地址接口，不能因 TikTok 改造而中断原站播放。

**验收**

- 无权限或未上架内容不能被 TikTok 播放。
- 已上架的测试剧集能返回完整播放数据且凭证过期后可刷新。

**需要你提供**：OPS-04、首批可用且有版权的剧集与字幕。

---

### DEV-04：VePlayer 播放器适配

**目的**：替换 TikTok 版播放链路，同时尽可能保留现有剧集切换和进度业务。

**前端工作**

- [ ] 实现 `TikTokVePlayerAdapter`：通过 `TTMinis.getPlayer()` 创建、销毁与控制 VePlayer。
- [ ] 将现有 `VDemo`、`ForDemo` 的数据层与播放器视图层拆开；Web 继续走 XGPlayer，TikTok 走 VePlayer。
- [ ] 接入播放/暂停、续播、完播自动下一集、切集、异常重试和销毁。
- [ ] 上报既有观看进度，并适配 VePlayer 的事件模型。
- [ ] 启用自动字幕；TikTok 版不直接使用原 MP4/HLS URL。
- [ ] 验证竖屏、横屏、返回前台、网络切换和连续切集。

**验收**

- TikTok 容器中不出现平台的“禁止使用第三方播放器”拦截页。
- H5 仍使用原播放器并无回归。
- 首批剧集可播放、续播、切集和显示字幕。

**需要你提供**：BE-02 测试接口与可播放测试剧集。

---

### BE-03 / DEV-05：变现能力

**目的**：TikTok 内支付或广告解锁正确发放权益；H5 收银台保持原状。

**BE-03 后端工作**

- [ ] IAP：商品/SKU 映射、创建订单、支付回调验签、幂等发放、查单与补单。
- [ ] IAA：广告完成后的服务端权益发放和防重复领取。
- [ ] 增加 TikTok 订单账本，区分平台、币种、商品、用户、状态和原始回调。

**DEV-05 前端工作**

- [ ] TikTok 版支付页改用 `TTMinis.pay`，不加载 PayPal/Airwallex 组件。
- [ ] 若启用广告，接奖励广告展示、完成回调、失败/关闭提示和权益刷新。
- [ ] Web 版继续使用原支付 UI；两个平台共用商品与权益展示规则。

**验收**

- 成功、取消、重复回调、网络中断均不会重复发货或漏发。
- TikTok 内无第三方 Web 支付跳转。

**需要你提供**：D-03 与 OPS-05 完成。

---

### DEV-06：TikTok 版体验与本地化收口

**目的**：避免把 Web/PWA 特性错误地带入 TikTok 容器，并完成首发语言体验。

**前端工作**

- [ ] TikTok 版关闭 PWA 安装提示、浏览器下载/外跳、Web 收银台、Google 首选登录等不适用入口。
- [ ] 接 TikTok 生命周期与返回/导航栏能力，避免页面前后台切换后播放状态错误。
- [ ] 补齐 D-02 的应用内文案、空态、错误提示、支付与登录提示。
- [ ] 确保协议链接、用户举报/反馈与联系入口可用。
- [ ] 检查名称、封面、剧集简介、营销文案不触犯内容要求。

**验收**

- 首发语言下无明显未翻译字符串、错误链接或 Web 专属入口。
- 从 TikTok 打开、返回、切后台再恢复均可用。

---

### QA-01：真机联调与发布

**工作**

- [ ] Android 测试客户端：登录、播放、续播、切集、字幕、支付/广告、收藏、进度。
- [ ] iOS：上传预览包后扫码测试相同路径。
- [ ] 弱网、断网、重启、版本更新、订单回调重复测试。
- [ ] 运行 `minis build`，确认上传包大小和扫描结果。
- [ ] 在开发者平台上传、预览并提交审核。

**验收**

- 所有 P0 路径通过；无密钥泄漏、无第三方播放器拦截、无支付权益错误。

## 5. 当前下一步

从 **DEV-01：建立 TikTok 构建基础** 开始。该任务不需要 Client Secret、BytePlus 或后端改动，可以先完成并保持现有 H5 可用。

当需要凭据时：只提供 `Client Key` 给前端；`Client Secret`、BytePlus AccessKey/SecretKey 只由后端安全配置，不能提交到 Git。
