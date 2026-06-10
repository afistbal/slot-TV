# 播放架构说明 — 「队列」在哪、自动播由谁触发

> 给实施/审核 Agent 用：先读本文，再改代码。  
> 抖音对标：`instManager.setActive` + `syncInteraction` → **单点** pause/play（MD §2.5）。  
> **我们目前没有等价的「播放队列」**，是多处 ref + 事件拼起来的。

---

## 1. 三层「列表」（都不是 FIFO 队列）

| 层 | 存在形式 | 位置 | 条数 |
|----|----------|------|------|
| **数据列表** | `DouyinFeedVideoItem[]` | `ForDemo` 的 `items` state → `DouyinFeedPlayer.items` | API 返回（首屏约 10），loadmore **append** |
| **DOM 列表** | 每个 item 一个 `.douyin-feed-player__slide` | `DouyinFeedPlayer` `playbackItems.map` | **全部**条目都有 slide（无 player 时只显示 cover） |
| **播放器实例** | `Map<index, Player>` + **`playerRegistry` 按 id** | `playerByIndexRef` + `player/playerRegistry.ts` | 稀疏 Map，**最多同时 3 个**（见下） |

**没有**：`playQueue`、`taskQueue`、待播 URL 队列。  
**有（v5）**：`playerRegistry` instManager-lite 按 `item.id`；完整 `l9` 复用池仍待 P1。

---

## 2. 唯一的「窗口」— 3 槽位（不是队列，是滑动窗口）

```
activeIndex = k 时，逻辑窗口索引: [k-1, k, k+1]   // PLAYER_WINDOW_RADIUS = 1
```

| 步骤 | 文件 | 函数 |
|------|------|------|
| 算窗口索引 | `feed/shouldInitPlayer.ts` | `getWindowIndices(activeIndex, total)` |
| 算谁该 mount player | 同上 | `shouldInitPlayer({ index, activeIndex, preloadNext })` |
| 生成槽状态 | `feed/buildPlayerSlots.ts` | `buildPlayerSlots(items, activeIndex, preloadNext && preloadGate)` |

`slots` 是 **useMemo 快照**，每次 `activeIndex` 或 `preloadGate` 变就重算。  
窗口外索引：**无** `<video>`，只有 `douyin-feed-player__cover`。

### preloadGate（预加载门）

- 默认 **关**：`buildPlayerSlots(..., false)` → **只 init 当前条**，不 init next。
- **开**：当前条 `playing` 或缓冲 ≥ 2s（`RESUME_PLAY_WATER_LEVEL`）→ 才允许 init **下一条**。
- iOS `touchstart` 也会 `openPreloadGate()`（提前开门）。

---

## 3. 当前条 / 待播 — 两个 ref（仍不是队列）

| ref | 类型 | 含义 |
|-----|------|------|
| **`activeIndexRef`** | `number` | 当前 snap 到的 feed 索引（与 scroll 同步） |
| **`pendingPlayIndexRef`** | `number \| null` | 切条时 **目标 player 尚未 mount** 时记下 index，等 `handleSlotPlayerChange` 补 play |

`pendingPlayIndex` 只有 **0 或 1 个** 待处理索引，不是队列。

---

## 4. loadmore append 时（v5 / MD §8.1）

```
items.length++（append，activeIndex 处 id 不变）
  → 不 reset activeIndex
  → 不 teardown 当前 active player（slide key = item.id）
  → postRenderTransitionRef = 'append-play'
  → useLayoutEffect 单次 scheduleActivePlay(registry.get(activeId))
```

远端新条目：未滑到 → `shouldInitPlayer=false` → 仅封面。  
预加载：仍受 `preloadGate` + `getAllPlayer().length` 门控。

---

## 5. 播放器实例表 — `playerByIndexRef` + `playerRegistry`

```
playerByIndexRef: Map<feedIndex, xgplayer.Player>
```

- **写入**：`handleSlotPlayerChange(index, player)` ← `useDouyinPlayerSlot` mount 后 `onPlayerChange`
- **读取**：`syncActiveIndex`、`syncActivePlayOnGesture`
- **删除**：slot teardown 时 `onPlayerChange(null)`

**切条时**（`syncActiveIndex`）：

```
old = playerByIndexRef.get(prev)
  → pausePlayer(old)                               // §8.8 滑离仅 pause，不 suspend

new = playerByIndexRef.get(clamped)
  → 有: resumePlayerLoading + ensureActivePlay
  → 无: pendingPlayIndexRef = clamped
```

---

## 6. 自动播放触发点（分散 — 根因之一）

