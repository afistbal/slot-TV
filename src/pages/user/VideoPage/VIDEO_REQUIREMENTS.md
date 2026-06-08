# `/video` 播放页需求与实施清单

> 本文档整理自实际联调反馈。代码已回撤到稳定基线后，**按推荐顺序逐项实现**，每做完一项先验收再进入下一项。
>
> 测试页示例：`https://yogoshort.com/video/9859/4`

---

## 一、范围与原则

### 1.1 范围

| 页面 | 是否改动 |
|------|----------|
| `/video`（`VideoPage`） | ✅ 是 |
| For You（`ForYouPage`） | ❌ 否，除非单独提需求 |

### 1.2 实施原则

1. **一次只改一个功能**，改完在对应平台验收通过再继续。
2. **不要同时动**「起播链路」和「居中按钮交互」——这两块最容易互相踩坏。
3. **参考 For You 的实现方式**，但代码必须放在 `/video` 自己的文件里（复制后改名，不直接改 ForYou）。
4. 每项改动尽量 **最小 diff**，不要顺手重构无关逻辑。
5. 若某项修复依赖前一项（见下文「依赖」），必须先完成依赖项。

### 1.3 平台矩阵

| 代号 | 说明 |
|------|------|
| **PC** | `min-width: 768px`，滚轮/键盘/右侧分集按钮切集 |
| **H5 Android** | 手机浏览器竖滑切集 |
| **H5 iOS** | Safari / WKWebView 竖滑切集（需独立起播模块） |

---

## 二、推荐实施顺序

```
F1 → F2 → F3 → F4 → F5
```

| 顺序 | 编号 | 功能 | 原因 |
|------|------|------|------|
| 1 | **F1** | PC 滚轮/键盘切集有声自动播 | 独立、改动面小、用户最先反馈 |
| 2 | **F2** | H5 竖滑切集立即停上一集 | 切集基础能力，影响后续起播与 UI |
| 3 | **F3** | `/video` iOS H5 专用起播 | 依赖 F2 的 abort / video ref 链路 |
| 4 | **F4** | H5 第二屏居中播放/暂停 | 纯 UI 交互，必须等 F2/F3 稳定后再动 |
| 5 | **F5** | PC 静音时点击画面开声 | 可选增强，与 F4 的 PC 点击逻辑分开验收 |

---

## 三、功能清单

---

### F1 — PC 滚轮/键盘切集有声自动播

#### 问题

- PC 点右侧分集按钮 `video-pc-episode-btn`：**有声自动播** ✅
- PC 滚轮/键盘切集：**静音自动播** + 可能出现「点击取消静音」蒙层 ❌
- 行为不一致

#### 期望行为

| 操作 | 期望 |
|------|------|
| PC 滚轮切集 | 与分集按钮一致，优先有声自动播 |
| PC 键盘切集 | 同上 |
| PC 分集按钮 | 保持现状（有声自动播） |
| 首次冷启动直链打开 | 仍可能受浏览器策略限制静音起播（可接受） |

#### 根因（已分析）

- 分集按钮会设置 `legacyEpisodeAutoplayRef = true`（用户主动切集标记）
- 滚轮/键盘走 `handleSetEpisode` 时**未设置**该标记 → 走冷启动静音路径

#### 涉及文件

- `VideoVerticalSwiper.tsx` — `handleSetEpisode` 切集前设 `legacyEpisodeAutoplayRef.current = true`
- `videoPlaybackKick.ts` — `allowSoundAutoplay` 在 PC + legacy 切集时允许有声；用户切集时不显示 PC 静音蒙层

#### 验收

- [ ] PC：滚轮从 Ep.4 切到 Ep.5，有声自动播
- [ ] PC：键盘上下切集，有声自动播
- [ ] PC：分集按钮切集，行为不变
- [ ] PC：首次直链冷启动，行为与改前一致（允许静音 + 蒙层）

#### 依赖

无

---

### F2 — H5 竖滑切集时上一集立即停播

