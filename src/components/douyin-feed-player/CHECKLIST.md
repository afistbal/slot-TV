# douyin-feed-player 验收清单

对照文档：

- [抖音H5滑动与播放逻辑分析.md](../../../../../../Users/Administrator/Downloads/www.douyin.com%20(2)/抖音H5滑动与播放逻辑分析.md) **§0 速查表 + §2**
- [抖音H5-iOS播放适配分析.md](../../../../../../Users/Administrator/Downloads/www.douyin.com%20(2)/抖音H5-iOS播放适配分析.md) **§8 验收清单**

> 状态说明：**✅** 已实现且与 MD 对齐 · **⚠️** 部分实现 / 简化版 · **❌** 未实现（Agent A/B 大功能或待补）

---

## A. Feed 滑动层（MD §0 / §2）

| # | 场景 | 状态 | 实现位置 | 备注 |
|---|------|------|----------|------|
| 1 | CSS `scroll-snap-type: y mandatory` 纵向吸附 | ✅ | `douyin-feed-player.scss` L1-23 | 含 `scroll-snap-align: start` |
| 2 | 滚轮累积阈值 40 + 防抖 400ms → changeNext/changePrev | ✅ | `feed/wheelNavigate.ts` + `constants.ts` | 对标 routes-route L3073-3087 |
| 3 | 排除横向滚轮 | ✅ | `feed/wheelNavigate.ts` `isVerticalWheel` | |
| 4 | 键盘 ↑↓ / W S 切条 | ✅ | `DouyinFeedPlayer.tsx` L101-112 | |
| 5 | scroll 事件同步 activeIndex | ✅ | `DouyinFeedPlayer.tsx` L74-92 | |
| 6 | 切条后失活 pause / 激活 play | ✅ | `DouyinFeedPlayer.tsx` `syncActiveIndex` + `handleSlotPlayerChange` | v5：滑离仅 pause（§8.8）；suspend 仅 teardown |
| 7 | 当前条 `data-e2e="feed-active-video"` | ✅ | `feed/buildPlayerSlots.ts` `getFeedItemDataAttrs` | 挂在 slide 容器 |
| 8 | 容器 `id="sliderVideo"` | ✅ | `DouyinFeedPlayer.tsx` L130 | |
| 9 | touchstart / mousedown / pointerdown 绑定 | ✅ | `feed/bindFeedTouchGuard.ts` + `DouyinFeedPlayer.tsx` | stopPropagation 防干扰 |
| 10 | 播放结束自动跳下一条 `from: auto` | ✅ | `DouyinFeedPlayer.tsx` `onVideoEnded` | |
| 11 | `mediaBaseUrl` + `resolveMediaUrl` 拼绝对 URL | ✅ | `DouyinFeedPlayer.tsx` L35-42 + `media/resolveMediaUrl.ts` | for-demo 传入 `config.static` |
| 12 | 触底 loadmore（倒数第 2 条起预拉） | ✅ | `ForDemo/index.tsx` `onIndexChange` + `fetchMoreRef` | 仅 for-demo 外层；播放器不感知 loadmore |
| 13 | 切条换源 `playNext()` | ✅ | `playback/playNextSource.ts` + `useDouyinPlayerSlot.ts` | 优先 switchURL，失败再 destroy 重建 |
| 14 | 播放器复用池 `l9` recycle | ⚠️ | `player/playerRegistry.ts` | v5 instManager-lite 按 id 登记；完整 l9 复用池待 P1 |
| 15 | CDN 过期 `MEDIA_EXPIRED` 重拉 | ❌ | — | |
| 16 | 播放错误重试 `dl()` | ❌ | — | |

---

## B. 播放器窗口 / DOM 门控（MD §2.6）

| # | 场景 | 状态 | 实现位置 | 备注 |
|---|------|------|----------|------|
| 17 | `isInitPlayer` 门控（活跃 ±1 窗口） | ✅ | `feed/shouldInitPlayer.ts` | `PLAYER_WINDOW_RADIUS = 1` |
| 18 | DOM 活跃 `<video>` ≤ 3 | ✅ | `feed/buildPlayerSlots.ts` + `shouldInitPlayer.ts` | 窗口最多 3 索引，每索引至多 1 实例 |
| 19 | 非窗口条仅封面占位 | ✅ | `DouyinFeedPlayer.tsx` L154-155 | `douyin-feed-player__cover` |
| 20 | 下一条预加载 `hasPreload` | ✅ | `DouyinFeedPlayer.tsx` L148 + `pickPlaybackMode.ts` | iOS 无预加载走 native |

---

## C. xgplayer 播放层（MD §3 / §7.5）

