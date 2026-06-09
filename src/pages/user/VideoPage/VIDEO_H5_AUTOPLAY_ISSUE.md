# `/video` H5 冷启动自动播放 & 蒙层问题分析

> **目的**：供下一个 agent **一次性**修复，避免「修 H5 F5 坏 ForYou 跳转 / 修 ForYou 跳转坏 H5 F5」的循环。
>
> **参考金标准**：`/foryou` 已稳定，逻辑以 `ForYouPage/foryouAutoplayPolicy.ts` + `foryouPlaybackKick.ts` + `ForYouPlayer.tsx` 为准，**复制思路到 Video 独立文件**，不要改 ForYou。
>
> **测试环境**：`npm run prod` → `http://localhost:5173`  
> **典型 URL**：`/video/1270/2`  
> **H5 模拟**：DevTools → iPhone SE（375×667）

---

## 一、现象（2026-06 联调）

| 场景 | PC（≥768px） | H5（<768px） |
|------|-------------|-------------|
| **F5 刷新** `/video/1270/2` | ✅ 静音自动播放 + 「Click to unmute」蒙层 | ❌ **暂停在 00:00**，大播放按钮，音量图标**未静音**，**无蒙层** |
| **For You → Watch Full Series** 进 `/video` | ✅ 有声、无蒙层 | 历史多次回归：有时仍静音+蒙层 |
| **F5 video → 回 foryou → 再进 video** | 需回归 | 需回归 |
| **竖滑切下一集** | ✅ 有声 | 需回归 |

用户原话：**PC F5 有蒙层静音播放逻辑，H5 就是暂停**；多次 patch 后「改好一个坏了另一个」。

---

## 二、期望行为矩阵（与 For You 对齐）

| # | 进入方式 | 首条自动播 | 蒙层 |
|---|----------|-----------|------|
| 1 | **F5 / 刷新** 落在 `/video/:id/:ep` | 静音 | 有（Click to unmute） |
| 2 | **站内跳转**（For You / 首页 / 搜索，带 `VIDEO_FROM_HOME_STATE` 或 `fromForYouPlayback`） | **有声** | **无** |
| 3 | **新标签直开** `/video/...`（无 history 栈） | 静音 | 有 |
| 4 | **竖滑切集**（非首条 load） | 有声 | 无 |
| 5 | PC 滚轮/键盘/分集按钮切集 | 有声 | 无 |

**核心原则**：冷启动判定必须在 **Swiper 首次 mount 时一次性固化**，后续 SPA 路由、StrictMode remount、loadData 二次执行都不得再误判。

---

## 三、架构：PC 与 H5 走不同起播路径（根因 #1）

同一 `VideoPlayer.loadData` → `runLoadEpisodeForPlayer`，但在 `videoPlayerLoadEpisode.ts` 内 **H5 竖滑提前 return**：

```
videoPlayerLoadEpisode.ts
├── h5VerticalPlayback === true（VideoSeriesVerticalSwiper 传 `!isDesktop`）
│   └── L248-253: kickVideoAutoplayForPlatform() → **立即 return**
│       ├── isVideoIosPlayback() → kickVideoIosAutoplay（videoIosPlayback.ts）
│       └── 否则 → kickVideoAutoplay（videoPlaybackKick.ts）
│
└── PC（h5Vertical === false）
    └── L256+: resolveVideoAllowSoundAutoplay + 冷启动 **300ms delay** + 内联 play 逻辑
```

| | PC F5 冷启动 | H5 F5 冷启动 |
|--|-------------|-------------|
| 代码路径 | `videoPlayerLoadEpisode` 下方 PC 分支 | `h5Vertical` early return → `kickVideoAutoplayForPlatform` |
| 冷启动 delay | `300ms`（`kickVideoAutoplay` L184） | **0ms** |
| iOS 专用 | 不走 `videoIosPlayback` | DevTools iPhone / 真机 Safari 走 **`kickVideoIosAutoplay`** |
| 蒙层 state | `setShowTapToUnmute`（kick 内）+ `videoColdUnmuteOverlay`（loadData） | 仅 `videoColdUnmuteOverlay`（loadData），**kick 不设 H5 蒙层** |