#### 问题

- H5 `/video` 上下滑到第二屏时，**上一集可能还在播**（两集同时出声）
- For You 没有这个问题

#### 期望行为

- 用户开始切条（竖滑松手确认换集 / 点分集切集）时，**立刻**对 outgoing `<video>` 执行 pause + 中止媒体拉取
- 新集正常起播
- 邻格 `videoKeepMediaOnPause` 逻辑保留：仅「离开当前条」时 abort 一次，paused 邻格不二次 abort

#### 参考实现（For You）

- `ForYouVerticalSwiper`：`abortForyouVideoLoad(videoResumeRef.current)` 在滑切开始时调用
- `onVideoElementReady` 维护当前活跃 video 引用

#### 涉及文件（新建 + 修改）

- `videoFeedMedia.ts`（新建）
  - `abortVideoLoad(el)` — pause、清空 source src、load()
  - `resyncVideoSources` / `primeVideoNeighborBuffer` / `ensureVideoMediaPreconnect`（邻格预热，可一并带上）
- `VideoVerticalSwiper.tsx`
  - `videoResumeRef` 跟踪当前活跃 video
  - H5 `pointerUp` 切集前、H5/PC `handleSetEpisode` 切集前调用 `abortVideoLoad`
  - 给 active `VideoPlayer` 传 `onVideoElementReady`
- `VideoPlayer.tsx`
  - 新增可选 prop `onVideoElementReady?: (el: HTMLVideoElement | null) => void`
  - video 挂载/卸载时回调

#### 验收

- [ ] H5 Android：滑到第二屏，上一集立刻无声
- [ ] H5 iOS：同上
- [ ] H5：快速连续滑 3 集，无叠音
- [ ] PC：滚轮切集，上一集停播（若 PC 也走同一 abort 路径）

#### 依赖

无（但 **F3、F4 应在本项之后**）

---

### F3 — `/video` iOS H5 专用起播（黑屏不播）

#### 问题

- **H5 iOS** 进入 `/video` 或切集后：**黑屏、不播放**
- H5 Android 正常
- For You iOS 正常（但 **不要改 ForYou 代码**）

#### 期望行为

| 场景 | 期望 |
|------|------|
| iOS 直链进入 `/video` | 能起播（至少静音起播，有画面） |
| iOS 从首页进站 | 优先有声起播 |
| iOS 竖滑切集 | 新集在用户手势链内起播，不黑屏 |
| Android H5 | 行为与改前一致，不走 iOS 分支 |

#### 做法

复制 For You 的 iOS 模块思路，**独立文件**给 `/video` 使用：

| For You（只读参考） | `/video`（新建/使用） |
|---------------------|----------------------|
| `foryouIosPlayback.ts` | `videoIosPlayback.ts` |
| `kickForyouIosAutoplay` | `kickVideoIosAutoplay` |
| `kickForyouIosGestureAutoplay` | `kickVideoIosGestureAutoplay` |
| `primeForyouIosLoadDataVideo` | `primeVideoIosLoadDataVideo` |
| `bindForyouIosPlayRetry` | `bindVideoIosPlayRetry` |
| `ensureForyouIosVideoLoad` | `ensureVideoIosVideoLoad` |

#### 接入点

- `videoPlaybackKick.ts` — `kickVideoAutoplayForPlatform()`：H5 iOS 走 `kickVideoIosAutoplay`，其余走 `kickVideoAutoplay`
- `videoPlayerLoadEpisode.ts` — load 完成时分平台 kick
- `VideoPlayer.tsx` — iOS 专用 prime / play retry effect（对齐 ForYouPlayer 挂载时机）
- `VideoVerticalSwiper.tsx` — 竖滑切集时在正确 video 上 `kickVideoIosGestureAutoplay`（配合 `videoResumeRef` / `onVideoElementReady`）

#### 关键注意点

