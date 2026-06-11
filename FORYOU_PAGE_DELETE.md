# ForYouPage 删除引用说明

> 目标：删除 `src/pages/user/ForYouPage/` 整目录。  
> 编写日期：2026-06-11  
> **2026-06-11 更新**：P0 模块已迁移（见 §11），ForDemo/VDemo 已改新路径；遗留 ForYouPlayer 链仍靠 ForYouPage 内 re-export stub。

---

## 1. 现状

| 项 | 说明 |
|----|------|
| **路由** | `/foryou` 已挂 **`ForDemoPage`**（`src/pages/user/ForDemo/index.tsx`），**不再** lazy 加载 `ForYouPage` |
| **兼容跳转** | `/for-demo`、`/for-you` → `Navigate` 到 `/foryou`（`src/App.tsx` L236–250） |
| **ForYouPage 入口** | `index.tsx` → `ForYouVerticalSwiper` → `ForYouPlayer`，**仅目录内自用，无路由引用** |
| **产品含义** | 「For You 竖滑 Feed」能力已由 **ForDemo + douyin-feed-player** 承接 |

**结论**：`ForYouPage` 是遗留实现；直接删目录会导致 **编译失败**（见下文 P0 引用），需先迁移仍被引用的模块。

---

## 2. 目录清单（26 个文件）

```
src/pages/user/ForYouPage/
├── index.tsx                          # export ForYouVerticalSwiper（无路由）
├── ForYouVerticalSwiper.tsx           # 旧竖滑页（可删）
├── ForYouPlayer.tsx                   # 旧播放器壳（~2700 行，可删）
├── forYouPlayerLoadEpisode.ts         # 旧起播（可删）
├── forYouPlayerOverlays.ts            # ⚠️ 被多处 re-export 引用（需迁移）
├── useForyouFeed.ts                   # 旧 Feed hook（可删）
├── useForyouVideoPreload.ts           # 旧预加载（可删）
├── fetchForyouList.ts                 # ⚠️ ForDemo 仍用 API 拉列表
├── foryouConstants.ts                 # ⚠️ 常量，多处 import
├── foryouFeedMerge.ts                 # ⚠️ ForDemo 合并分页
├── foryouFeedMedia.ts                 # ⚠️ ForDemo 解析播放 URL + prewarm
├── foryouFeedUtils.ts                 # ⚠️ feedItem → IPlayerData/IPlayerEpisode
├── foryouNavigateToVideo.ts           # ⚠️ 「看全集」进 /video 续播
├── foryouFeedSession.ts               # 旧会话缓存（仅 ForYouVerticalSwiper + navigate 写）
├── foryouFeedProgress.ts              # 旧进度（仅 useForyouFeed）
├── foryouEpisodeCache.ts              # 旧集缓存（仅 ForYouPlayer 链）
├── foryouPrewarmPool.ts               # prewarm（被 foryouFeedMedia 引用）
├── foryouAutoplayPolicy.ts            # 旧自动播放策略（仅 ForYou 链）
├── foryouPlaybackKick.ts              # 旧 kick（仅 forYouPlayerLoadEpisode）
├── foryouIosPlayback.ts               # ⚠️ 底栏 `markForyouIosTabGesture` 仍引用
├── foryou-vertical.scss               # ⚠️ 竖滑样式，多页 import
└── views/
    ├── ForYouPlayerBottomInfo.tsx     # 仅 ForYouPlayer 用（可删或迁 components/feed）
    ├── ForYouWatchFullSeriesButton.tsx # ⚠️ ForDemo 顶栏「看全集」
    ├── ForYouPlayerH5CommerceDrawers.tsx  # ⚠️ ForDemo H5 商业抽屉（旧版，无 embed 集 id）
    └── ForYouPlayerPcCommerceDialogs.tsx  # ⚠️ ForDemo / FeedVerticalPc 商业弹窗
```

---

## 3. P0：删目录前必须改掉的 import（编译阻塞）

### 3.1 ForDemo（`/foryou` 主路径）

| 文件 | 引用的 ForYouPage 模块 | 用途 |
|------|------------------------|------|
| `ForDemo/useForDemoFeed.ts` | `foryouConstants`、`fetchForyouList`、`foryouFeedMerge`、`foryouFeedMedia` | Feed 列表、分页、URL 解析 |
| `ForDemo/ForDemoH5PlayerShell.tsx` | `foryouFeedUtils`、`foryouNavigateToVideo`、`forYouPlayerOverlays`、`foryouConstants` | 数据映射、看全集跳转、分享/抽屉 UI |
| `ForDemo/ForDemoPcPlayerShell.tsx` | 同上 + PC 抽屉/弹窗 | 同上 |
| `ForDemo/ForDemoFeedControlsTop.tsx` | `foryouConstants`、`views/ForYouWatchFullSeriesButton` | tag 上限、看全集按钮 |
| `ForDemo/index.tsx` | `foryou-vertical.scss` | 竖滑布局样式 |

