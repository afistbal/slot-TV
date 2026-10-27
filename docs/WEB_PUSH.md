# 浏览器通知验证

## 接口约定

接口统一使用 POST，携带当前用户的登录凭证。

- `/api/user/push/config`：读取 `d.public_key`，前端适配为 `publicKey`。
- `/api/user/push/subscribe`：保存浏览器生成的真实订阅，密钥必须放在 `keys` 对象中。
- `/api/user/push/unsubscribe`：传入当前设备的 `endpoint`。
- `/api/user/tasks`：保存成功后重新读取 `once` 中的 `push_on`，以 `ready` 判断是否可领取。
- `/api/user/coin`：通过 `{ "type": "subNotice" }` 领取奖励；重复领取限制由后端执行。

订阅请求结构：

```json
{
  "endpoint": "浏览器生成的订阅地址",
  "keys": {
    "p256dh": "浏览器生成的设备公钥",
    "auth": "浏览器生成的鉴权材料"
  },
  "userAgent": "浏览器 User-Agent"
}
```

## 本地验证

普通 `npm run dev` 不会注册 Service Worker，不能直接完成推送订阅。使用独立的正式构建预览，无需先发布到线上：

```powershell
$env:VITE_OUT_DIR = '.tmp/push-preview'
npx vite build --mode prod
Remove-Item Env:VITE_OUT_DIR
npx vite preview --mode prod --outDir .tmp/push-preview --port 5190 --strictPort
```

使用 Chrome 或 Edge 打开 `http://localhost:5190/lucky`，登录测试账号，然后：

1. 点击推送任务并允许浏览器通知。
2. 确认订阅保存成功，任务刷新为可领取。
3. 领取一次奖励，刷新页面确认不能重复领取。
4. 关闭网页，让后端向这条真实订阅发送测试通知，确认收到并能点击打开对应页面。
5. 在通知设置中关闭本设备通知，重新打开页面后确认不会自动恢复订阅。

如果点击后没有授权弹窗，先看页面的处理状态：

- “请在浏览器提示中允许通知”：权限尚未通过，检查地址栏旁的通知提示或网站设置。
- “正在连接通知服务…”：已通过权限检查，正在建立真实设备订阅；此前允许过通知时不会重复弹窗。
- “正在保存通知设置…”：已取得设备订阅，正在调用后端保存。

等待授权或连接通知服务超过 30 秒会显示可重试的错误，避免页面一直无响应。订阅和后端保存完成前，不显示开启成功或发放奖励。

测试时保留浏览器进程运行。`localhost` 可以用于桌面本机测试；手机通过局域网 HTTP 地址访问不能替代 HTTPS 真机验收。iPhone/iPad 使用 HTTPS 网站添加到主屏幕后再测试通知。

本地端口与正式域名属于不同来源，正式域名下需要重新订阅。正式验收还需分别触发追剧更新、连续观看中断提醒、客服回复；三个订阅管理接口可用，不代表这些后端发送流程已完成。

关闭本设备通知的选择保存在当前来源的浏览器本地存储中，手动重新开启并保存成功后清除。清除网站数据会同时清除这一选择。

## 回归检查

```powershell
node --test scripts/lucky-push-subscription.test.mjs
npx tsc -b
```
