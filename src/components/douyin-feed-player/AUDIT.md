# douyin-feed-player 审核规范（Agent B 实施 / Agent A 审核）

> **角色分工**
> - **Agent B（实施）**：按本文「必做改动」修改代码，不得自创新架构。
> - **Agent A（审核，当前对话）**：对照 MD + 本文验收；任何偏离抖音参考的方案一律打回。

**参考文档（唯一权威）**

- `抖音H5滑动与播放逻辑分析.md` §2.5（L155–182）、§8.1（L520–557）
- `抖音H5-iOS播放适配分析.md` §7.4–7.5

**禁止**

- zustand / Context 做播放调度
- 自创滑动算法（保留现有 scroll-snap + wheel 40px/400ms）
- import / 复制 `/for-you`、`ForYouPage`、`VideoPlayer` 业务
- render 阶段 `queueMicrotask` / 条件 Hook
- 为每个 prop 新增 `useEffect`（性能差、易竞态）
- 无 MD 依据的抽象层

**允许**

- xgplayer npm、`/video` CSS 类名、`config.static` 拼 URL
- 在 **scroll / syncActiveIndex / player.on** 事件里直接 pause/play
- 复用项目内 **样式结构**（如 `foryou-vertical__edge-hint--bottom`），逻辑仍写在 `douyin-feed-player` 内

---

## 一、用户反馈（已确认）

| 现象 | 复现条件 |
|------|----------|
| iOS 滑动偶发 **暂停**，需手动点播放 | 约第 **7 条**（index **6**），`loadmore` 请求进行中或刚合并列表后 |
| 期望 | 抖音式：**末段可轻滑一点 + 底部 loading**，数据回来 **自动 play**，不黑屏停住 |

---

## 二、根因分析（审核结论，Agent B 必须先理解再改）

### 2.1 loadmore 与第 7 条时间线对齐

```92:108:src/components/douyin-feed-player/DouyinFeedPlayer.tsx
    const syncActiveIndex = useCallback((next: number, direction?: FeedNavigateDirection) => {
        // ...
        setActiveIndex(clamped);
        setActivePlayer(playerByIndexRef.current.get(clamped) ?? null);
        // ...
        maybeLoadMore(clamped);  // threshold=4 → len=10 时在 index=6 触发
    }, [maybeLoadMore]);
```

- 首屏 `/api/foryou` 通常 ~10 条 → `loadMoreThreshold=4` → **index ≥ 6** 即触发 `onLoadMore`
- 用户滑到 **第 7 条（index 6）** 时，**API 请求与切条 play 并发**，易竞态

### 2.2 切条 play 依赖 `useEffect`，存在「player 尚未就绪」窗口

```313:323:src/components/douyin-feed-player/player/useDouyinPlayerSlot.ts
    useEffect(() => {
        if (!options.shouldInit || !options.url) return;
        syncPlaybackFromOptions();
    }, [options.url, options.isActive, options.hasPreload, options.shouldInit, syncPlaybackFromOptions]);
```

```235:237:src/components/douyin-feed-player/player/useDouyinPlayerSlot.ts
        if (!handleRef.current) {
            return;  // ← isActive 已 true，但 mountEl/player 未创建 → 直接 return，无人补 play
        }
```

**抖音做法（MD §2.5 L3180–3186）**：在 **setActive / 切条事件** 里 `pause()` 旧实例 → `setTimeout(() => o.play())` 新实例，**不**等 React effect 链。

当前实现把 pause/play 挂在 slot 的 `isActive` + `useEffect`，与 `mountEl` 异步 ref、`loadmore` 列表 merge 叠在一起 → **偶发漏 play**。

### 2.3 loadmore 期间列表 merge 放大竞态

```58:66:src/pages/user/ForDemo/index.tsx
    const handleLoadMore = useCallback(async () => {
        setLoadingMore(true);
        const result = await fetchForDemoFeedVideos();
        if (result.ok) {
            setItems((prev) => mergeFeedItems(prev, result.items));
        }
        setLoadingMore(false);
    }, [loadingMore]);
```

