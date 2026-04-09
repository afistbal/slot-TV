# 登录逻辑梳理（前端）

> 目标：定位本项目所有登录方式、`client_id` 参数来源/传递位置、游客登录与其他登录差异、以及登录后信息存储位置，便于后续安全与业务分析。

## 1. API 请求封装与鉴权头

### 1.1 统一请求入口
- **文件**：`src/api.ts`
- **函数**：`api(path, options)`
- **关键点**：
  - 通过 `ky` 发起请求
  - `Authorization` 头固定读取 `localStorage.getItem('token')` 并拼为 `Bearer <token>`
  - 还会带上 `Accept-Language`、`X-Platform`、`X-OS`、`X-Test`、`X-Source` 等自定义头

### 1.2 API 域名 / 前缀
- 当前代码里 `prefixUrl` 被写死为：`http://43.128.30.50:8080/api`
  - 这会导致在本地开发（如 `http://localhost:5174`）时直接跨域访问后端，从而触发 **CORS 预检失败**。
- 项目同时存在 Vite 代理配置（`vite.config.ts`）：
  - `/api` 代理目标默认是 `http://127.0.0.1:8000`
  - 但如果前端代码使用“完整后端域名”，则 **不会走代理**。

## 2. 登录方式总览（有哪些登录）

前端可见的登录/鉴权路径主要有 4 类：

1. **Token 登录（自动登录）**
   - **触发点**：`src/App.tsx` 启动初始化 `loadData()`
   - **接口**：`POST login/token`
   - **用途**：当 URL query 有 `_token` 或本地 `localStorage` 有 `token` 时，走 token 校验并恢复登录态

2. **游客/匿名登录（自动或手动触发）**
   - **触发点 A**：`src/App.tsx` 初始化时没有 token
   - **触发点 B**：`src/pages/user/Login.tsx` 的 “logout/切换账号”逻辑里，非 Flutter 环境会调用
   - **接口**：`GET login/anonymous`（代码未显式写 method，默认 get）
   - **用途**：为未登录用户创建匿名身份，并返回 token + info

3. **邮箱验证码登录**
   - **页面**：`src/pages/user/Login.tsx`
   - **发送验证码接口**：`POST login/email/code`
   - **登录接口**：`POST login/email`（参数：`email`、`code`）
   - **登录成功后**：
     - `localStorage.setItem('token', <token>)`
     - `localStorage.setItem('email', <email>)`
     - `localStorage.setItem('login-method', 'email')`
     - `useUserStore().signin(info)`

4. **Google 登录（两种运行环境分支）**
   - **页面**：`src/pages/user/Login.tsx`
   - **分支 A（Flutter InAppWebView 环境）**
     - 先调用 `window.flutter_inappwebview.callHandler('googleSignin')`
     - 再通过 `currentUser` 拿到 `{uid, avatar, email, name, anonymous}`
     - **接口**：`POST login/uid`（至少上传 `uid`）
     - 之后把后端返回的 `info` 覆写/补齐为 flutter 侧的头像、邮箱、用户名、匿名标志
   - **分支 B（纯 Web 环境）**
     - 使用 Firebase `signInWithPopup(auth, new GoogleAuthProvider())`
     - 拿到 `result.user.uid` 等信息
     - **接口**：`POST login/uid`（参数包含：`uid`、`anonymous`、`name`、`email`、`provider: 'google'`）

## 3. 游客登录 vs 其他登录（核心差异）

### 3.1 接口差异
- **游客**：`login/anonymous`
- **邮箱**：`login/email/code` + `login/email`
- **Google**：Firebase/Flutter 侧完成第三方认证后，再由后端 `login/uid` 换取业务 token
- **Token 恢复**：`login/token`（本地已持有 token 的情况下）

### 3.2 登录态差异标识
- 用户信息对象里存在 `anonymous` 字段（代码里以 `1/0` 判断）：
  - `useUserStore().isAnonymous()` 判断条件：`signed && info['anonymous'] === 1`
