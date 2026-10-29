# 邀请奖励接口

邀请卡片（个人中心 PC/H5、推广页）与推广资格统一读取 POST /api/user/affiliate，请求体为 {}，身份沿用现有鉴权。同账号并发读取合并，切换账号分别请求。不再请求不存在的 /api/user/invite。

## 当前返回字段

| 字段 | 展示口径 |
| --- | --- |
| onceInviteReward | 每邀请一人奖励金币，优先于旧 config.signup_inviter |
| inviteDepositRate | 有效邀请充值奖励比例；已确认实际返回 0.15，前端乘 100 显示 15%。旧 config.purchase_pct 保持百分数口径 |
| inviteTaskReward | 完成邀请任务奖励金币，配置金额不代表已到账 |
| registerReward | 注册奖励，收进卡片说明与规则，不另起一行占用空间 |
| gateNetUsdCents / invitedCents | 邀请好友累计充值门槛 / 当前累计充值；按现有接口契约使用人民币分，20000 显示为 ¥200.00 |
| gatePayers / payers | 有效邀请付费人数门槛 / 当前人数；不使用 invitedCount 替代 |
| gateAccountDays / accountDays | 账号天数门槛 / 当前天数；门槛大于 0 时加入任务条件 |
| invitedCount | 已邀请总人数 |
| state | 推广资格状态 in_progress / active，不用于断言任务奖励已到账 |
| earnedCoins / pendingCoins | 可选的真实累计到账 / 待结算金币；没有 earnedCoins 时使用 inviteDepositReward 单独展示充值奖励金币，不推算累计总额 |
| inviteDepositReward | 接口返回的充值奖励金币，0 也显示；不当作所有邀请奖励累计总额 |
| referralCode | 分享码；缺失沿用现有 UID 分享链接 |
| rewardMode | 显式 coins / cash；不根据 active 猜测奖励发放情况 |

门槛和奖励全部使用后端配置，不硬编码 200、5 或任何奖励金额。任务进度取各项正数门槛进度的最小值；所有有效条件满足才显示条件已达成，不显示已发放或已领取。全零门槛不会自动判定完成。

兼容 camelCase / snake_case 字段及旧 config 的邀请配置和里程碑。新字段为 0 时优先使用 0，不回退旧配置。旧 config.signup_invitee 仍为明确的好友奖励来源。

## 失败处理

页面不新增失败提示、重试按钮、HTTP 状态、接口地址、JSON 或调试说明；失败时保留本账号当前数据，由现有请求层处理接口错误。

## 服务端仍需提供

实际到账 / 待结算统计、任务奖励结算状态或明确的领取协议仍需要服务端支持。本次只调整读取与展示，不创建发奖、领取或结算接口。