- `setItems` → `playbackItems` / `slots` 重算 → 邻槽 `shouldInitPlayer` 变化 → mount effect **teardown/recreate**
- `notifyPlayerChange(null)` → `activePlayer` 短暂为 null
- **无**「loadmore 完成后的补 play」→ 停在暂停态

### 2.4 非 loadmore 也可能漏 play（次要）

`bufferWaterLevel.ts` 缓冲不足会 `video.pause()`；若之后没有 `playing/timeupdate` 触发恢复，也会停住。loadmore 竞态是主因，buffer 恢复逻辑不要在本次大改。

---

## 三、抖音对标行为（Agent B 必须对齐，不得发挥）

### 3.1 切条 pause/play — MD §2.5

```javascript
// routes-route L3180-3186
o.pause()
instManager.setActive(l, false)
// 激活侧
setTimeout(() => {
  eh.emit(eh.EVENT.syncInteraction)
  o.play()
})
```

**落地要求**：在 **`DouyinFeedPlayer.syncActiveIndex`（scroll/wheel/keyboard 已汇聚于此）** 内：

1. 记录 `prevIndex`，对新旧 index 各取 `playerByIndexRef.get(index)`
2. **失活**：`pausePlayer(oldPlayer)`（已有 API）
3. **激活**：`scheduleActivePlay(newPlayer)`（已有 API，内含 setTimeout 0）
4. **禁止**再靠 slot `isActive` 的第二个 useEffect 做唯一 play 来源（可保留 pause 兜底，但激活必须以 Feed 事件为准）

### 3.2 loadmore — MD §8.1 L18302–18316

- 距末尾 ≤ `defaultCount(4)` **预拉**，不是滑到底才拉（已实现 `maybeLoadMore`）
- 请求中 **`!loading` 才重复触发**（已有 `loadingMore` + lock）
- **UI**：末段加载时底部 loading（对标 PC ForYou 的 `foryou-vertical__edge-hint--bottom`，见 `ForYouVerticalSwiper.tsx` L503–510）

### 3.3 末段「只能滑一点点」— 实施约束（简化版，禁止上 Swiper）

抖音 Feed 在数据未就绪时不应完整 snap 到下一条空占位。允许的最小实现（二选一，**优先 A**）：

| 方案 | 做法 | MD 依据 |
|------|------|---------|
| **A（推荐）** | `loadingMore` 或「已到最后一条且 `hasMore`」时，scroll 事件 **clamp**：`activeIndex` 不得超过 `items.length - 1`；touch 上滑仅 **overscroll 阻力**（CSS `overscroll-behavior-y: contain` + 可选末条 `padding-bottom` 8–16px） | 末段预拉 + 不进入空 slide |
| B | 末条后渲染 **loading 占位 slide**（高度 60–80px + spinner），snap 只吸到末条真实视频 | 对标 edge loading |

**禁止**：引入 Swiper.js、改 wheel 阈值、改 snap 为 JS 动画。

### 3.4 loadmore 完成后自动 play

```javascript
// 伪代码 — 必须在 Feed 层，禁止 slot useEffect
onLoadMoreResolved() {
  const p = playerByIndexRef.current.get(activeIndexRef.current)
  if (p) scheduleActivePlay(p)
}
```

- `ForDemo`：`handleLoadMore` 的 `finally` 里不需要 play（Feed 层统一做）
- `DouyinFeedPlayer`：监听 `loadingMore: true → false` **仅一次**补 play；或 `onLoadMore` Promise resolve 回调（**优先事件/Promise，不用 watch items.length 的 effect**）

---

## 四、必做改动清单（Agent B）