**结论**：PC 正常 ≠ H5 逻辑相同；修 PC 分支不会自动修好 H5，反之亦然。必须 **H5 / iOS H5 / PC 三条路径分别验收**。

---

## 四、For You 金标准 vs Video 当前差距

### 4.1 策略层（autoplay policy）

| | For You ✅ | Video ❌/⚠️ |
|--|-----------|------------|
| F5 标记 | 模块 init：`sessionStorage.setItem('foryou-reload-landing')` | 模块 init + `isReloadLandingOnVideoUrl()` + **`videoReloadLandingResolved` 缓存** + **`videoColdStartUsedThisDocument`** |
| mount 消费 | `consumeForyouReloadLanding()` **简单读删 sessionStorage** | `resolveReloadLandingOnce()` 多层缓存 |
| fromHome | `reloadLanding ? false : resolveFromHome(state)` | 同结构，但依赖上面复杂 resolve |
| 二次 reload 判定 | **无** `isDocumentReload()` 在 resolve 时 | 曾用 `isDocumentReload()` 作 mount 兜底 → SPA 进 video 误判冷启动（已去掉，但 H5 F5 又可能漏判） |

**For You 文件**：`src/pages/user/ForYouPage/foryouAutoplayPolicy.ts`  
**Video 文件**：`src/pages/user/VideoPage/videoAutoplayPolicy.ts`

### 4.2 起播 kick

| | For You | Video |
|--|---------|-------|
| 通用 kick | `foryouPlaybackKick.kickForyouAutoplay` | `videoPlaybackKick.kickVideoAutoplay`（已对标） |
| iOS kick | `foryouIosPlayback.kickForyouIosAutoplay` | `videoIosPlayback.kickVideoIosAutoplay` |
| preferSound | `!isFeedColdAutoplay \|\| (H5 && sessionUnmuted && !cold)` | 类似，但 H5 非 cold 时 `resolveVideoAllowSoundAutoplay` 对 `!isPcViewport` **恒 true**（L153-154） |

### 4.3 iOS loadData 集成（关键缺失）

For You **已接入**，Video **未接入**：

| 函数 | For You | Video |
|------|---------|-------|
| `prime*IosLoadDataVideo` | `ForYouPlayer.loadData` L605 调用 | **`VideoPlayer.loadData` 无调用**（函数已在 `videoIosPlayback.ts` L286 存在） |
| `bind*IosPlayRetry` | `ForYouPlayer` useEffect L1277-1286 | **`VideoPlayer` 无对应 effect**（函数已在 `videoIosPlayback.ts` L309 存在） |

For You 在 fetch 完成**前**就对 iOS video 做 `ensureLoad` + cold 时 `muted=true` + early play；Video 缺这一步，iOS H5 F5 极易 `play()` 失败 → 暂停 + 大播放按钮。

### 4.4 H5 蒙层

```ts
// VideoPlayer.tsx L263-271
showH5FullscreenUnmuteOverlay =
  videoColdUnmuteOverlay && videoMutedUi && ... && (playing || canPlay)
```

蒙层前置条件：

1. `loadData` 内 `isVideoColdAutoplay === true` → `setVideoColdUnmuteOverlay(true)` + `setVideoMutedUi(true)`
2. 视频实际 **playing 或 canPlay**

若起播失败（paused @ 00:00），即使用户看到 `canPlay=true`，若 `videoMutedUi=false`（误判非冷启动先试有声）→ **无蒙层**，与截图一致。

---

## 五、根因分析（按优先级）

### 5.1 冷启动标志 `isVideoColdAutoplay` 可能为 false（策略层）

`VideoPlayer.resolveVideoColdAutoplay()`（L130-135）：

```ts
Boolean(isVerticalSeriesPlayer && !fromHomeVideoPlayback && videoColdAutoplayRef?.current)
```

**问题 A**：只读 `videoColdAutoplayRef.current`，不读 mount 时固化的 `reloadLanding`。  
`loadData` 结束会把 `videoColdAutoplayRef.current = false`（L494-496）。若 StrictMode / 双次 loadData，第二次 cold=false。

**问题 B**：F5 时若 `reloadLanding=false`，则：

