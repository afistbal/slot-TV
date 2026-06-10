# v-demo 实施规格（Agent B）

> **一句话**：v-demo = **for-demo 同一套壳**（PC/H5 + 公共 UI + `douyin-feed-player`），只换 **数据层**（`movie/info` + `batch` + `movie/episode`）。  
> **红线**：不改 `src/components/douyin-feed-player/` 内部 JS。

---

## 0. for-demo vs v-demo（先看这个）

| 维度 | for-demo | v-demo |
|------|----------|--------|
| 页面壳 | `ForDemo/index` + `ForDemoPc/H5PlayerShell` | **`VDemo/index` + `VDemoPc/H5PlayerShell`（复制 for-demo 改数据源）** |
| 公共 UI | `src/components/video-player/*`、`FeedPlayerBottomInfo` | **同一套**；v-demo 侧栏要 **开 List** |
| 播放器 | `DouyinFeedPlayer` | 同上；PC **单条** `items={[current]}`（与 for-demo PC 一致） |
| 数据 API | `GET foryou` 推荐流 | **`movie/info` → `movie/episodes/batch` → 每次 active `movie/episode`** |
| 滑动单位 | 推荐 **条** | 同一剧 **集**（episodes 列表） |
| 底栏 | info + Watch Full | info + **Ep.N**（无 Watch Full） |
| 预加载窗口 | feed 自带 | **上 1 下 2**（见 §4，与 /video ±1 不同） |

**实施顺序建议**：P0 接口 + 裸播 → 复制 for-demo 壳接公共组件 → 锁集/选集抽屉。

---

## 1. 任务清单

### P0 — 数据与路由（先做）

- [ ] App 路由：`v-demo/:id/:episode?`（`App.tsx`）
- [ ] `vDemoRoute.ts` 补 `buildVDemoPath(movieId, episodeNo?)`
- [ ] for-demo Watch Full → `navigate(buildVDemoPath(feedItem.id, feedItem.episode ?? 1))`（**仅改 shell 一行**，不要新建 `src/lib/` 跳转文件）
- [ ] `/foryou` 仍跳 `/video`，不动
- [ ] `fetchVDemoMovieInfo` — 已有，补类型 `info.play` / `episodes[].vip|locked`
- [ ] `fetchVDemoEpisodesBatch` — batch 请求 + **内存缓存**（§4）
- [ ] **新建** `fetchVDemoEpisode.ts` — active 时 `movie/episode`
- [ ] **新建** `vDemoPreloadWindow.ts` — 上1下2 窗口（替换现有 ±1）
- [ ] `vDemoEpisodeQueue.ts` — 编排 + `buildVDemoFeedItems`
- [ ] `VDemo/index.tsx` — 串流程 + URL replace

### P1 — 壳层（与 for-demo 对齐，可紧接 P0）

- [ ] `VDemoPcPlayerShell` / `VDemoH5PlayerShell` — **复制** `ForDemo*PlayerShell`，换 `IPlayerData` + v-demo 队列
- [ ] 公共组件：`VideoPlayerSideActions`（`showEpisodeList`）、`VideoPlayerPcEpisodeNav`、`FeedPlayerBottomInfo`、unmute 蒙层
- [ ] 底栏组件：用 `FeedPlayerBottomInfo`，**不要** `ForDemoFeedControlsTop`（含 Watch Full）

### P2 — 后续

- [ ] 锁集 UI、选集抽屉（复用 `VideoPage` / overlays）
- [ ] unmute hook 去 `forDemo` store 耦合

---

## 2. for-demo → v-demo 跳转

**不要**单独建 `src/lib/navigateToVDemo.ts`。路由工具只在 constants：

```typescript
// src/constants/vDemoRoute.ts
export function buildVDemoPath(movieId: number, episodeNo?: number): string {
  if (episodeNo != null && episodeNo > 0) {
    return `${V_DEMO_PATH}/${movieId}/${episodeNo}`;
  }
  return `${V_DEMO_PATH}/${movieId}`;
}
```

ForDemo shell 内（与现有 `navigateFromForyouToVideo` 同级写法）：

```typescript
import { buildVDemoPath } from '@/constants/vDemoRoute';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';

// handleWatchFullSeries
navigate(buildVDemoPath(feedItem.id, feedItem.episode ?? 1), {
  state: VIDEO_FROM_HOME_STATE,
});
```

URL 语义：

- `/v-demo/1488` — 起播集 = `info.play` 或 1
- `/v-demo/1488/3` — 第 **3 集**（`episode` 字段，**不是** row id `32062`）

---

## 3. `movie/info`（首屏）

```http
POST movie/info
{ "id": 1488 }
```