### P0 — 修复暂停（事件驱动）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `DouyinFeedPlayer.tsx` | 在 `syncActiveIndex` 内对 old/new player 执行 `pausePlayer` / `scheduleActivePlay` |
| 2 | `DouyinFeedPlayer.tsx` | `handleSlotPlayerChange`：若 `index === activeIndexRef.current && player`，**立即** `scheduleActivePlay(player)`（覆盖 loadmore 重建实例） |
| 3 | `useDouyinPlayerSlot.ts` | **删除** L313–323 的 `isActive/url` sync `useEffect`；`syncPlaybackFromOptions` 仅保留 **url 换源**（switchURL），由 init 时 autoplay + Feed 层 play 负责 |
| 4 | `useDouyinPlayerSlot.ts` | mount-only effect **保留**（创建/销毁 xgplayer） |

### P1 — loadmore UX（抖音末段 loading）

| # | 文件 | 改动 |
|---|------|------|
| 5 | `DouyinFeedPlayer.tsx` | 增加 `loadingMore` 底部 hint UI（结构对齐 `foryou-vertical__edge-hint--bottom`，样式放 `douyin-feed-player.scss`） |
| 6 | `DouyinFeedPlayer.tsx` | `loadingMore` 从 true→false 时，对当前 active player `scheduleActivePlay`（ref 存 prev loadingMore，在 `onLoadMore` promise finally 或 props 变更时用 **单次 ref 回调**，非 useEffect 依赖数组堆砌） |
| 7 | `DouyinFeedPlayer.tsx` | scroll 同步 index 时 **禁止** snap 到 `index >= items.length`（末条防护） |
| 8 | `douyin-feed-player.scss` | 容器 `overscroll-behavior-y: contain`；可选末条轻量 overscroll |

### P2 — 可选（审核通过后再做）

| # | 内容 |
|---|------|
| 9 | `hasMore` prop：API 无更多时不再 loadmore（for-demo 可先恒 true） |
| 10 | loadmore 提前到 index `len - threshold - 1` 预拉（减少用户在末段等待） |

---

## 五、代码审查红线（Agent A 打回条件）

1. 新增 **>2 个** 与播放相关的 `useEffect`（mount-only + loadmore 补 play 的 **1 个** ref 方案除外）
2. 在 render / useMemo 里调用 `play()` / `pause()`
3. 引入 zustand、Context、自定义 EventEmitter 包
4. 修改 `/for-you`、`VideoPlayer`、`useForyouFeed` 任一文件
5. 未使用 `scheduleActivePlay` / `pausePlayer`，直接散落 `player.play()`
6. loadmore 没有底部 loading 视觉反馈
7. 改完 iOS 首条 autoplay 回退（需实机 index 0 仍自动播）

---

## 六、验收步骤（Agent A 执行）

1. **硬刷新** `/for-demo`（避免 HMR hook 残留）
2. 连续滑 **6 → 7 → 8** 条，Network 可见 loadmore 请求；**第 7 条应自动播放**，无需手点
3. loadmore 请求中：底部出现 **loading**；末条 **不能** snap 到空白全屏
4. loadmore 返回后：当前条 **自动 play**
5. 快速来回滑 5↔6↔7，无 Hooks 报错、无「Maximum update depth」
6. `npm run build` 通过
7. 对照 `CHECKLIST.md` #6、#12 更新备注

---

## 七、给 Agent B 的提交格式

```
## 改动摘要
- P0: syncActiveIndex 事件驱动 pause/play
- P1: loadmore 底部 loading + 完成后补 play

## MD 依据
- §2.5 L3180-3186
- §8.1 L18302-18316

## 未做（及原因）
- ...

## 自测
- [ ] 第 7 条自动播
- [ ] loadmore 底部 loading
- [ ] build 通过
```

---

---

## 八、审核记录

### v2 — 2026-06-09（P0+P1 事件驱动 pause/play）✅

### v3 — 2026-06-09（loadmore 外置 + 队列稳定）✅

| 项 | 结果 |
|----|------|
| loadmore 移至 `ForDemo`（index ≥ len-2） | ✅ |
| 播放器移除 onLoadMore/loadingMore | ✅ |
| items 追加不重绑 scroll effect | ✅ |
| mount effect 不因 initPlayer 引用误销毁 | ✅ |
| active 槽 ignore null + pendingPlayIndex + ensureActivePlay | ✅ |
| 底部 loading 在 for-demo | ✅ |
| `npm run build` | ✅ exit 0 |