1. **禁止修改** `ForYouPage/foryouIosPlayback.ts` 和 `ForYouVerticalSwiper.tsx`
2. `ensureVideoIosVideoLoad` 须在 source 有有效 `src` 后再 `load()`
3. iOS 不要过早 `play()`（等 `canplay` / `loadeddata`）
4. abort 清 src 后，`networkState === LOADING` 不能误跳过 reload

#### 验收

- [ ] iOS Safari：直链打开 `/video/xxx/1`，有画面且自动播
- [ ] iOS Safari：从首页点进 `/video`，有声或静音起播均可接受，但不能黑屏卡死
- [ ] iOS Safari：竖滑切 2～3 集，每集都能起播
- [ ] Android H5：上述场景行为不变
- [ ] For You：任意场景 **无回归**

#### 依赖

- **F2**（`videoResumeRef` + `abortVideoLoad` + `onVideoElementReady`）

---

### F4 — H5 第二屏居中播放/暂停按钮

#### 问题

- H5 `/video` **首屏**有居中播放/暂停按钮（`video-player-center-play`）✅
- 竖滑到**第二屏**后，点击视频区域**不出现**暂停 icon（`icon_stop@2x.webp`）❌
- 播放仍在继续，但 UI 无反馈
- 之前多次修改 **`handleControllerTouchStart` / `showCenterPlayControl` / videoStage onClick** 导致首屏也坏了 → 已明确要求改回

#### 期望行为

| 状态 | 期望 |
|------|------|
| 暂停中 | 显示播放三角 `icon_play1@2x.webp` |
| 播放中，用户点过视频区 | 显示暂停两竖杠 `icon_stop@2x.webp` |
| 点居中按钮或视频区 | toggle 播放/暂停 |
| 首屏 | 行为与线上一致，**不能因为修第二屏而坏首屏** |

#### 根因（已分析，勿重复踩坑）

当前基线逻辑：

```ts
const showCenterPlayControl =
  canPlay &&
  episode?.lock === false &&
  (!playing || (centerPlayUiEngaged && controllerVisible && playing));
```

换集后：

1. `useEffect([id])` 把 `centerPlayUiEngaged` 重置为 `false`
2. 新集自动播放 → `playing = true`
3. 需要 `centerPlayUiEngaged && controllerVisible` 才显示暂停 icon
4. H5 `videoStage` 的 `onClick` **仅在 `!controllerVisible` 时** 才会 `engage`
5. 第二集进来时 `controllerVisible` 往往已是 `true` → 点击无效 → icon 永远不出现

#### 推荐修法（参考 For You，最小侵入）

**不要**再改 `handleControllerTouchStart` 的 PC/H5 分支混用逻辑。

优先方案（与 `ForYouPlayer` 对齐）：

1. H5 点视频空白区 → 直接走 `handleCenterTogglePlay`（排除侧栏/底栏/进度条等，参考 `handleForyouControllerTap`）
2. 或：暂停时始终显示 play icon；播放中不显示 pause icon，但点视频区可 pause（For You feed 做法）
3. 若必须显示 pause icon：仅放宽 H5 的 `showCenterPlayControl` 条件，**不动 PC 条件**

For You 参考：

```ts
// ForYouPlayer.tsx — H5 点视频区
onClick → handleCenterTogglePlay(e)

// 非 ForYou feed 仍用 engage + controllerVisible 逻辑
```

#### 涉及文件

- **仅** `VideoPlayer.tsx`（优先）
- 不要动 `videoPlaybackKick.ts` / `VideoVerticalSwiper.tsx` 起播逻辑

#### 验收

- [ ] H5 Android：首屏 — 播放/暂停按钮与点击行为正常
- [ ] H5 Android：第二屏 — 点视频区出现 pause icon，再点可暂停
- [ ] H5 iOS：首屏 + 第二屏同上
- [ ] PC：居中按钮与 `handleDesktopPlayerClick` **无回归**
- [ ] 侧栏 VIP / List / Share、底栏进度条点击 **不触发** toggle

#### 依赖

- **F2、F3** 稳定后再做（避免把起播问题误判为 UI 问题）

