# 视频页挽留弹窗 v2（需求说明）

> 与第一版 `video-paywall/*` **完全独立**，不要复用/改第一版逻辑。  
> 原则：**少改文件、少写代码**——能 1 个模块搞定就不要拆 18 个文件。

---

## 目标

用户关闭 VIP 购物抽屉后，弹出 **3 档挽留半屏弹窗**；点 CTA 或第三档倒计时结束 → 打开 **支付面板**（VIP 抽屉 / PC 弹窗 + RadixRc 收银）。

---

## 触发与流程

```
关闭 VIP 抽屉（点 X / 下滑）
  → 约 320ms 后弹窗 1
  → 关闭弹窗 1 → 弹窗 2
  → 关闭弹窗 2 → 弹窗 3
  → 关闭弹窗 3 / CTA / 倒计时结束 → 开 VIP 抽屉 + 支付面板
```

- 已是 VIP：关抽屉即可，**不出挽留**。
- 挽留进行中：`VideoPlayerVipCommerce` 的 `locked` **不要**再自动弹 VIP 抽屉。

---

## 三档内容（mock，接口字段后接）

| 档 | 折扣 | 价 | 续费 | 特殊 |
|----|------|-----|------|------|
| 1 | 30% | $13.99/周 | $19.99/周 | — |
| 2 | 50% | $9.99/周 | $19.99/周 | — |
| 3 | 50% | $49.99/90天 | $99.99 | 30s 倒计时；CTA/倒计时 → 收银默认

底部固定 **5 个** VIP 短剧封面，接口 `feed/membership?page=1` 取前 5，**不轮播**。

第三档用户若从支付页返回且已跳过倒计时：sessionStorage 记一次，下次第三档**不显示倒计时**。

---

## UI

### 共性（三档同一套壳，只换文案/数字）

- 遮罩 + 半屏 sheet
- 标题区 + 优惠卡片 + 法律文案 + CTA + 短剧行
- **三档都要有右上角 X**（H5 / PC 一致），点 X = 进下一档（与点遮罩同逻辑）
- **不要**底部 `fabClose` 圆钮

### H5

- 自底部滑入，`min-height` 约 64vh
- 整块 dialog 带动画

### PC

- 居中 scale 弹窗

### 样式

- 单独 scss：`src/styles/video-retention-promo.scss`（`main.tsx` 已引入即可）
- 前缀：`rs-retention-promo__*`

### i18n

- 文案 key 前缀 `retention_promo_*`，先英文 `en.json` 即可

---

## 收银接线

CTA / 第三档倒计时 / 关第三档 →：

1. 关挽留弹窗  
2. `onVipOpenChange(true)` 开 VIP 容器  
3. RadixRc 收到 `checkoutRequest` → `handleSelectPlan` → ~500ms 后 `showPayModal`  
4. 第三档：`initialCheckoutPayment = 3`

商品 ID：从 `videoShoppingProducts`（`product` 接口 `from=video`）按档位匹配周卡 / 90天；**匹配不到也要开抽屉**，DEV 打 warn 即可。

**注意竞态**：`setStep(null)` 与 `setVip(true)` 不要分两帧导致 locked 逻辑把抽屉关掉；收银请求与开抽屉要么原子更新，要么先开抽屉再写 checkout。

---

## 接入点（仅 4 处 Commerce + 2 处必改）

### 必接 Commerce（H5/PC × video/foryou）

- `VideoPlayerH5CommerceDrawers.tsx`
- `VideoPlayerPcCommerceDialogs.tsx`
- `ForYouPlayerH5CommerceDrawers.tsx`
- `ForYouPlayerPcCommerceDialogs.tsx`

每处：RadixRc 传 `onEmbedClose` / `checkoutRequest` / `onPayModalClosed` / `initialCheckoutPayment`；旁边渲染挽留 Layer。

关闭 VIP 抽屉走现有 `useVideoPanelCloseGuard`，拦截后触发挽留。

### 必改（小改）

- `VideoPlayerVipCommerce.tsx`：`promoStep` 或 `checkoutRequest` 存在时，跳过 `locked` 自动开抽屉  
- `RadixRc.tsx`：支持上述 4 个 props（若基线没有则补上）

### 不要动

- 第一版 `video-paywall/*`（未接线可保持不动）
- douyin-feed 播放器 STALL 日志（无关）

---

## 推荐文件结构（上限）

```
src/components/video-retention-promo/
  VideoRetentionPromo.tsx    # UI + hook + store，对外一个 import
  video-retention-promo.scss   # 或放 styles/ 下
```

外部只引：

```ts
import { useVideoRetentionCommerce, VideoRetentionPromoLayer, useRetentionPromoStore } from '@/components/video-retention-promo/VideoRetentionPromo';
```

**禁止**：types / storage / fetch / resolve / commerce hook 各拆一文件，除非单文件超 400 行实在放不下。

---

## 验收

1. 关 VIP 抽屉 → **无需再点屏幕**，弹窗 1 自动滑上  
2. 三档右上角都有 X，**无**底部 fabClose  
3. 弹窗 2 点「Get $9.99 on sale」→ H5 抽屉 / PC 弹窗 + 支付面板  
4. 弹窗 3 倒计时结束 → 同上，默认银行卡  
5. 挽留过程中 locked 不会抢弹 VIP 抽屉  
6. 底部 5 张短剧封面展示  

---

## 给 Agent 的硬约束

- **最小 diff**：优先改/增 1～2 个文件，Commerce 里各加几行接线  
- **三档共用一个组件**，用 `step` 切换文案，不要写 3 个弹窗组件  
- **不要**新建独立 zustand store 文件（状态放模块内即可）  
- **不要**改 RadixRc / VipCommerce 大段逻辑，只加必要 guard 和 props  
- 动画开 class 用 `setTimeout(20)`，不要单靠一帧 `rAF`（否则 H5 首帧不滑入）  
- 写完自测上面 6 条，不要堆 debug 日志