*最后更新：2026-06-09 — Agent A 审核 v3*

---

## 九、v4 必做：少并发 + cancel 旧请求（Agent B 执行 / Agent A 审核）

> **根因**：iOS Network 多条 mp4 `(pending)`/`(canceled)` — 3 槽同时 native 拉流，失活槽只 pause 未 cancel。  
> **MD 依据**：§8.8 滑离 pause 保留实例；iOS MD `cancelLoading`/`suspendLoading`；§8.4.4 `_autoCheckPreload` 缓冲够再预加载。

### 禁止

- 新造 PreloadManager / 连接池 / zustand
- 改 ForYouPage / VideoPlayer
- 为 isActive 单独加 useEffect（用 Feed 切条事件 + render ref 对比二选一，优先 Feed）

### P0 — cancel / suspend 失活拉流

| # | 文件 | 要求 |
|---|------|------|
| 1 | 新建 `playback/suspendNativeVideo.ts` | `suspendNativeVideo(video)`：`pause` + `removeAttribute('src')` + 清 `<source>` + `load()`（对标 `_removeVideoSource` / cancel 网络） |
| 2 | 同上 | `resumeNativeVideo(video, url, opts)`：封装现有 `setNativeVideoSrc` |
| 3 | `player/createXgPlayer.ts` 或 `playback/playerLoadingControl.ts` | `suspendPlayerLoading(player)` / `resumePlayerLoading(player, url, autoplay)`：读 `player.video`，native 走 suspend/resume；MSE 尝试 `(player as any).plugins?.mp4?.cancel?.()` 或 `destroy` 前 `video.removeAttribute('src')`，失败可忽略 |
| 4 | `DouyinFeedPlayer.tsx` `syncActiveIndex` | 切条时对 **oldPlayer**：`pausePlayer` + **`suspendPlayerLoading`**；对 **newPlayer**：若曾 suspend 则 **`resumePlayerLoading(url)`** + `ensureActivePlay` |
| 5 | `useDouyinPlayerSlot.ts` `teardownPlayer` | destroy 前 **`suspendPlayerLoading(player)`**（确保 pending 释放） |

### P1 — 有条件预加载（少一路并发）

| # | 文件 | 要求 |
|---|------|------|
| 6 | `DouyinFeedPlayer.tsx` | `preloadGateRef`：默认 false；active player 首次 `playing` 或 `bufferedEnd - currentTime >= 2` 时置 true（**player.on 事件**，非 useEffect 监听 props） |
| 7 | `DouyinFeedPlayer.tsx` | `hasPreload={preloadNext && preloadGate && index === activeIndex + 1}` — 未开门前 **不创建** 下一条 player DOM |

### P2 — 可选（本次可不做）

- 复用池 `l9`（CHECKLIST #14）
- prev 槽 shouldInit 改为 false（抖音保留上一条实例；我们保留 suspend 即可）

### 验收

1. iOS `/for-demo` 连续滑 5+ 条，Network **同时 pending 的 mp4 ≤ 2**（理想 1 条 active）
2. 切走后旧条 mp4 变 **canceled** 或不再新增 pending
3. 新条不再长期 `(pending)` 需手点
4. `npm run build` 通过

### 审核红线

- 未在 `syncActiveIndex` 对 oldPlayer 调用 suspend → 打回
- 下一条仍一 mount 就拉流（无 preloadGate）→ 打回
- 新增 >1 个 playback useEffect → 打回

*Agent A 审核 v4 — 2026-06-09*

| 项 | 结果 |
|----|------|
| P0 suspend/resume + syncActiveIndex | ✅ |
| P0 teardown 前 suspend | ✅ |
| P1 preloadGate + player.on 事件 | ✅（审核补：`buildPlayerSlots` 也传 gate） |
| 红线 / build | ✅ exit 0 |