| # | 场景 | 状态 | 实现位置 | 备注 |
|---|------|------|----------|------|
| 21 | `autoplay` + `autoplayMuted: true` | ✅ | `player/createXgPlayer.ts` L46-47 | |
| 22 | `playsinline` + `webkit-playsinline` | ✅ | `player/createXgPlayer.ts` L48-49 | |
| 23 | iOS 额外 `videoPlay()` 双保险 | ✅ | `player/createXgPlayer.ts` L63-66 | |
| 24 | MSE 分片（Mp4Plugin） | ✅ | `player/createXgPlayer.ts` L58-59 | PC/Android 默认 MSE |
| 25 | `minBufferLength=5` / `maxBufferLength=60` | ✅ | `playback/bufferConfig.ts` + `constants.ts` | |
| 26 | `NotAllowedError` 拒播 UI 处理 | ⚠️ | `createXgPlayer.ts` / `setNativeVideoSrc.ts` | 仅 `.catch(() => {})`，无 NOT_ALLOW_AUTOPLAY 样式 |
| 27 | 音量 Cookie `H.J()` 全局静音策略 | ❌ | — | 固定 `autoplayMuted: true` |

---

## D. iOS 验收清单（MD §8）

| # | 场景 | 状态 | 实现位置 | 备注 |
|---|------|------|----------|------|
| 28 | 首条 `playsinline` + `muted` + autoplay | ✅ | `createXgPlayer.ts` + `setNativeVideoSrc.ts` | |
| 29 | MSE 分片 MP4 可播；waiting 不无限 loading | ✅ | `attachIOSAntiStall.ts` + `bufferWaterLevel.ts` | 解卡 + 水位控制 |
| 30 | MSE 卡 10s → 降级 `video.src` 直链 | ✅ | `attachIOSAntiStall.ts` + `setNativeVideoSrc.ts` | `WAITING_STUCK_MS=10000` |
| 31 | 预加载未命中 → 直接原生（MP4_0） | ✅ | `playback/pickPlaybackMode.ts` L14 | `isIOS && !hasPreload` |
| 32 | buffer 内有数据仍 waiting：5s 后 +0.5s，最多 3 次 | ✅ | `attachIOSAntiStall.ts` L51-57 | 常量 `WAITING_IN_BUFFER_MS=5000` |
| 33 | 缓冲 < 2s 主动 pause，够再 play | ✅ | `playback/bufferWaterLevel.ts` | `resumePlayWaterLevel: 2` |
| 34 | 上下滑切条：非 active pause，DOM video ≤ 3 | ✅ | `useDouyinPlayerSlot.ts` + `shouldInitPlayer.ts` | |
| 35 | Safari MSE gap → GapJump +0.1s | ✅ | `playback/attachSafariGapJump.ts` | MSE 模式挂载 |
| 36 | iOS Chrome（CriOS）同 Safari 播放路径 | ✅ | `platform/detectIOSBrowser.ts` + `detectPlatform.ts` | 播放分支用 `isIOS` |
| 37 | iOS Firefox（FxiOS）同 WebKit | ✅ | `platform/detectIOSBrowser.ts` | UA 识别 `firefox` shell |
| 38 | iOS Edge（EdgiOS）同 WebKit | ✅ | `platform/detectIOSBrowser.ts` | UA 识别 `edge` shell |
| 39 | 微信内置浏览器 iOS | ✅ | `platform/detectIOSBrowser.ts` | `shell=weixin` + `isIOS` |

---

## E. 集成 / API / for-demo

| # | 场景 | 状态 | 实现位置 | 备注 |
|---|------|------|----------|------|
| 40 | `DouyinFeedPlayerProps.onPlaybackModeChange` | ✅ | `types.ts` → `DouyinPlayerSlot` → `useDouyinPlayerSlot` | 创建/降级时 emit |
| 41 | `DouyinFeedPlayerProps.onStall` | ✅ | `attachIOSAntiStall.ts` → slot 层透传 | `waiting_in_buffer_micro_seek` 等 |
| 42 | `index.ts` 导出完整 | ✅ | `index.ts` | 组件、类型、平台、播放、常量 |
| 43 | `constants.ts` 数值与 MD 一致 | ✅ | `constants.ts` | `WAITING_STUCK_MS=10000` 等 |
| 44 | for-demo 零依赖 ForYouPage / 旧播放器 | ✅ | `pages/user/ForDemo/` | 仅依赖 `douyin-feed-player`、`api`、`config` |
| 45 | for-demo 使用 `mediaBaseUrl` | ✅ | `ForDemo/index.tsx` L66 | `useConfigStore config.static` |

---

## 汇总

| 状态 | 数量 |
|------|------|
| ✅ 已实现 | **36** |
| ⚠️ 部分实现 | **2** |
| ❌ 未实现 | **7** |
| **合计** | **45** |

### 未实现项（可选 / 大功能）

- 播放器复用池（#14）
- CDN 过期 / 错误重试（#15-16）
- 音量 Cookie 策略（#27）
- NotAllowedError UI（#26 仍为 ⚠️）