- `resolveVideoFromHomeVideoPlayback` 可能因 `canNavigateBack()`（`history.state.idx > 0`）→ `fromHome=true`
- 或 browser **restore 旧 `location.state`**（含 `fromHomeVideoPlayback: true`）
- → `videoColdAutoplay=false` → H5 **先试有声** → 浏览器拦截 → `onPlayFail` → **暂停 + 未静音 UI + 无蒙层**

**问题 C**：`videoAutoplayPolicy` 的 `resolveReloadLandingOnce` 与 For You 的 `consumeForyouReloadLanding` 行为不一致；额外 module 变量是为修「F5 foryou → SPA video 误判冷启动」加的，但与「F5 直落 video」的 H5 起播存在张力。

### 5.2 iOS H5 `playWithOptionalMuteFallback` 冷启动无 retry（起播层）

`videoIosPlayback.ts` L137-170：

```ts
// preferSoundAutoplay=false 且已 muted=true（冷启动）时：
v.play().catch → 直接 onPlayFail()  // 无 muted retry
```

对比 `kickVideoAutoplay`（Android/非 iOS）：冷启动先 `muted=true` 再 play，有声失败会 fallback muted。  
iOS 冷启动 muted play 若仍失败（常见：source 未 ready），直接 fail → **00:00 暂停**。

`shouldIosBlockMuteFallback(isColdAutoplay, wasSwipe)`：冷启动 `block=false`，但 cold 分支在 `playWithOptionalMuteFallback` 里**不会进入**有声 fallback 逻辑。

### 5.3 VideoPlayer 未集成 iOS prime / playRetry（接入层）

`VIDEO_REQUIREMENTS.md` F3 已列出接入点，但 **`VideoPlayer.tsx` 未实现**（grep 仅 `videoIosPlayback.ts` 有定义）。

For You 对标代码：

- `ForYouPlayer.tsx` L599-610：`primeForyouIosLoadDataVideo` 在 `runLoadEpisode` 之前
- `ForYouPlayer.tsx` L1271-1286：`bindForyouIosPlayRetry` + `iosWantPlayRef`

### 5.4 DevTools iPhone 走 iOS 分支

`isVideoIosPlayback()` = `isIosLikeDevice()`（UA 含 iPhone/iPad）。  
Chrome DevTools 模拟 iPhone SE → **走 iOS kick**，不是 Android `kickVideoAutoplay`。  
测 H5 时必须区分：**模拟 iPhone = iOS 路径**；真 Android = 另一路径。

### 5.5 「修一个坏一个」的历史模式

| 改动 | 修好 | 弄坏 |
|------|------|------|
| module 级 `cachedVideoReloadLanding` | H5 F5 识别 | ForYou→video SPA 仍 cold |
| mount 兜底 `isDocumentReload()` | 部分 F5 | F5 后 SPA 进 video 仍 reload=true |
| `isReloadLandingOnVideoUrl()` + `videoColdStartUsedThisDocument` | SPA 误判缓解 | H5 F5 若 session/entry 竞态仍 fail |
| 去掉 PC 蒙层对 `isReload` 依赖 | PC SPA 不误蒙层 | 与 H5 无关 |
| 只改 `videoPlaybackKick` | Android H5 | iOS H5 仍缺 prime/retry |

**教训**：不要在 `resolveVideoMountAutoplayFlags` 里叠加新的全局 flag；应 **1:1 对齐 For You 最小模型**，仅用「模块 init sessionStorage + navigation entry 初始 URL（video 特有，forYou 不需要）+ mount 一次性 consume」。

---

## 六、用户截图对应的状态机（H5 F5 失败态）

```
reloadLanding 漏判 或 videoColdAutoplayRef 已 false
  → isVideoColdAutoplay = false
  → preferSoundAutoplay = true（H5）
  → el.muted = false, setVideoMutedUi(false)
  → setVideoColdUnmuteOverlay(false)
  → play() 被浏览器拒绝
  → onPlayFail: setCanPlay(true), setPlaying(false)
  → UI: 大播放按钮 + 音量「开」+ 无蒙层 + 00:00
```

PC 成功态：

```
reloadLanding = true
  → isVideoColdAutoplay = true
  → PC 分支 muted=true + 300ms delay + setShowTapToUnmute
  → play 成功 → 蒙层 + 静音播放
```