### 3.2 VDemo（`/video/:id/:episode`）

| 文件 | 引用的 ForYouPage 模块 | 用途 |
|------|------------------------|------|
| `VDemo/VDemoH5PlayerShell.tsx` | `foryouConstants`、`forYouPlayerOverlays` | tag 上限、倍速/简介抽屉、分享 hook |
| `VDemo/VDemoPcPlayerShell.tsx` | 同上 + PC 分集/简介抽屉 | 同上 |
| `VDemo/index.tsx` | `foryou-vertical.scss` | 竖滑样式 |

### 3.3 其它运行时引用

| 文件 | 引用的 ForYouPage 模块 | 用途 |
|------|------------------------|------|
| `components/video-player/FeedVerticalPcPlayerShell.tsx` | `foryouConstants`、`forYouPlayerOverlays` | PC 竖滑壳 UI |
| `components/ReelShortBottomNav.tsx` | `foryouIosPlayback.markForyouIosTabGesture` | H5 底栏点 For You 时 iOS 手势链 |
| `VideoPage/VideoSeriesVerticalSwiper.tsx` | `foryou-vertical.scss` | 竖滑样式（当前路由未挂，但文件仍在） |
| `Video.tsx` | `foryou-vertical.scss` | 同上 |

### 3.4 `forYouPlayerOverlays.ts` 再导出链（迁移时要整包考虑）

当前路径：`ForYouPage/forYouPlayerOverlays.ts`

| 导出名 | 实际来源 | 仍被谁用 |
|--------|----------|----------|
| `useForYouPlayerShare` | `VideoPage/useVideoPlayerShare` | ForDemo / VDemo / FeedVerticalPc |
| `ForYouPlayerEpisodeSpeedIntroDrawers` | `VideoPage/views/VideoPlayerEpisodeSpeedIntroDrawers` | ForDemo H5、VDemo H5 |
| `ForYouPlayerPcEpisodeDrawer` | `VideoPage/views/VideoPlayerPcEpisodeDrawer` | VDemo PC、FeedVerticalPc |
| `ForYouPlayerPcIntroDrawer` | `VideoPage/views/VideoPlayerPcIntroDrawer` | ForDemo PC、VDemo PC、FeedVerticalPc |
| `ForYouPlayerPcEpisodeNav` | `@/components/video-player` | 仅 ForYouPlayer（可删） |
| `ForYouPlayerPcBackBar` | `VideoPage/views/VideoPlayerPcBackBar` | 仅 ForYouPlayer（可删） |
| `ForYouPlayerH5CommerceDrawers` | `ForYouPage/views/...`（**旧版**） | ForDemo H5 |
| `ForYouPlayerPcCommerceDialogs` | `ForYouPage/views/...`（**旧版**） | ForDemo PC、FeedVerticalPc |
| `ForYouWatchFullSeriesButton` | `ForYouPage/views/...` | ForDemoFeedControlsTop |
| `ForYouPlayerBottomInfo` | `ForYouPage/views/...` | 仅 ForYouPlayer（可删） |

**注意**：`ForYouPlayer*Commerce*` 与 `components/video-player/VideoPlayer*Commerce*` 是两套；后者已支持 `embedVideoEpisodeRowId` 等 vdemo 字段，ForDemo 仍走旧 ForYou 副本。

---

## 4. P1：不阻塞编译，但删后需更新文档/规则

| 位置 | 内容 |
|------|------|
| `src/constants/foryouRoute.ts` | **保留** — 路由常量、`ForYouToVideoLocationState`、续播 sessionStorage；**不在 ForYouPage 内** |
| `src/types/foryouFeed.ts` | **保留** — Feed 条目类型；ForDemo 仍用 |
| `VideoPage/videoAutoplayPolicy.ts` | import `ForYouToVideoLocationState`（来自 `foryouRoute`，非 ForYouPage） |
| `VideoPage/VideoPlayer.tsx` | `consumeForyouResumeTimeSec`（来自 `foryouRoute`） |
| `VideoPage/VIDEO_H5_AUTOPLAY_ISSUE.md` | 多处引用 ForYouPage 作「金标准」 |
| `VideoPage/VIDEO_REQUIREMENTS.md` | 禁止改 ForYouPage 等约束 |
| `components/douyin-feed-player/AUDIT.md` / `CHECKLIST.md` | ForYouPage 禁止项、对标说明 |
| `.cursor/rules/douyin-feed-implementer.mdc` | 禁止改 ForYouPage |
| `.cursor/rules/douyin-feed-reviewer.mdc` | 审核项「未改 ForYou」 |
| `ForDemo/FOR-DEMO_AUTOPLAY.md` | 对齐 ForYouPlayer 蒙层说明 |

