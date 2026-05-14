# 接口文档（App / 安卓可直接对接）

下面每一条都按同一格式写。**页面**是 Web 路由，方便你们对照；你们做 App 只要看**接口路径 + 请求方式 + 参数 + 返回**即可。

---

## 一、所有接口通用规则（先看这一段）

**根地址怎么拼**

- 配置里的「API 根」：`VITE_API_BASE_URL`（没有配就用默认 `https://test.yogoshort.com/api`）。
- 实际请求地址 = **根地址** + **接口路径**。  
  例：根是 `https://xxx.com/api`，接口写 `movie`，则请求 `https://xxx.com/api/movie`（根末尾有没有 `/` 前端会自动处理，你们保证最终拼出来是合法 URL 即可）。

**Token 存哪个字段**

- Web 存在本地：`localStorage`，键名 **`token`**（字符串）。
- 安卓：你们自己存（SharedPreferences / DataStore 等），**存的内容就是后端下发的 JWT 字符串**，和 Web 的 `token` 是同一个东西。

**Token 怎么传给后端**

- HTTP 请求头：`Authorization: Bearer ` + token 值  
  例：`Authorization: Bearer eyJhbGciOi...`

**统一返回长什么样**

- 根是一个 JSON 对象，固定三个字段：
  - **`c`**：数字，`0` 表示成功，非 `0` 表示失败。
  - **`m`**：文字说明（失败时的提示）。
  - **`d`**：真正数据；失败时经常是 `null`。
- 下文说的「返回」都指 **`d` 里面有什么**（除非写「整包」）。

**GET 和 POST 区别（安卓照做）**

- **GET**：参数放在 **URL 问号后面**（`?key=value&...`）。
- **POST**：参数放在 **请求体**，一般是 **JSON**（`Content-Type: application/json`）。

**分页列表常见结构（很多接口的 `d` 长这样）**

- `current_page`：当前第几页  
- `per_page`：这一页多少条  
- `count`：一共多少条（有时没有）  
- `data`：本页数据数组  

---

## 二、按接口写（格式固定）

---

### 1

**页面：**应用一打开、全站初始化（对应 Web 根布局）

**接口：**`config`

**请求方式：**GET（无参数）

**参数：**无

**Token：**要传（若用户未登录，可先匿名拿到 token 再调，见 `login/anonymous`）

**返回参数 `d`（常用字段）：**

- `static`：图片/静态文件前缀，拼海报 URL 用  
- `adjust`：统计 SDK 用，App 可忽略或按你们产品要求接  
- 其它：运营开关、像素等，以后端为准  

---

### 2

**页面：**应用一打开；退出登录后；顶栏退出再匿名（多处）

**接口：**`login/anonymous`

**请求方式：**GET

**参数：**无

**Token：**可不传或传旧的；成功后用返回里的新 token 覆盖本地

**返回参数 `d`：**

- `token`：新的 JWT，**存起来当 Token**  
- `info`：当前用户信息（是否游客、uid、是否 VIP 等，字段以后端为准）  

---

### 3

**页面：**App 已有 token 时刷新用户信息（Web 启动、支付成功后会调）

**接口：**`login/token`

**请求方式：**POST，body JSON

**参数：**

- `token`：当前保存的 JWT 字符串  

**Token：**body 里已经带了 `token`；请求头里照常 `Bearer` 带同一条也行，以后端为准  

**返回参数 `d`：**  
可能是「用户信息对象」本身，也可能是包一层 `{ "info": { ... } }`，两种前端都认；**以 `info` 为准更新本地用户资料**。

---

### 4

**页面：**`/page/login` 邮箱登录

**接口：**`login/email`

**请求方式：**POST，body JSON

**参数：**

- `email`：邮箱  
- `code`：6 位邮箱验证码  
- `anonymous_id`：可选；游客升级正式号时，把当前匿名用户的 uid 传过来（绑定用）  

**Token：**一般先匿名有 token 再登录  

**返回参数 `d`：**

- `token`：登录成功后的 JWT  
- `info`：用户信息  
- `is_new`：是否新用户  
- `password`：部分内嵌 WebView 场景用，可忽略  

---

### 5

**页面：**`/page/login` 发邮箱验证码

**接口：**`login/email/code`

