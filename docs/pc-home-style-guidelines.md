# PC 首页改造规范

> 目标：先完成“全局 + 首页”的 PC 架构层改造，且不破坏 H5 现有样式与交互。

## 1) 不影响 H5（强约束）

- 所有 PC 改动必须放在 `@media (min-width: 481px)` 内。
- `<= 480px` 的规则、尺寸、布局、动效保持原样。
- 禁止在移动端基础类名上直接改默认值（避免移动端回归）。

## 2) 首页参考基线

- 视觉与结构以 ReelShort 首页为基准。
- 当前本地基准口径：
  - 视口 `> 480px`：进入 PC 全宽模式。
  - 视口 `<= 480px`：保持 H5 全宽模式。

## 3) 字体与尺寸策略

- H5：继续使用现有 `var(--app-vw)` 比例体系。
- PC：优先保持与 480 宽度等比视觉一致，必要时再在 `@media (min-width: 481px)` 内做细调。
- 字体细调只在 PC 媒体查询中进行，且优先改首页局部类，不改全局基础字号。

## 4) 实施范围（第一阶段）

- 全局：`src/index.css`（PC 全宽容器与基础断点）
- 首页：`src/pages/user/Home.tsx`、`src/styles/home-reelshort.scss`

## 术语约定

- `slot_old`：指我们当前在改造的项目代码。
- `ReelShort`：指对标站点/参考样式来源。
- 顶栏映射：
  - `ReelShort.CommonNav_common_nav_container__r9DEx` -> `slot_old .reelshort-topnav__row`
  - `ReelShort.CommonNav_right__arFFN` -> `slot_old .reelshort-topnav__right`

## 5) 验收清单

- 375 / 390 宽度：与改造前视觉一致。
- 481 / 768 / 1024 宽度：都进入 PC 全宽展示。
- 首页 Banner、书架横滑、Footer、TopNav 在 PC 下无错位、无溢出、无字体突变。