---

## 5. P2：仅注释对标（删目录无影响）

以下文件只有注释里写「对标 ForYouPlayer / ForYou」，无 import：

- `VideoPage/VideoPlayer.tsx`
- `components/douyin-feed-player/DouyinFeedPlayer.tsx`
- `components/douyin-feed-player/player/DouyinPlayerSlot.tsx`
- `components/douyin-feed-player/controls/FeedSubtitleOverlay.tsx`
- `components/douyin-feed-player/controls/useDouyinPlayerControlState.ts`
- `components/douyin-feed-player/media/loadFeedSubtitleCues.ts`
- `components/douyin-feed-player/playback/videoAspectFit.ts`
- `pages/demo/components/DemoForYouReel.tsx`、`DemoSlideList.tsx`

---

## 6. 路由与导航（删 ForYouPage 后仍保留）

```tsx
// App.tsx — 无需因删 ForYouPage 而改路由
{ path: 'foryou', element: <ForDemoPage /> }
{ path: 'for-demo', element: <Navigate to="/foryou" replace /> }
{ path: 'for-you', element: <Navigate to="/foryou" replace /> }
```

仍使用 **`/foryou`** 的模块（与 ForYouPage 目录无关）：

- `src/constants/foryouRoute.ts` — `FORYOU_PATH`、`isForYouPathname`
- `src/components/ReelShortBottomNav.tsx` — 底栏 For You tab、全屏隐藏底栏
- `src/components/ReelShortTopNav.tsx` — PC 顶栏 For You 链接
- `src/layouts/user.tsx` — `isForYouPathname`（与 `isForDemoPathname` 并列）

---

## 7. 建议迁移目标（删目录前）

按依赖从少到多：

| 迁出内容 | 建议新位置 | 说明 |
|----------|------------|------|
| `foryou-vertical.scss` | `src/styles/foryou-vertical.scss` 或 `ForDemo/for-demo-vertical.scss` | 4 处 side-effect import 改路径 |
| `foryouConstants.ts` | `src/constants/foryouFeed.ts` 或 `ForDemo/constants.ts` | 常量 + `isInForyouPlayerWindow` |
| `fetchForyouList.ts` + `foryouFeedMerge.ts` + `foryouFeedMedia.ts` + `foryouPrewarmPool.ts` + `foryouEpisodeCache.ts` | `src/lib/foryouFeed/` 或 `ForDemo/lib/` | ForDemo Feed 数据层；`foryouEpisodeCache` 若 ForDemo 不用 prewarm 可精简 |
| `foryouFeedUtils.ts` | 同上或 `ForDemo/lib/feedMappers.ts` | `buildPlayerDataFromFeedItem` 等 |
| `foryouNavigateToVideo.ts` | `ForDemo/navigateWatchFull.ts` | 可去掉对 `foryouFeedSession` 的 `patch`（ForDemo 不读该 session） |
| `markForyouIosTabGesture` | `ForDemo/forDemoIosTabGesture.ts` 或 `lib/iosTabGesture.ts` | 仅 ReelShortBottomNav 一处 |
| `forYouPlayerOverlays.ts` | 删除 barrel，调用方直接 import `VideoPage` / `components/video-player` | 顺便把 ForDemo 商业 UI 切到 `VideoPlayerVipCommerce` + 新 Commerce 组件 |
| `ForYouWatchFullSeriesButton` | `ForDemo/components/WatchFullSeriesButton.tsx` | 小 UI 组件 |
| `ForYouPlayer*Commerce*` | 统一到 `components/video-player/` | 与 VDemo 已完成的公共化对齐 |

**可随 ForYouPage 一并删除、无需迁移**（确认无外部 import 后）：

- `ForYouVerticalSwiper.tsx`、`ForYouPlayer.tsx`
- `useForyouFeed.ts`、`useForyouVideoPreload.ts`
- `forYouPlayerLoadEpisode.ts`、`foryouPlaybackKick.ts`、`foryouAutoplayPolicy.ts`
- `foryouFeedSession.ts`、`foryouFeedProgress.ts`（ForDemo 不读；navigate 里的 patch 可删）
- `views/ForYouPlayerBottomInfo.tsx`（ForDemo 用 `ForDemoFeedControlsTop` + `FeedPlayerBottomInfo`）

---

## 8. 推荐删除步骤

