# TikTok Minis 前后端接口合同（首版）

> 状态：待后端确认。本文定义的是**本站前端调用本站后端**的接口；TikTok OAuth、BytePlus 和支付平台接口只能由后端调用。

## 约束

- 所有接口沿用现有 API 响应外壳：`{ c: number, m?: string, d: T }`，`c === 0` 代表成功。
- 前端不得收到或存储 TikTok `client_secret`、TikTok `access_token`、`refresh_token`。
- TikTok 登录 `code` 是一次性、短期票据；前端获得后立即提交，失败时重新调用 `TTMinis.login()`，不得重放。
- H5 现有的 `login/anonymous`、`login/email`、`login/uid`、`pay/create` 和视频 URL 接口保持不变。

## 1. 静默登录（BE-01）

### 前端 -> 本站后端

`POST /api/tiktok/login`

```json
{
  "code": "AuthorizationCode from TTMinis.login()"
}
```

### 成功响应

```json
{
  "c": 0,
  "d": {
    "token": "本站现有会话 token",
    "info": {
      "uid": "本站用户 ID",
      "anonymous": 0
    },
    "is_new_user": true
  }
}
```

`info` 必须满足当前 `useUserStore.signin()` 所使用的字段形状；前端会把 `token` 继续写入既有 `localStorage.token`，使现有收藏、进度、余额接口无需改协议。

### 后端必须完成

1. 用服务器保存的 `client_key`、`client_secret` 及 code，调用 TikTok `POST https://open.tiktokapis.com/v2/oauth/token/`，`grant_type=authorization_code`。
2. 以当前 TikTok 应用下的 `open_id` 建立唯一映射到本站用户。
3. 加密保存 TikTok 的 `access_token`、`refresh_token` 和过期时间；在到期前刷新。
4. 对 code 做一次性幂等/重放防护，并记录可审计的失败原因；不得记录 `client_secret`。

## 2. TikTok 播放数据（BE-02）

### 前端 -> 本站后端

`GET /api/tiktok/minis/episodes/{episodeId}/playback`

需携带本站既有登录 token。`episodeId` 使用本站剧集 ID，不直接暴露 BytePlus 管理主键。

### 成功响应

```json
{
  "c": 0,
  "d": {
    "album_id": "TikTok drama/album ID",
    "episode_id": "TikTok episode ID",
    "vid": "BytePlus video ID",
    "play_auth_token": "短期播放凭证，可为空",
    "subtitle": {
      "language": "en",
      "url": "https://approved-cdn.example/subtitles/en.vtt"
    }
  }
}
```

### 后端必须完成

- 维护本站剧/集 ID 与 TikTok `album_id`、`episode_id`、BytePlus `vid` 的映射。
- 仅对已登录、有权观看且已审核上架的剧集返回数据。
- 较旧 TikTok 客户端需要时，后端使用已保存的 TikTok token 获取短期 `play_auth_token`；不得把长期 TikTok token 返回前端。

## 3. 权益与商品（BE-03，变现方案确定后）

当前 TikTok 首发固定采用 IAA 奖励广告；IAP 前端实现保留但不展示，后续可通过
`VITE_TIKTOK_MONETIZATION_MODE=iap` 恢复。现有 Web H5 支付流程不变。

最小接口清单：

| 接口 | 目的 |
| --- | --- |
| `GET /api/tiktok/minis/products` | 返回 TikTok 可售商品和 TikTok SKU，不返回 H5 支付参数。 |
| `POST /api/tiktok/minis/orders` | 创建本站订单并返回 TikTok `TTMinis.pay` 所需参数。 |
| `GET /api/tiktok/ads` | 返回后台已启用的 TikTok 广告位集合。 |
| `POST /api/movie/episode/tiktok-ad/start` | 创建短期广告解锁会话。 |
| `POST /api/movie/episode/tiktok-ad/complete` | 完成广告解锁并返回剧集播放数据。 |
| TikTok -> 后端 webhook | 订单状态回调验签、幂等入账、补单。 |

当前 TikTok 奖励广告解锁流程：

1. 进入 TikTok 应用并完成登录后，调用 `GET /api/tiktok/ads` 获取已启用广告位。
2. 滑动即将进入锁定剧集时，调用 `POST /api/movie/episode/tiktok-ad/start`，发送
   `episode_id` 和 `ad_id`，提前获取短期 `unlock_token`。
3. 客户端通过 `TTMinis.createRewardedVideoAd({ adUnitId })` 展示广告。
4. 仅当广告关闭结果为 `isEnded=true` 时，调用
   `POST /api/movie/episode/tiktok-ad/complete`，发送 `episode_id`、`ad_id` 和 `unlock_token`。
5. `complete` 成功响应直接返回包含 `lock=false` 和播放地址的 `IPlayerEpisode`，前端不再调用旧的
   `POST movie/episode` 广告解锁分支。

TikTok 当前没有公开的广告完成服务端验签凭证，因此后端仍需按用户、剧集、广告位和短期凭证做幂等与频控。

## 4. 前端接入顺序

1. 后端部署第 1 节测试环境后，前端接入 `TTMinis.login()` 并替换 TikTok 版的匿名登录分支。
2. 后端和内容方准备第 2 节的一集审核视频后，前端接 VePlayer；H5 播放器不改。
3. 产品确定变现和后端完成第 3 节后，前端接 TikTok 支付/广告 UI；H5 收银台不改。

## 5. 后端交付验收

- 同一 TikTok 账号重复登录，稳定映射到同一本站用户。
- 失效、重放、过期 code 均拒绝，前端可重新登录。
- 无权限或未审核剧集无法获得播放数据。
- 接口日志、数据库、前端响应中均不泄露 TikTok 密钥和长期 token。