**审核补改**：`buildPlayerSlots(..., preloadNext && preloadGate)` — 否则 gate 只挡 `hasPreload` 不挡 `shouldInitPlayer`，下一条仍会提前拉流。

---

## 十、v5 必做：数据变 · 身份 + 窗口 + 调度（对齐 MD §8.1 / §2.6 / §8.8）

> **目标**：loadmore append 时当前条继续播；播放器按 **item.id** 登记；滑离 **pause+失活** 不 suspend；仅窗口外 teardown 才 suspend。  
> **MD**：§8.1 `setAwemeList(prev=>[...prev,...deduped])`；§2.6 `isInitPlayer`；§8.8 滑离 pause+setActive(false) 不 destroy；§8.4.4 preloadGate。

### 禁止

- 自创 repull / edge overscroll / 整表 replace 时 silent reset activeIndex
- zustand / Context
- 改 ForYouPage / VideoPlayer
- append 时 teardown **当前 active** player

### P0 — instManager-lite + append 稳定

| # | 文件 | 要求 |
|---|------|------|
| 1 | 新建 `player/playerRegistry.ts` | `register(id, player)` / `unregister(id)` / `get(id)` / `setActiveId(id\|null)` — 对标 instManager **按 awemeId** |
| 2 | `DouyinFeedPlayer.tsx` | `handleSlotPlayerChange`：按 `playbackItemsRef[index].id` 登记 registry；`playerByIndexRef` 保留 |
| 3 | `DouyinFeedPlayer.tsx` | **append 检测**（`items.length` 增大且 `activeIndex` 上 id 不变）：不 reset index、不 teardown active；**ref 过渡**补 `scheduleActivePlay(active)` 一次 |
| 4 | `DouyinFeedPlayer.tsx` | **shrink 检测**：`activeIndex > len-1` 时 clamp 到 `len-1`（render ref，非 useEffect 堆砌） |
| 5 | `syncActiveIndex` | 滑离旧条：**仅 `pausePlayer`**（§8.8 滑离不 destroy）；**禁止**对仍在窗口内将复用的槽 `suspendPlayerLoading` |
| 6 | `useDouyinPlayerSlot.ts` `teardownPlayer` | **保留** destroy 前 `suspendPlayerLoading`（窗口外真清理） |

### P1 — 可选本迭代

| # | 内容 |
|---|------|
| 7 | 最小 `playerReusePool.ts`（按 id 缓存 player 根节点，teardown 时 recycle 非 destroy）— 对标 l9，可标 ⚠️ 简化 |

### 验收（Agent C 测试 + Agent A 审核）

1. 首屏 10 条，滑到 index 6 loadmore append，**当前条不暂停**
2. append 后 `activeIndex` 不变，当前 **同一 id** 继续播
3. 滑到新 append 条可播（Android 必过；iOS 记录是否需手点）
4. `items` 从 10 append 到 20，registry 中 active id 对应 player 未销毁重建
5. `npm run build` 通过
6. CHECKLIST #6 / #14 备注更新

### 审核红线

- append 导致 active player destroy → 打回
- `syncActiveIndex` 滑离仍 `suspendPlayerLoading` → 打回（suspend 仅 teardown）
- 无 `playerRegistry` 按 id 登记 → 打回
- 新增 >2 播放 useEffect → 打回

*Agent A 审核 v5 — 2026-06-09*

| 项 | 结果 |
|----|------|
| P0 playerRegistry 按 id | ✅ |
| P0 append ref + scheduleActivePlay | ✅ |
| P0 shrink clamp | ✅ |
| P0 syncActiveIndex 仅 pause | ✅（grep 无 suspend） |
| P0 teardown suspend 保留 | ✅ |
| build | ✅ exit 0 |
| CHECKLIST #6 / #14 | ✅ 已更新 |

**说明**：Agent C 静态报告在 Agent B 提交前生成，属竞态误报；复核代码后 v5 P0 通过。实机验收项 1–3 待手机 `/for-demo`。