1. **迁移 P0 模块**到新路径，全局替换 `@/pages/user/ForYouPage/...` import。
2. **ForDemo 商业 UI**：评估是否改为 `VideoPlayerVipCommerce` + `VideoPlayerH5CommerceDrawers` / `VideoPlayerPcCommerceDialogs`（与 VDemo 一致）。
3. **`forYouPlayerOverlays`**：拆开后删除 barrel；VDemo/ForDemo 改用 `@/pages/user/VideoPage/...` 或 `@/components/video-player`。
4. **`ReelShortBottomNav`**：`markForyouIosTabGesture` 迁出后改 import。
5. **`npm run build`** / 类型检查通过。
6. **删除** `src/pages/user/ForYouPage/`。
7. **更新** P1 文档与 `.cursor/rules` 里「禁止改 ForYouPage」表述 → 改为 ForDemo / douyin-feed-player。

---

## 9. 快速检索命令

删前再次确认无遗漏：

```bash
rg "ForYouPage|@/pages/user/ForYouPage" --glob "*.{ts,tsx,scss,md,mdc}"
rg "forYouPlayerOverlays|ForYouPlayer|ForYouVerticalSwiper|useForyouFeed" --glob "*.{ts,tsx}"
```

---

## 10. 风险点

| 风险 | 说明 |
|------|------|
| ForDemo 商业抽屉仍是旧组件 | 缺 `embedVideoEpisodeRowId` / 支付成功回调，与 VDemo 行为不一致 |
| `foryouFeedMedia` → `foryouPrewarmPool` | 迁数据层时需整包迁或 ForDemo 改用 douyin-feed-player 预加载 |
| `foryouNavigateToVideo` → `patchForyouFeedSession` | ForDemo 从不读 session，patch 是历史遗留；迁移时可简化 |
| 样式类名 `.foryou-*` | scss 迁路径即可，类名可保留以免大范围改 DOM |

---

## 11. 已完成的迁移（2026-06-11）

### 公共组件 `src/components/foryou-feed/`（ForDemo + VDemo 共用）

| 文件 | 说明 |
|------|------|
| `foryouConstants.ts` | Feed 常量 |
| `forYouPlayerOverlays.ts` | 播放器 overlay barrel |
| `foryou-vertical.scss` | 竖滑样式 |
| `foryouIosPlayback.ts` | iOS 底栏手势（ReelShortBottomNav） |
| `views/ForYouPlayerBottomInfo.tsx` | 底部信息（仅 legacy ForYouPlayer 经 barrel 用） |
| `views/ForYouWatchFullSeriesButton.tsx` | 看全集按钮 |
| `views/ForYouPlayerH5CommerceDrawers.tsx` | H5 商业抽屉（旧版） |
| `views/ForYouPlayerPcCommerceDialogs.tsx` | PC 商业弹窗（旧版） |
| `index.ts` |  barrel 导出 |

### ForDemo 专用 `src/pages/user/ForDemo/lib/`

| 文件 | 说明 |
|------|------|
| `fetchForyouList.ts` | API 拉列表 |
| `foryouFeedMerge.ts` | 分页合并 |
| `foryouFeedMedia.ts` | URL 解析 / prewarm |
| `foryouFeedUtils.ts` | feedItem → player 数据 |
| `foryouNavigateToVideo.ts` | 看全集进 /video |
| `foryouFeedSession.ts` | 会话缓存（navigate 写） |
| `foryouEpisodeCache.ts` | 集缓存 |
| `foryouPrewarmPool.ts` | prewarm 池 |
| `foryouConstants.ts` | **re-export** → `@/components/foryou-feed/foryouConstants`（供 `fetchForyouList` 相对 import，未改源文件） |

### ForYouPage 内保留的 re-export stub（删目录前需处理 legacy 或删 stub）

`foryouConstants.ts`、`forYouPlayerOverlays.ts`、`foryouIosPlayback.ts`、`foryouFeedUtils.ts`、`foryouFeedMedia.ts`、`foryouEpisodeCache.ts`、`foryouNavigateToVideo.ts`、`foryouFeedSession.ts`、`fetchForyouList.ts`、`foryouFeedMerge.ts`、`foryou-vertical.scss`（`@import` 新路径）、`views/ForYouWatchFullSeriesButton.tsx`

### 仍可整目录删除的 legacy（9 个源文件 + stub 一并删）

`ForYouVerticalSwiper.tsx`、`ForYouPlayer.tsx`、`useForyouFeed.ts`、`useForyouVideoPreload.ts`、`forYouPlayerLoadEpisode.ts`、`foryouPlaybackKick.ts`、`foryouAutoplayPolicy.ts`、`foryouFeedProgress.ts`、`index.tsx`

**删 stub 前**：`ForYouPlayerBottomInfo` / `foryouIosPlayback` 内绝对路径 `@/pages/user/ForYouPage/foryouConstants` 等需改指向新路径，或接受 stub 永久保留。
