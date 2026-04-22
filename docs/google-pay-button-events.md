# Google Pay Button 事件调试清单

用于 `RadixRcShoppingPaySection.tsx` 的三方钱包按钮联调，确认 Google Pay 事件是否真实触发。

## 事件列表（GooglePayButtonEventHandler / GooglePayButtonEvent）

- `authorized`（`GooglePayAuthorizedEvent`）：用户授权支付时触发。
- `cancel`（`undefined`）：用户取消支付时触发。
- `click`（`undefined`）：用户点击按钮时触发。
- `error`（`ErrorEvent`）：表单出现异常错误时触发。
- `ready`（`undefined`）：表单可交互时触发。
- `shippingAddressChange`（`GooglePayIntermediatePaymentData`）：收货地址变化时触发。
- `shippingMethodChange`（`GooglePayIntermediatePaymentData`）：配送方式变化时触发。
- `success`（`SuccessEvent`）：支付成功时触发，可用于跳转成功页。

## 当前页面调试方式

在 `src/pages/user/RadixRcShoppingPaySection.tsx` 中，以上 8 个事件均已添加：

- `console.log`，前缀：`[shopping-wallet-probe]`
- `window.alert`，文案包含：`googlePayButton.<eventName> 触发`

这样你在测试时可以同时从控制台和弹窗确认事件是否到达前端。