---

## 七、推荐修复方案（实施顺序）

> **禁止**：在不动回归矩阵的情况下再加零散 flag。  
> **必须**：改完跑 **第七节末尾完整矩阵**（H5 + PC）。

### Step 1 — 策略层简化并对齐 For You

**文件**：`videoAutoplayPolicy.ts`

1. mount 时：`reloadLanding = consumeSession() || isReloadLandingOnVideoUrl()`（保留 navigation entry，这是 video 相对 foryou 的合理扩展）
2. **去掉或极简化** `videoReloadLandingResolved` / `videoColdStartUsedThisDocument`，改为：
   - 要么与 For You 完全一致（仅 session consume）
   - 要么 `reloadLanding` 结果 **写入 `mountAutoplayRef` 后不再变**，SPA 再进 video 用 `fromHome` + `!canNavigateBack` 规则，**不要** module 级「本页已用过 cold」影响第二次 mount
3. `reloadLanding === true` 时 **强制** `fromHomeVideoPlayback = false`（已有，保持）
4. 将 `reloadLanding` **作为 prop 传入 VideoPlayer**（或 `mountAutoplayRef`），`resolveVideoColdAutoplay` 改为：

   ```ts
   // 伪代码：首条 load 用 mount 固化值，不依赖会被清空的 ref
   isCold = isVertical && !fromHome && (reloadLanding || videoColdAutoplayRef.current)
   ```

### Step 2 — VideoPlayer 接入 iOS prime + playRetry

**文件**：`VideoPlayer.tsx`（对标 `ForYouPlayer.tsx`）

1. `loadData` 内、`runLoadEpisodeForPlayer` **之前**：
   - `resyncVideoSources` 后调用 `primeVideoIosLoadDataVideo(video, { isColdAutoplay, fromHomeVideoPlayback, onMutedUi })`
2. 新增 useEffect：
   - `iosWantPlayRef` = autoplay policy + episode unlocked
   - `bindVideoIosPlayRetry(video, () => iosWantPlayRef.current)`
3. 条件：`h5VerticalPlayback && isVideoIosPlayback()`

### Step 3 — 修复 iOS 冷启动 play 失败

**文件**：`videoIosPlayback.ts`

`playWithOptionalMuteFallback`：当 `!preferSoundAutoplay && v.muted` 时，失败应：
- `ensureVideoIosVideoLoad(v)` + 延迟 retry（对齐 For You `foryouIosPlayback.ts` 同类逻辑）
- 或 `onPlayFail` 前再 `safeVideoIosPlay(v)` 一次

**禁止**冷启动 muted play 一次失败就直接 `onPlayFail` 留暂停。

### Step 4 — H5 非 iOS（Android）冷启动

**文件**：`videoPlaybackKick.ts`

确认 `kickVideoAutoplay` 在 `isVideoColdAutoplay=true` 时：
- 先 `muted=true` + `onVideoMutedUiSync(true)`
- `loadData` 已 `setVideoColdUnmuteOverlay(true)`
- play fail 走 `fallbackMutedAutoplay`（已有）

可选：H5 cold 是否需要短 delay（PC 有 300ms）——仅在 Android 仍 fail 时加。

### Step 5 — 蒙层条件对齐 For You

**文件**：`VideoPlayer.tsx`

For You H5 蒙层：`foryouColdUnmuteOverlay && videoMutedUi && (playing || canPlay || videoFrameReady)`

Video 当前缺少 `videoFrameReady` 类条件；若 iOS 首帧慢，可加上避免「已 muted 播但蒙层闪一下或不出现」。

H5 蒙层 **不要** 依赖 `hasVideoSessionUserUnmuted()`（For You 也不检查）。

### Step 6 — VideoSeriesVerticalSwiper mount 固化

**文件**：`VideoSeriesVerticalSwiper.tsx`

1. `mountAutoplayRef` 已有；补充传 `reloadLanding` 给 VideoPlayer
2. `resetVideoReloadLandingResolveCache` on unmount：确认不会把 **同文档 F5 后首次 mount** 的 reload 清掉（当前仅 pathname 非 video 时清 cache）
3. 换剧 `params.id` 变化时 `videoColdAutoplayRef` 重置逻辑（L262）使用 `reloadLanding: false` 正确