**请求方式：**POST，body JSON

**参数：**

- `email`：邮箱  

**Token：**视后端要求  

**返回参数 `d`：**成功只看 `c===0` 即可  

---

### 6

**页面：**`/page/login` Google / Firebase 登录

**接口：**`login/uid`

**请求方式：**POST，body JSON

**参数（常见）：**

- `uid`：第三方用户唯一 ID  
- `anonymous`：是否匿名账号，`1` 或 `0`（Web 弹窗登录会带）  
- `name`、`email`、`provider`：展示与渠道（Web 会带）  
- `anonymous_id`：可选，游客绑定用  

**Token：**视后端要求  

**返回参数 `d`：**

- `token`  
- `info`  

---

### 7

**页面：**`/` 首页

**接口：**`home`

**请求方式：**GET，URL 参数

**参数：**

- `topSize`：可选；Web 首页传 `"20"` 控制顶部轮播条数  

**Token：**要  

**返回参数 `d`：**

- `top`：顶部 Banner 列表  
- `recommend`：推荐区  
- `rank`：排行区  
- `continueWatching`：继续看  
- `shelves`：货架区块  
- 每条片子常见：`id`、`title`、`image`、跳转用的 slug 等（以后端字段为准）  

---

### 8

**页面：**`/` 首页瀑布流；`/search` 搜索；`/shelf/...` 货架；顶栏搜索联想；下载工具页扫库

**接口：**`movie`

**请求方式：**GET，URL 参数

**参数：**

- `page`：第几页，从 1 开始  
- `keyword`：搜索关键字（纯标签筛选时 Web 会传空字符串）  
- `tag`：按标签筛  
- `shelf_id`：货架数字 ID（有则传）  
- `shelf_slug`：货架 slug 字符串（有则传）  

**Token：**要  

**返回参数 `d`：**分页结构；`data` 里每条常见 `id`、`title`、`image`、`views` 等  

---

### 9

**页面：**`/search` 搜索页标签

**接口：**`movie/tags`

**请求方式：**GET

**参数：**无

**Token：**要  

**返回参数 `d`：**数组，每项里有 `unique_id` 等，用来点标签筛片  

---

### 10

**页面：**`/page/week-data` 一周更新表

**接口：**`movie/listnew`

**请求方式：**GET，URL 参数

**参数：**

- `daterange`：一个 **JSON 字符串**，里面是长度为 2 的时间数组，表示起止时间，例如：`["2026-01-01 00:00:00","2026-01-08 00:00:00"]`  

**Token：**要  

**返回参数 `d`：**分页；`data` 里每条可能还带嵌套列表 `list`（多集）、标题、更新时间等  

---

### 11

**页面：**`/video/:id/...` 竖滑视频播放页（进页拉影片信息）

**接口：**`movie/info`

**请求方式：**GET，URL 参数

**参数：**

- `id`：影片 ID（整数）  

**Token：**要  

**返回参数 `d`：**

- `info`：影片基础信息：`id`、`title`、`image`、`favorite`、`is_favorite`、`introduction` 等  
- `tags`：标签数组  
- `episodes`：分集列表；每集有 `id`（分集记录 id）、`episode`（第几集）、`vip`、`locked`  

---

### 12

**页面：**`/video/:id/...` 竖滑视频播放页（播某一集时拉播放地址）

**接口：**`movie/episode`

**请求方式：**GET，URL 参数

**参数：**

- `id`：分集记录 id（**不是**集序号，是 `movie/info` 里 `episodes[].id`）  
- `auto_unlock`：是否自动花金币解锁；Web 用本地配置，默认当 `1`  

**Token：**要  

**返回参数 `d`：**

- `id`、`episode`：分集标识  
- `video`：播放地址（单条）  
- `video_urls`：多条播放地址（有则优先用这个）  
- `subtitle`：字幕  
- `lock`：是否锁集  
- `unlock_coins`：解锁要多少币  
- `can_unlock`：能不能花币解锁  

---

### 13

**页面：**`/video/...` 播放页点心形；`/my-list` 收藏/历史里点心

**接口：**`movie/favorite`

**请求方式：**POST，body JSON

**参数：**

