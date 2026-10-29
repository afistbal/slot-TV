# 幸运转盘接口文档

基础地址：https://i.yogoshort.com/api。用户接口沿用现有登录验证，管理接口沿用 admin 权限验证。统一返回 c、m、d；c=0 成功，非 0 失败。

转盘查询、抽奖是新增接口，待后端实现；不使用 user/tasks。以下 JSON 为结构示例，未配置数值默认 0。福利任务和福利卡片继续使用原 user/tasks 接口。

## POST /api/user/promo/status · 查询转盘

### 请求参数

```json
{}
```

### 返回数据

```jsonc
{
  "c": 0, // 0 成功，非 0 失败
  "m": "", // 错误提示
  "d": {
    "enabled": false, // 活动总开关
    "eligible": false, // 当前账号是否有参与资格，由服务端计算
    "reason": "no_week", // no_week 无活动 / disabled 已关闭 / holdout 无资格
    "peak": false, // true 免费及付费阶段；false 仅可用券
    "peak_ends_at": null, // 免费、付费、赠抽阶段结束时间，带时区 ISO 格式
    "ends_at": null, // 全部活动结束时间，带时区 ISO 格式
    "next_open_at": null, // 下次开放提示时间，无则 null
    "free_max": 0, // 本期免费次数上限
    "free_left": 0, // 当前账号剩余免费次数
    "free_needs_watch": false, // 下次免费抽是否需要先看剧
    "gift_spins": 0, // 当前账号剩余充值赠抽次数
    "gift_spins_per_topup": 0, // 每次有效充值赠抽次数，用于规则展示
    "luck_per_topup": 0, // 每次有效充值增加的好运值，用于规则展示
    "free_guarantee_coupon": false, // 本期免费次数内是否必得充值券
    "tickets": 0, // 当前账号剩余抽奖券
    "paid_max": 0, // 本期付费总抽数上限
    "paid_used": 0, // 当前账号已用付费抽数，十连计 10 次
    "ten_max": 0, // 本期十连组数上限
    "ten_used": 0, // 当前账号已用十连组数
    "ten_price_mult": 0, // 十连价格倍率，总价=round(档位×倍率)
    "coins": 0, // 当前账号可用金币余额
    "bets": [], // 可选金币档位，正整数数组
    "face_free": [], // 免费奖池，奖项结构见下
    "face_ticket": [], // 用券奖池，奖项结构同上
    "face_paid": {}, // 档位金额字符串→奖项数组，赠抽使用 50 档
    "cap_coins": 0, // 每张充值券最多加赠金币
    "winners_coupon": 0, // 本期抽中充值券的人数
    "luck_level": 0, // 当前账号好运等级
    "coupons": [], // 当前账号充值券，列表项结构见下
    "prizes": [] // 当前账号最近 100 条中奖记录，按时间倒序，列表项结构见下
  }
}
```

### face_free、face_ticket、face_paid 奖项

```jsonc
{
  "kind": "coins", // coins 金币 / bonus_pct 充值加赠百分比 / vip_day VIP天数 / luck 好运值
  "v": 0, // 固定奖励数值；可选，有 v 时优先使用 v
  "mult": 0 // 金币倍率；可选，无 v 时金币数=round(mult×档位)
}
```

### coupons 列表项

```jsonc
{
  "id": "", // 充值券 ID
  "pct": 0, // 加赠百分数，15 表示 15%
  "cap": 0, // 本券最多加赠金币
  "expires_at": null // 券过期时间，实际发券必须返回有效时间
}
```

### prizes 列表项

```jsonc
{
  "id": "", // 抽奖记录 ID
  "prize_kind": "coins", // 奖励类型，同 kind
  "prize_value": 0, // 实际奖励数值
  "created_at": null // 中奖时间，带时区 ISO 格式
}
```

### 展示和开放规则

活动时间和资格从本接口获取。enabled=true 且 eligible=true 才允许抽奖；peak=false 时只允许 ticket 模式。当前前端临时保留禁用转盘预览，暂不做提示卡与转盘互斥。

服务端按后台 starts_at、peak_ends_at、ends_at 计算状态：开始前和全部结束后 eligible=false；开始至 peak_ends_at 为 peak=true；peak_ends_at 至 ends_at 为 peak=false。账号还须通过服务端资格校验，不能只依据时间开放。

页面取值：奖池用 face_*；充值券用 coupons；好运等级用 luck_level；本期记录用 prizes；抽奖说明用各次数、档位和充值赠抽配置。心愿清单暂不接入。

## POST /api/user/spin · 执行抽奖

### 请求参数

```jsonc
{
  "p_mode": "free", // free 免费 / paid 单抽 / ten 十连 / gift 充值赠抽 / ticket 用券
  "p_bet": 0 // free、ticket 传 0；paid、ten 传所选金币档位；gift 传 50
}
```

p_mode、p_bet 沿用对标 promo_spin 的原参数名。

### 返回数据

```jsonc
{
  "c": 0, // 0 成功，非 0 失败
  "m": "", // 错误提示
  "d": {
    "draws": [ // 单抽返回 1 项，十连返回 10 项
      {
        "slot_idx": 0, // 当次奖池数组下标，从 0 开始
        "prize_kind": "coins", // 实际奖励类型
        "prize_value": 0 // 实际奖励数值
      }
    ]
  }
}
```

### 扣费和次数

