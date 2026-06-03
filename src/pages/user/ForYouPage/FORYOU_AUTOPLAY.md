# For You 自动播放与「点按开声」蒙层规则

> 实现：`foryouAutoplayPolicy.ts`（**单一入口** `resolveForyouMountAutoplayFlags`）  
> 消费：`ForYouVerticalSwiper` mount 时算一次，经 props/ref 传给 `ForYouPlayer`

## 总原则

| 场景 | 首条 | 蒙层 | 滑切 |
|------|------|------|------|
| **F5 / 刷新落在 For You** | 静音自动播 | 展示 | 有声 |
| **首页/底栏/顶栏点 For You** | 有声自动播 | 不展示 | 有声 |
| **直链 / 书签首次打开 `/foryou`** | 静音自动播 | 展示 | 有声 |

**不要**用「整页生命周期内恒为 true 的 `isDocumentReload()`」反复判断 SPA 路由，否则会：F5 后从首页进仍静音，或刷新后仍当 fromHome 有声失败变暂停。

## 实现要点（互不覆盖）

1. **文档 F5**：`isDocumentReload()` 为 true 时，向 `sessionStorage` 写入 `foryou-reload-landing=1`（模块加载时一次）。
2. **`ForYouVerticalSwiper` 首次 mount**：调用 `consumeForyouReloadLanding()`，至多消费一次为 `reloadLanding`。
3. **`reloadLanding === true`**（F5 当次落页）  
   - `fromHomeVideoPlayback = false`（**不信任** 刷新残留的 `location.state`）  
   - `feedColdAutoplay = true` → 静音 + 蒙层  
4. **`reloadLanding === false`**（SPA 从首页进、直链等）  
   - `fromHomeVideoPlayback` = `VIDEO_FROM_HOME_STATE` **或** `canNavigateBack()`  
   - `feedColdAutoplay = !fromHome && !canNavigateBack()`  
5. 首条 `loadEpisode` 结束后 `feedColdAutoplayRef.current = false`；滑切不再冷启动。

## 与 `/video` 对齐

- 共用 `VIDEO_FROM_HOME_STATE`、`hasVideoSessionUserUnmuted()`
- For You 冷启动范围比 `/video` 多「直链无历史」；刷新判定用 **一次性 reload landing**，不用会污染 SPA 的 API

## 自测（两项必须同时通过）

- [ ] 首页 → 底栏 For You：**有声**，无蒙层  
- [ ] 在 For You **F5**：**静音**在播（非暂停），有蒙层  
- [ ] F5 后 → 首页 → 再点 For You：**有声**（`reloadLanding` 已消费，不再冷启动）  
- [ ] 滑下一条：有声，无蒙层  