- `id`：**影片 ID**（`movie_id`）  
- `time`：当前播放秒数；在列表里取消收藏时 Web 传 `0`  

**Token：**要  

**返回参数 `d`：**看 `c===0` 即可  

---

### 14

**页面：**`/my-list` 收藏夹删一条

**接口：**`movie/favorite/delete`

**请求方式：**POST，body JSON

**参数：**

- `id`：**收藏记录**那一行的 id（不是影片 id）  

**Token：**要  

**返回参数 `d`：**看 `c===0`  

---

### 15

**页面：**`/my-list` 收藏列表

**接口：**`movie/my-list`

**请求方式：**GET，URL 参数

**参数：**

- `page`：页码  

**Token：**要  

**返回参数 `d`：**分页；行里有 `movie_id`、`image`、行 `id` 等  

---

### 16

**页面：**`/my-list/history` 观看历史

**接口：**`movie/history`

**请求方式：**GET，URL 参数

**参数：**

- `page`：页码  

**Token：**要  

**返回参数 `d`：**分页；行里有 `movie_id`、进度、集数相关字段等  

---

### 17

**页面：**`/my-list/history` 删一条历史

**接口：**`movie/history/delete`

**请求方式：**POST，body JSON

**参数：**

- `id`：**历史记录**那一行的 id  

**Token：**要  

**返回参数 `d`：**看 `c===0`  

---

### 18

**页面：**`/episodes/:slug` 外链式剧集阅读页（slug 能解析出书 id、章节 id 时）

**接口：**`video/book/getChapterContent`

**请求方式：**GET，URL 参数

**参数：**

- `book_id`：书 id  
- `chapter_id`：章节 id  

**Token：**要  

**返回参数 `d`：**  
结构后端可能二选一：要么数据在 `d.data` 里，要么直接在 `d` 上。常用字段：`video_url`/`video`、`subtitle_url`/`subtitle`、`serial_number`、`chapter_desc`、`unlock_cost`、`like_count`、`chapter_count`、`coin_balance` 等（以实际 JSON 为准）。  

---

### 19

**页面：**`/shopping` 购物；个人中心充值；播放页解锁弹窗等

**接口：**`product`

**请求方式：**GET，URL 参数

**参数：**

- `from`：场景字符串，如 `shopping`、`video`、`unlock`  
- `type`：常写 `10` 表示要「扩展商品包」（订阅 + 金币包一起回来）；有的页面不传  

**Token：**要  

**返回参数 `d`：**数组。每项常见：`id`、`type`（1 订阅 2 金币等）、`name`、`price`、`renewal_price`、`coin` 等  

---

### 20

**页面：**`/profile`；购物页；解锁弹窗

**接口：**`user/balance`

**请求方式：**GET

**参数：**无

**Token：**要  

**返回参数 `d`：**一个数字 = 当前金币余额  

---

### 21

**页面：**`/page/my-balance` 金币流水

**接口：**`user/balance/history`

**请求方式：**GET

**参数：**无

**Token：**要  

**返回参数 `d`：**数组。每项常见：`type`（1 充值等）、`change`（变动值正负）、`amount`（余额展示）、`created_at`、`movie_id`、`episode_index`（可选）  

---

### 22

**页面：**`/shopping` 已是会员时展示续费信息

**接口：**`user/membership`

**请求方式：**GET

**参数：**无

**Token：**要  

**返回参数 `d`：**

- `amount`：续费金额（展示用字符串）  
- `renewal_at`：续费时间  

---

### 23

**页面：**`/shopping` 发起支付；VIP/金币弹窗；`/airwallex/:id`；Apple Pay 流程第一步

**接口：**`pay/create`

**请求方式：**POST，body JSON

**参数：**

- `payment`：支付方式码：`1` Apple 系、`2` Google 系、`3` 银行卡等（与后端约定一致即可）  
- `product_id`：商品 id（来自 `product` 列表）  
- `redirect`：支付完成浏览器回跳的页面地址（App 若不用网页支付可问后端填什么）  

**Token：**要  

**返回参数 `d`（常用）：**

- `env`：`prod` / `demo`  
- `pi`：支付意图 id  
- `client_secret`  
- `customer_id`  
- `currency`  
- `amount` / `amount_major` / `pay_amount` / `price`：金额相关，取你们 SDK 需要的那个  
- `success_url`、`fail_url`：网页收银台用  