- UI 层也用 `anonymous !== 1` 来区分是否展示“账号信息”还是“登录页”。

## 4. 登录后信息存哪里（持久化与内存态）

### 4.1 localStorage（持久化）
已发现的关键键：
- `token`：业务鉴权 token（所有 API 调用会从这里读并放进 `Authorization: Bearer ...`）
- `login-method`：记录登录方式（当前可见：`email`、`google`）
- `email`：邮箱登录后写入
- 其他与登录相关的追踪/来源：
  - `test`、`source`：在 `App.tsx` 启动时从 query 参数 `_t` / `s` 写入
  - `locale`：语言设置

### 4.2 Zustand Store（内存态）
- **文件**：`src/stores/user.ts`
- **字段**：
  - `signed: boolean`：是否已登录（包括匿名）
  - `info?: Record<string, unknown>`：用户信息对象（结构由后端返回决定）
  - `balance: number`：余额
- **写入点**：
  - 登录成功后调用 `userStore.signin(info)`
  - 退出时 `userStore.signout()`

> 注意：目前“用户信息”主要存在 Zustand store 的 `info` 内存态里；刷新页面后需要靠 `localStorage.token` 通过 `login/token` 恢复。

## 5. 初始化流程（启动时如何决定登录态）

### 5.1 配置加载
- `App.tsx` 启动会先请求 `GET config` 并写入 `configStore.setConfig(config.d)`

### 5.2 登录态恢复 / 自动游客
在 `App.tsx` 的 `loadData()`：
- 优先取 `URLSearchParams` 的 `_token`，否则取 `localStorage.token`
- 若存在 token：
  - `POST login/token` 校验 token
  - 成功后 `localStorage.setItem('token', token)` + `userStore.signin(result.d)`
- 若不存在 token：
  - `GET login/anonymous`
  - 成功后 `localStorage.setItem('token', result.d['token'])` + `userStore.signin(result.d['info'])`

## 6. `client_id` 参数在哪？

### 6.1 前端代码中未发现 `client_id`
在 `src/**/*` 范围内未检索到显式的 `client_id`（包括 `clientId`）。

### 6.2 已发现相近的支付参数：`client_secret`
项目支付流程（Airwallex）会使用后端返回的 `client_secret`：
- `src/widgets/Vip.tsx`
- `src/widgets/Coin.tsx`
- `src/widgets/UnlockEpisode.tsx`
- `src/pages/user/Airwallex.tsx`

> 结论：如果你说的 `client_id` 是 OAuth/第三方登录用的 `client_id`，它可能：
> - 不在前端写死（由后端 `config` 接口下发），或
> - 存在于 Flutter/App 原生侧（`flutter_inappwebview.callHandler(...)` 的宿主实现里），或
> - 位于本仓库之外（例如后端项目/配置中心/CI 环境变量）。

## 7. 建议你重点核对的风险点（便于后续分析）

- **Token 存储**：`localStorage` 可被 XSS 读取，风险较高（如果业务安全要求高，建议改 httpOnly cookie 或增加防护）。
- **匿名账号升级**：目前看到匿名与实名的差异主要是 `anonymous` 标志与不同接口；需要后端确认“匿名转正”策略。
- **`login/uid` 信任边界**：Web 分支带 `provider: 'google'` 等字段，但真正可信的是后端对 Firebase/第三方 token 的校验方式（前端只上传 uid 的分支尤其需要关注后端校验）。

---

## 8. 相关文件索引（快速跳转）

- API 封装：`src/api.ts`
- App 启动登录恢复：`src/App.tsx`
- 登录页与登录动作：`src/pages/user/Login.tsx`
- 用户 store：`src/stores/user.ts`
- 配置 store：`src/stores/config.ts`
- Vite 代理：`vite.config.ts`