### 样例（关键字段）

```json
{
  "info": {
    "id": 1488,
    "title": "The Genius Returns",
    "image": "...webp",
    "introduction": "...",
    "favorite": 503,
    "is_favorite": 0,
    "is_rename": 0,
    "play": 1
  },
  "tags": [{ "name": "...", "unique_id": "modern" }],
  "episodes": [
    { "id": 32060, "episode": 1, "image": "", "vip": 0, "locked": 1 },
    { "id": 32070, "episode": 11, "image": "", "vip": 1, "locked": 1 }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `episodes[].id` | **row id** → batch / episode 请求参数 |
| `episodes[].episode` | **集序号** → URL、UI |
| `episodes[].vip` | **0/1** → 非 VIP 预加载窗口是否缩 forward |
| `episodes[].locked` | **0/1** → info 列表锁态初判 |
| `info.play` | URL 无 `:episode` 时起播集序号 |

- episodes 按 `episode` 升序排序后使用。
- info 阶段 **不拉** mp4/vtt。

---

## 4. `movie/episodes/batch`

### 与 /video 的差异

| | /video | v-demo |
|---|--------|--------|
| 窗口 | ±1 | **上 1 下 2**（第 1 集：**上 0 下 2**） |
| API | 单集 `movie/episode` | **`movie/episodes/batch`** 批量 mp4/vtt |
| 非 VIP + forward 遇 `vip:1` | — | forward **只下 1**，不下 2 |

### 请求

```json
{
  "movie_id": 1488,
  "id": [32060, 32061, 32062]
}
```

- `id` = 当前窗口内所有集的 **row id**（数组）。
- **窗口算出来几个 id 就传几个，不必因本地已有缓存而删减请求参数**（全集最多 ~100 集，重复传无妨；服务端幂等即可）。
- 到 **末尾** clamp 后窗口不足则少传；**窗口 id 为空**则不请求。

### 响应

```json
{
  "c": 0,
  "d": {
    "maps": {
      "32060": {
        "episode": 1,
        "video": "xxx.mp4",
        "subtitle": "",
        "vip": 0,
        "lock": false,
        "unlock_coins": 30
      }
    }
  }
}
```

### `detailCache` 是干嘛的？

`fetchVDemoEpisodesBatch.ts` 里的 **内存 Map**（当前代码名 `detailCache`）：

- batch **返回后**把 `maps[rowId]` 写入本地，供 `buildVDemoFeedItems` 读 **mp4 文件名 / subtitle**。
- 避免同一页面生命周期内重复解析、且滑集时立刻有 url 可播。
- **不是**用来「请求前删掉已有 id」的；请求按窗口全量发，响应 **merge/覆盖** 进 cache 即可。

### 预加载窗口算法（`vDemoPreloadWindow.ts`）

```
输入：activeIndex, episodes[], viewerIsVip
输出：row id[]（直接作为 batch 的 id 参数）

prev = activeIndex > 0 ? 1 : 0
next = 2
若 !viewerIsVip 且 (episodes[activeIndex+1]?.vip === 1 或 episodes[activeIndex+2]?.vip === 1):
  next = 1
next = min(next, total - 1 - activeIndex)

return episodes[i].id，i ∈ [activeIndex - prev, activeIndex + next]
```

**示例**

| 观众 | active 集 | 窗口集序号 | batch 传的 row id |
|------|-----------|------------|-------------------|
| 任意 | 1 | 1,2,3 | 三集的 id **全传** |
| 任意 | 2 | 1,2,3,4 | 四集的 id **全传** |
| 非 VIP | 9，10 免费 11 vip | 8,9,10,11（next 缩为 1） | 窗口内 id **全传** |
| VIP | 59（末 2 集） | 58,59,60 | 最多 3 个 id |

---

## 5. `movie/episode`（每次 active）

**每次**滑到 active（含首屏）都请求，刷新 **展示态**。

```json
{ "id": 32060, "auto_unlock": 0 }
```

- `id` = 当前集 row id。
- `auto_unlock`：VIP → `0`，非 VIP → `1`（同 `/video` `episodeDetailCache.ts`）。
- **lock 展示以本接口为准**，归一：`isEpisodeDetailLocked()`（`videoPlayerUtils.ts`）。

### batch vs episode 分工

| API | 职责 |
|-----|------|
| batch | 窗口内集的 **mp4 + subtitle** |
| episode | **active 集** lock / can_unlock / unlock_coins 等展示态 |

### 编排

```typescript
async function syncVDemoOnActiveIndex(movieId, episodes, activeIndex, viewerIsVip) {
  await syncVDemoActiveEpisode(episodes, activeIndex, viewerIsVip);   // movie/episode
  await syncVDemoBatchPreload(movieId, episodes, activeIndex, viewerIsVip); // batch
  // 然后 buildVDemoFeedItems → setItems
}
```

### `buildVDemoFeedItems` 映射

```
episodeDetail = episode 缓存（movie/episode）
batchDetail   = batch 缓存（detailCache）