---

### 24

**页面：**`/page/pay` 支付结果页（Airwallex 回跳）

**接口：**`pay/complete`

**请求方式：**POST，body JSON

**参数：**

- `sn`：回跳 URL 里的订单流水号  

**Token：**要  

**返回参数 `d`：**看 `c===0` 表示服务端确认成功  

---

### 25

**页面：**`/page/pay` 支付结果页（PayPal 回跳）

**接口：**`paypal/complete`

**请求方式：**POST，body JSON

**参数：**

- `id`：PayPal 的 `paymentId`  
- `token`：PayPal 的 `token`  
- `payer_id`：PayPal 的 `PayerID`  

**Token：**要  

**返回参数 `d`：**看 `c===0`  

---

### 26

**页面：**`/shopping` 网页原生 Apple Pay 按钮

**接口：**`pay/apple_pay_session_start`

**请求方式：**POST，body JSON

**参数：**

- `request_id`：你们生成的唯一请求 id  
- `validation_url`：Apple 回调给的商户校验地址  
- `payment_intent_id`：和 `pay/create` 返回的 `pi` 一致  
- `initiative_context`：域名，如 `example.com`  

**Token：**要  

**返回参数 `d`：**Apple 商户 session 对象，原样交给 Apple SDK  

---

### 27

**页面：**同上，Apple Pay 付款授权后

**接口：**`pay/payment_intent_confirm`

**请求方式：**POST，body JSON

**参数：**

- `request_id`：唯一 id  
- `payment_intent_id`：`pi`  
- `payment_method`：`{ "type":"applepay", "applepay": { ... } }`（由 Apple 支付 token 组装）  

**Token：**要  

**返回参数 `d`：**看 `c===0`  

---

### 28

**页面：**应用就绪后首屏、带投放参数 `?s=` 时

**接口：**`stat`

**请求方式：**POST，body JSON

**参数：**

- `action`：如 `load_duration`（首屏耗时）、`source`（来源）  
- `target`：数字，首屏里传 `0`  
- `remark`：可选，补充说明字符串  

**Token：**要  

**返回参数 `d`：**一般不关心  

---

### 29

**页面：**应用就绪后定时心跳

**接口：**`alive`

**请求方式：**POST，body：`{}`

**参数：**空对象即可

**Token：**要  

**返回参数 `d`：**一般不关心  

---

### 30

**页面：**独立分享落地页（不是主站路由）

**接口：**`anonymous/stat`

**请求方式：**GET，URL 带参数

**参数：**

- `action`：如 `source`  

**Token：**可有可无（匿名统计）；请求头里可能额外带 `X-Source`  

**返回参数 `d`：**一般不关心  

---

### 31

**页面：**全局报错、登录异常时

**接口：**`report`

**请求方式：**POST，body JSON

**参数：**

- `content`：一段文字，多为错误堆栈或 JSON 字符串  

**Token：**视后端  

**返回参数 `d`：**一般不关心  

---

### 32

**页面：**`/page/feedback` 意见反馈

**接口：**`feedback`

**请求方式：**POST，body JSON

**参数：**

- `email`：联系方式，可空  
- `content`：反馈正文  

**Token：**要  

**返回参数 `d`：**看 `c===0`  

---

### 33

**页面：**管理端传图（封面等），先拿表单再直传云存储

**接口：**`oss/form`

**请求方式：**GET

**参数：**无

**Token：**要（管理员）  

**返回参数 `d`：**

- `url`：第二步 POST 上传的完整地址  
- `form`：表单字段键值，全部放进 `multipart/form-data` 再上传文件  

**说明：**第二步是 **普通 HTTP POST 文件上传** 到 `url`，不是 JSON 接口。  

---

### 34

**页面：**`/z/management` 管理入口（仅 Web 限制 VIP 且管理员才显示按钮）

**接口：**`subscription/cancel`

**请求方式：**POST，body：`{}`

**参数：**无（空 JSON）

**Token：**要（且后端应校验权限）  

**返回参数 `d`：**看 `c===0`  

---

## 三、管理后台 `/z`（给内部用，安卓一般不用）

写法同上，只列路径和要点。

---