---

## 八、关键文件清单

| 文件 | 职责 |
|------|------|
| `videoAutoplayPolicy.ts` | F5 / fromHome / cold 策略（**首要修改**） |
| `VideoSeriesVerticalSwiper.tsx` | mount 标志、ref、传 props |
| `VideoPlayer.tsx` | 蒙层 state、loadData、**缺 iOS prime/retry** |
| `videoPlayerLoadEpisode.ts` | H5 early kick vs PC 延迟 play |
| `videoPlaybackKick.ts` | Android / 非 iOS H5 kick |
| `videoIosPlayback.ts` | iOS H5 kick + prime/retry（**函数已有，未接线**） |
| `videoPlayerUtils.ts` | `canNavigateBack`, `isDocumentReload` |
| `foryouAutoplayPolicy.ts` | **只读参考** |
| `foryouPlaybackKick.ts` | **只读参考** |
| `ForYouPlayer.tsx` | **只读参考**（L599-610, L1271-1286, 蒙层） |
| `VIDEO_REQUIREMENTS.md` | 原 F1-F5 清单，F3 与本文重叠 |

---

## 九、回归测试矩阵（全部通过再合）

在 **H5（iPhone SE 模拟）** 和 **PC** 各跑一遍：

- [ ] **T1** F5 `/video/1270/2` → 静音自动播 + 蒙层
- [ ] **T2** `/foryou` → Watch Full Series → `/video/...` → **有声、无蒙层**
- [ ] **T3** T1 后回 foryou → 再 Watch Full Series → 有声、无蒙层、不卡 loading
- [ ] **T4** 首页/搜索带 `VIDEO_FROM_HOME_STATE` 进 video → 有声
- [ ] **T5** 新标签直开 `/video/...` → 静音 + 蒙层
- [ ] **T6** 竖滑切下一集 → 有声、无蒙层
- [ ] **T7** PC 滚轮/键盘切集 → 有声（F1 需求）
- [ ] **T8** For You 任意上述路径 → **无回归**
- [ ] **T9**（可选）真机 iOS Safari + 真 Android Chrome 各测 T1/T2

**失败时记录**：`reloadLanding`、`fromHomeVideoPlayback`、`videoColdAutoplayRef.current`、`isVideoColdAutoplay`（loadData 内）、`el.muted`、`playing`、`canPlay`、`videoColdUnmuteOverlay`（可在 temporarily console 打 log）。

---

## 十、调试建议

1. 在 `resolveVideoMountAutoplayFlags` 返回处 log 一次：`{ reloadLanding, fromHomeVideoPlayback, videoColdAutoplay }`
2. 在 `VideoPlayer.loadData` 入口 log：`isVideoColdAutoplay`, `resolveVideoColdAutoplay()`
3. 在 `kickVideoIosAutoplay` / `kickVideoAutoplay` 入口 log：`preferSoundAutoplay`, `el.muted`, `el.readyState`
4. 确认 DevTools 测的是 **iOS 路径**还是 **Android 路径**（看 UA / `isVideoIosPlayback()`）

---

## 十一、明确不做的事

1. **不要改** `ForYouPage/*` 源文件
2. **不要在** `resolveVideoMountAutoplayFlags` 运行时调用 `isDocumentReload()` 作「当前是否冷启动」判定（仅模块 init 写 sessionStorage 可保留）
3. **不要**只改 PC 分支或只改 `videoPlaybackKick` 就宣称 H5 已修好
4. **不要**同时大改「居中播放按钮 F4」与起播链路

---

## 十二、与 VIDEO_REQUIREMENTS.md 关系

- `VIDEO_REQUIREMENTS.md` F3（iOS H5 专用起播）= 本文 Step 2 + Step 3
- 本文 **F5 冷启动策略 + H5 蒙层** 是 F3 的前置/并行依赖，建议 **先完成策略 + iOS 接线**，再验 F4 居中按钮

---

*文档版本：2026-06-08，基于 `videoAutoplayPolicy.ts` / `VideoPlayer.tsx` / `videoIosPlayback.ts` 当前代码与联调反馈整理。*