locked = episodeDetail
  ? isEpisodeDetailLocked(episodeDetail.lock)
  : row.locked === 1 || isEpisodeDetailLocked(batchDetail?.lock)

url = locked ? '' : (batchDetail.video 或 episodeDetail.video)
subtitle = batchDetail.subtitle ?? episodeDetail.subtitle ?? ''
```

锁集：`url` 空，暂不播；P2 接 lock UI。

---

## 6. `VDemo/index.tsx` 流程

```
1. params :id / :episode
2. fetchVDemoMovieInfo(movieId)
3. startIndex = url episode ?? info.play ?? 1 → 在 episodes 里找 index
4. syncVDemoOnActiveIndex(..., startIndex, viewerIsVip)
5. setItems(buildVDemoFeedItems(episodes))
6. 有壳后：VDemoPc/H5PlayerShell + DouyinFeedPlayer
   （暂无壳：可先裸 DouyinFeedPlayer，与现码相同）
7. onIndexChange:
   - setActiveIndex
   - navigate(buildVDemoPath(id, episodes[i].episode), { replace: true })
   - syncVDemoOnActiveIndex(...)
8. 换剧 clearVDemoEpisodeCache + clear episode 缓存
9. 去掉 DEFAULT_MOVIE_ID 硬编码
```

---

## 7. lock / vip 红线

1. **info `vip/locked`**：列表初判 + **batch 窗口 forward 是否遇 vip 档**（读 info，不读 batch）。
2. **batch `lock`**：是否有 mp4、是否写入 detailCache。
3. **movie/episode `lock`**：active **展示唯一可信**。
4. 统一 `isEpisodeDetailLocked()`，勿混用 boolean / 0 / 1 手写判断。

---

## 8. 文件地图

| 路径 | 说明 |
|------|------|
| `src/constants/vDemoRoute.ts` | `buildVDemoPath`、layout 用 `isVDemoPathname` |
| `src/pages/user/ForDemo/ForDemo*PlayerShell.tsx` | **只改** Watch Full → `buildVDemoPath` |
| `src/pages/user/VDemo/fetchVDemoMovieInfo.ts` | info |
| `src/pages/user/VDemo/fetchVDemoEpisodesBatch.ts` | batch + detailCache |
| `src/pages/user/VDemo/fetchVDemoEpisode.ts` | **新建** episode |
| `src/pages/user/VDemo/vDemoPreloadWindow.ts` | **新建** 窗口算法 |
| `src/pages/user/VDemo/vDemoEpisodeQueue.ts` | 编排 + feed 映射（**删 ±1 依赖**） |
| `src/pages/user/VDemo/index.tsx` | 入口 |
| `src/components/video-player/*` | 侧栏 / nav / unmute（已存在，v-demo 壳里引用） |
| `src/components/feed/FeedPlayerBottomInfo` | 底栏 info |

**不要新建** `src/lib/navigateToVDemo.ts`。

---

## 9. 自测

- [ ] for-demo Watch Full → `/v-demo/{剧id}/{集序号}`
- [ ] `/v-demo/1488/1` info + 第 1 集 active
- [ ] `/v-demo/1488` 按 `info.play` 起播
- [ ] 第 1 集 active：batch `id` 为 3 个 row id（上0下2）
- [ ] 第 2 集 active：batch `id` 为窗口内 **4 个 row id 全传**（不要求「只补第 4 集」）
- [ ] 非 VIP 近 VIP 档：forward 窗口 next=1
- [ ] 每次滑集：Network 有 `movie/episode`（active row id）
- [ ] 锁集无 url；未改 douyin-feed-player JS

---

## 10. 参考（只读）

```
for-demo 壳（v-demo 复制改数据）：
  src/pages/user/ForDemo/index.tsx
  src/pages/user/ForDemo/ForDemoPcPlayerShell.tsx
  src/pages/user/ForDemo/ForDemoH5PlayerShell.tsx

/video lock（v-demo 对齐）：
  src/pages/user/VideoPage/videoPlayerUtils.ts
  src/pages/user/VideoPage/episodeDetailCache.ts

现 v-demo（需改 ±1 → 上1下2）：
  src/pages/user/VDemo/vDemoEpisodeQueue.ts
  src/pages/user/VDemo/fetchVDemoEpisodesBatch.ts
  src/pages/user/VDemo/index.tsx
```