**页面：**`/z` 管理首页  

**接口：**`admin/home`  

**请求方式：**GET  

**参数：**无  

**Token：**要  

**返回参数 `d`：**`today_uploaded`、`total_uploaded`、`uv`、`pv`、`unlock`、`play` 等统计数字  

---

**页面：**`/z/page/movie` 影片列表  

**接口：**`admin/movie/list`  

**请求方式：**GET，URL：`page`、`keyword`、`language`  

**Token：**要  

**返回参数 `d`：**分页，`data` 为影片行  

---

**页面：**`/z/page/movie/detail/:id` 编辑影片  

**接口：**`admin/movie`  

**请求方式：**GET，URL：`id`  

**Token：**要  

**返回参数 `d`：**`info`、`episodes`、`tag`、`area`  

---

**页面：**同上保存  

**接口：**`admin/movie/save`  

**请求方式：**POST JSON：`id`、`episodes`（只含改 VIP 的 `{id,vip}`）、`title`、`sort`、`area`、`tag`、`audio_track`  

**Token：**要  

---

**页面：**列表/详情删片、改状态  

**接口：**`admin/movie/status`  

**请求方式：**POST JSON：`id`、`status`（如 `3` 删除，以后端为准）  

**Token：**要  

---

**页面：**推荐位开关  

**接口：**`admin/movie/sort`  

**请求方式：**POST JSON：`id`、`sort`  

**Token：**要  

---

**页面：**设置音轨  

**接口：**`admin/movie/set-audio-track`  

**请求方式：**POST JSON：`id`、`audio`  

**Token：**要  

---

**页面：**导出文本  

**接口：**`admin/movie/export`  

**请求方式：**GET，URL：`id`  

**Token：**要  

**返回参数 `d`：**纯文本  

---

**页面：**编辑页拉标签/地区、新建标签/地区  

**接口：**`admin/tag`、`admin/area`  

**请求方式：**GET 无参拉列表；POST JSON `{ "name": "..." }` 新建，返回 `d` 为新 id  

**Token：**要  

---

**页面：**`/z/page/magnet`  

**接口：**`admin/movie/magnet`  

**请求方式：**POST JSON：`keyword`  

**Token：**要  

**返回参数 `d`：**数组 `type,id,name,cover,status`  

---

**页面：**磁力结果点下载  

**接口：**`admin/movie/download`  

**请求方式：**POST JSON：`name`（资源类型）、`id`  

**Token：**要  

---

**页面：**`/z/page/user`  

**接口：**`admin/user`  

**请求方式：**GET，URL：`page`、`keyword`、`type`（0 全部 1 注册 2 匿名等）  

**Token：**要  

---

**页面：**`/z/page/user/:id`  

**接口：**`admin/user/info`  

**请求方式：**GET，URL：`id`  

**Token：**要  

---

**页面：**同上点保存  

**接口：**`admin/user/save`  

**请求方式：**Web 当前代码 **没写 POST**，发成了 **GET + URL 参数** `id、admin、vip`。安卓请 **问后端到底要 GET 还是 POST**；若后端是 POST，应传 JSON 同上三个字段。  

**Token：**要  

---

**页面：**`/z/page/orders`  

**接口：**`admin/order`  

**请求方式：**GET，URL：`page`、`keyword`  

**Token：**要  

---

**页面：**订单详情  

**接口：**`admin/order/info`  

**请求方式：**GET，URL：`id`  

**Token：**要  

---

**页面：**`/z/page/analysis`  

**接口：**`admin/analysis`  

**请求方式：**GET  

**Token：**要  

**返回参数 `d`：**`source_today`、`source_week`、`source_all` 等数组  

---

**页面：**用户行为日志  

**接口：**`admin/user/stat`  

**请求方式：**GET，URL：`id`（用户 id）  

**Token：**要  

**返回参数 `d`：**`count`、`data[]`  

---

## 四、当前代码里已注释、未接线的（别对接错了）

- `movie/episode/will-unlock`、`movie/episode/do-unlock`、`movie/episode/unlock`  
- 旧版字符串 `pay` 接口（已废弃）  

---

## 五、文档维护

以后前端每加一个 `api('...')`，在这里 **按第二节同样格式** 补一条即可。