抖音：**一处** `setTimeout(() => { syncInteraction; play() })`。

我们：**多处** 可触发 play，无统一调度器：

| # | 触发源 | 文件 | 行为 |
|---|--------|------|------|
| 1 | scroll 切条 | `DouyinFeedPlayer` `onScroll` → `syncActiveIndex` | `ensureActivePlay(newPlayer)` |
| 2 | wheel/键盘/ended | `navigate` → `syncActiveIndex` | 同上 |
| 3 | touchend | `bindFeedTouchGuard` → `syncActivePlayOnGesture` | `resumePlayerLoading` + `ensureActivePlay` |
| 4 | player 晚到 | `handleSlotPlayerChange` | `scheduleActivePlay` 或 `ensureActivePlay`（看 `isUserGestureActive()`） |
| 5 | slot 内（弱） | `useDouyinPlayerSlot` `applyActivePlayback` | 仅 url 换源时 `scheduleActivePlay` |

**iOS 问题**：1/2 常在 **非手势** 链里 `play()`；4 常在 mount **晚于** touchend 时执行 → 自动播失败。

---

## 7. 数据 loadmore（列表变长，不是播放队列）

| 项 | 位置 |
|----|------|
| 触发 | `ForDemo.handleIndexChange`：`index >= len - 2` |
| 请求 | `fetchForDemoFeedVideos()` → `mergeFeedItems` append |
| 与播放关系 | 仅 **变长 `items`**；播放器通过 `playbackItemsRef` 读长度，**不**在播放器内 loadmore |

10 条时 loadmore 在 **index 8+**（第 9 条），与 5–6 条暂停 **无直接关系**。

---

## 8. 与抖音的差异（要做「真实有效自动播」应对齐什么）

| 抖音 | 我们现状 |
|------|----------|
| `instManager` 单例登记所有 player | v5：`playerRegistry` 按 id + `playerByIndexRef` |
| `setActive(id, true/false)` 统一激活 | v5：`setActiveId` + `syncActiveIndex` pause/resume/play |
| `syncInteraction` 后 **一次** play | touchend + scroll + mount 多处 play |
| `l9` 复用池（CHECKLIST #14 ❌） | 窗口外 **destroy**，切回需冷启动 |
| `H.J()` 全局静音 | `mutePreference`（控件层），创建时仍 `autoplayMuted: true` |

---

## 9. 5–6 条易暂停在本架构下的位置

```
index 4→5 或 5→6：
  窗口扩位 → 新 index 首次 shouldInitPlayer=true
  → useDouyinPlayerSlot mount 异步
  → syncActiveIndex 时 playerByIndexRef.get(next) 可能为 null
  → pendingPlayIndexRef = next
  → 稍后 handleSlotPlayerChange 补 play（常已脱离 iOS 手势）
```

v5 滑离不再 suspend；`suspendPlayerLoading` 仅窗口外 teardown。active + next 最多 2 路 native 拉流（gate 开后）。

---

## 10. 若要做「真实有效自动播」（建议方向，实施前需写进 AUDIT）

1. **单点调度**：仅 `syncActiveIndex` + **touchend 手势链** 内调用 `ensureActivePlay`；scroll 切条只改 index，不直接 play（或 scroll 在手势内再 play）。
2. **pendingPlay**：mount 完成时若 `pendingPlayIndex === index`，必须在 **同一 touchend 双 rAF** 或 `isUserGestureActive()` 内 play（MD §2.5）。
3. **不要**再增加第 6 处 play 来源。
4. 预加载：对齐 §8.4.4，保证 **滑到 next 前** next 的 player 已在 `playerByIndexRef`（gate + 窗口稳定）。

---

## 11. 快速定位表

| 你想找… | 去看… |
|---------|--------|
| 视频 URL 列表 | `ForDemo` `items` / `playbackItemsRef` |
| 当前滑到哪条 | `activeIndexRef` / `activeIndex` state |
| 哪个 index 有 xgplayer | `playerByIndexRef` |
| 哪个 id 有 xgplayer | `playerRegistry.get(id)` |
| append 后补播 | `postRenderTransitionRef` + `useLayoutEffect` |
| 谁该有 DOM player | `slots` ← `buildPlayerSlots` |
| 切条 pause/play | `syncActiveIndex` |
| 晚到的 player 补播 | `pendingPlayIndexRef` + `handleSlotPlayerChange` |
| iOS 手势补播 | `syncActivePlayOnGesture` + `userGesturePlay.ts` |
| 取消拉流 | `suspendPlayerLoading` |
| 恢复拉流 | `resumePlayerLoading` |