---

### F5 — PC 静音播放时点击画面开声（可选）

#### 问题

- PC 静音自动播时，用户点击视频区域会 **pause** 而不是 **取消静音**

#### 期望行为

- 静音播放中点击画面 → 先 `handleTapToUnmute()` 开声继续播
- 已有声播放中点击 → 保持现有 toggle（pause）

#### 涉及文件

- `VideoPlayer.tsx` — `handleDesktopPlayerClick` 在 `v.muted` 时先开声

#### 验收

- [ ] PC：静音蒙层/静音播放时点击画面 → 开声，不误暂停
- [ ] PC：有声播放时点击 → 仍 pause
- [ ] 与 F4 无冲突

#### 依赖

- 建议在 **F4 完成之后** 单独做，避免与居中按钮逻辑纠缠

---

## 四、明确禁止事项

| 禁止 | 原因 |
|------|------|
| 修改 `ForYouPage/**` 的 iOS 起播逻辑 | 用户明确要求撤回；For You 本身正常 |
| 在修 F4 时改动 `handleControllerTouchStart` 的 PC 逻辑 | 曾导致首屏事件坏掉 |
| 一次 PR 同时合入 F1～F5 | 无法定位回归 |
| 用 For You 专用 CSS class（`foryou-player-*`）到 `/video` | 应使用 `video-player-*` 自己的样式 |

---

## 五、基线回撤检查

回撤完成后，`VideoPage` 目录建议状态：

- `VideoPlayer.tsx`、`VideoVerticalSwiper.tsx` — 与 git 稳定提交一致
- 以下文件若存在且未验收对应功能，应**先删除或不要接入**：
  - `videoIosPlayback.ts`
  - `videoPlaybackKick.ts`（若从 ForYou 拆出但未完整接入）
  - `videoFeedMedia.ts`
  - `videoPlayerResume.ts`

开始每一项前：

```bash
git status src/pages/user/VideoPage/
git diff src/pages/user/VideoPage/
```

确保只包含**当前功能**的改动。

---

## 六、总验收 Checklist（全部完成后）

### PC

- [ ] 滚轮/键盘/分集按钮切集均有声自动播（冷启动除外）
- [ ] 点击画面：静音开声、有声暂停（若做了 F5）
- [ ] 居中播放/暂停按钮正常

### H5 Android

- [ ] 首屏起播正常
- [ ] 竖滑切集：上一集停、新集播
- [ ] 第二屏及之后：居中播放/暂停 UI 正常

### H5 iOS

- [ ] 进入不黑屏
- [ ] 竖滑切集起播正常
- [ ] 居中播放/暂停 UI 正常

### For You（回归）

- [ ] iOS / Android 均无变化

---

## 七、关键文件索引

| 文件 | 职责 |
|------|------|
| `VideoPlayer.tsx` | 播放器 UI、居中按钮、loadData、video 挂载回调 |
| `VideoVerticalSwiper.tsx` | 竖滑/滚轮切集、legacy 标记、abort、iOS gesture |
| `videoPlaybackKick.ts` | 通用起播 + 平台分发 |
| `videoIosPlayback.ts` | `/video` iOS H5 专用起播 |
| `videoPlayerLoadEpisode.ts` | 加载集数、调用 kick |
| `videoFeedMedia.ts` | abort / resync / 邻格预热 / CDN preconnect |
| `videoSessionMute.ts` | 会话内用户是否已开声 |
| `ForYouPlayer.tsx` | **只读参考** H5 点击 toggle、iOS 挂载时机 |
| `foryouIosPlayback.ts` | **只读参考** iOS 起播实现 |

---

## 八、进行方式

用户回撤代码后，按下面格式逐项推进：

1. 说「做 F1」→ 只实现 F1 → 验收
2. 说「做 F2」→ 只实现 F2 → 验收
3. …依此类推

每项完成后在本文档对应章节打勾，或直接在对话里确认通过再进入下一项。