| p_mode | 扣除 | 条件 |
| --- | --- | --- |
| free | 免费次数 1 | peak=true，免费次数及观看条件满足 |
| gift | 赠抽次数 1 | peak=true，赠抽次数足够，使用 50 档奖池 |
| paid | 档位金币，付费抽数 1 | peak=true，档位有效，金币和次数足够 |
| ten | round(档位×ten_price_mult) 金币，付费抽数 10，十连组数 1 | peak=true，金币、付费抽数及十连额度足够 |
| ticket | 抽奖券 1 | 活动有效且券足够，使用用券奖池 |

资格、扣费、扣次、随机结果、保底和发奖由服务端在同一事务完成，失败全部回滚。支持现有请求幂等机制。前端只按 slot_idx 转动；结束后刷新活动、任务和余额，失败不自动重发抽奖请求。

## GET /api/admin/settings · 读取转盘配置

### 请求参数

无。复用现有基础配置列表接口，读取 key=topup_promo 的记录。

### 返回数据

```jsonc
{
  "c": 0, // 0 成功，非 0 失败
  "m": "", // 错误提示
  "d": [
    {
      "id": 0, // 设置记录 ID，编辑时原样传回真实值
      "key": "topup_promo", // 转盘配置键
      "name": "幸运转盘", // 配置名称
      "value": { // 完整配置，字段与下方保存接口的 value 相同
        "enabled": false, // 总开关
        "starts_at": null, // 活动开始时间
        "peak_ends_at": null, // 免费、付费阶段结束时间
        "ends_at": null, // 全部活动结束时间
        "next_open_at": null, // 下次开放提示时间
        "free_max": 0, // 每期免费次数
        "free_watch_min_sec": 0, // 后续免费抽每次需新增的观看秒数
        "paid_max": 0, // 每期付费总抽数
        "ten_max": 0, // 每期十连组数
        "ten_price_mult": 0, // 十连价格倍率
        "bets": [], // 单抽金币档位
        "gift_spins_per_topup": 0, // 每次有效充值赠抽次数
        "luck_per_topup": 0, // 每次有效充值增加好运值
        "ticket_daily_cap": 0, // 每日互动掉券上限
        "coupon_valid_hours": 0, // 充值券有效小时数
        "cap_coins": 0, // 每张券最多加赠金币
        "luck_guarantee_threshold": 0, // 好运保底门槛，0 关闭
        "free_guarantee_coupon": false, // 免费抽是否必得券
        "ten_guarantee": null, // 十连保底规则，null 关闭
        "face_free": [], // 免费奖池
        "face_ticket": [], // 用券奖池
        "face_paid": {} // 档位金额字符串→付费奖池
      }
    }
  ]
}
```

找不到配置时，列表中不返回此记录；前端使用关闭及 0 值初始状态。兼容现有 value 为 JSON 字符串的情况，保存时保持读取到的类型。

## POST /api/admin/settings · 保存转盘配置

### 请求参数

```jsonc
{
  "id": 0, // 编辑时传真实记录 ID；新增时不传本字段
  "key": "topup_promo", // 转盘配置键
  "name": "幸运转盘", // 配置名称
  "value": {
    "enabled": false, // 活动总开关
    "starts_at": null, // 开始时间，带时区 ISO 格式
    "peak_ends_at": null, // 免费、付费、赠抽阶段结束时间
    "ends_at": null, // 用券尾期结束时间
    "next_open_at": null, // 下次开放提示时间
    "free_max": 0, // 每期免费次数
    "free_watch_min_sec": 0, // 首次免费后，每次解锁需新增的观看秒数
    "paid_max": 0, // 每期付费总抽数，十连占 10 次
    "ten_max": 0, // 每期十连组数
    "ten_price_mult": 0, // 十连价格倍率，0 禁用，最大 10
    "bets": [], // 不重复的正整数金币档位
    "gift_spins_per_topup": 0, // 每次有效充值赠抽次数
    "luck_per_topup": 0, // 每次有效充值增加好运值
    "ticket_daily_cap": 0, // 每日互动掉券上限
    "coupon_valid_hours": 0, // 中奖充值券有效小时数
    "cap_coins": 0, // 每张券最多加赠金币
    "luck_guarantee_threshold": 0, // 好运保底门槛，0 关闭
    "free_guarantee_coupon": false, // 本期免费次数内必得充值券
    "ten_guarantee": null, // {kind: 奖励类型, v: 最低数值}；null 关闭
    "face_free": [], // 免费奖池，每项带服务端权重，结构见下
    "face_ticket": [], // 用券奖池，结构同上
    "face_paid": {} // 档位金额字符串→奖项数组，赠抽启用时须有 50 档
  }
}
```

### 管理端奖项结构

```jsonc
{
  "kind": "coins", // coins 金币 / bonus_pct 充值加赠% / vip_day VIP天数 / luck 好运值
  "v": 0, // 固定奖励数值，可选
  "mult": 0, // 金币倍率，可选；有 v 优先使用 v
  "weight": 0 // 服务端相对权重，0 不会抽中；不可下发到用户接口
}
```

### 返回数据

```jsonc
{
  "c": 0, // 0 成功，非 0 失败
  "m": "", // 错误提示
  "d": null // 保存结果沿用现有格式，前端会重新 GET 核对配置
}
```

后台入口：配置管理 → 基础配置后的「转盘配置」。开启前校验 starts_at<peak_ends_at≤ends_at；有效奖池 2～24 项且正权重之和大于 0；十连保底须能在当前池内满足；启用券奖励必须配置有效期和加赠上限。保存不直接发奖，不把权重传给用户端。

## 统一失败返回

```jsonc
{
  "c": 1, // 非 0 表示失败，具体错误码沿用项目约定
  "m": "金币不足", // 可展示的业务错误提示
  "d": null // 失败时无中奖结果
}
```
