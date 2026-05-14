代码规范（非常重要）

这是一个 React 短剧 / Shorts / Feed 流项目。

目标：

* 流畅
* 简洁
* 可维护
* 低重渲染
* 少抽象

请避免 AI 常见的“过度工程化”。

---

开发原则

1. 不要过度抽象
   不要为了“看起来高级”拆很多 hooks、service、adapter、manager。

优先：

* 直接
* 清晰
* 好调试

除非逻辑复用明确，否则不要抽离。

---

2. 不要创建大量 useEffect
   避免：

* effect 套 effect
* 多层状态同步
* 不必要依赖

优先：

* 单向数据流
* 明确事件触发

---

3. 减少 React 重渲染
   短视频 Feed 对性能敏感。

避免：

* 父组件频繁 setState
* 大量 context 更新
* 每个视频都独立复杂状态

优先：

* useRef
* 局部状态
* 精简 state

---

4. 少封装
   不要为了“架构”封装：

* VideoManager
* FeedEngine
* MediaRuntime
* AbstractPlayerLayer

这种命名。

当前只是 Demo 和业务项目。

优先可读性。

---

5. 组件层级不要太深
   避免：

Page
-> FeedProvider
-> RuntimeProvider
-> VideoManager
-> SlideController
-> VideoWrapper

尽量：

Page
-> Swiper
-> VideoSlide

即可。

---

6. 不要过度 TypeScript 体操
   避免：

* 泛型嵌套
* 类型体操
* 超复杂 interface

类型简单即可。

---

7. 优先业务直觉
   代码应该像：

“当前视频播放”
“上一个暂停”
“滑动切换”

而不是：

“MediaTransitionOrchestrator”

---

8. 视频项目核心目标
   重点是：

* 滑动流畅
* 自动播放稳定
* 声音逻辑稳定
* 移动端稳定

不是“架构炫技”。

---

9. 优先单文件可读性
   Demo 阶段：

允许：

* 一个页面 200~400 行

不要：

* 强行拆成 15 个文件

---

10. 写法偏函数式 + imperative
    短视频项目允许：

* refs
* imperative 控制
* player.play()
* swiper.slideNext()

不需要一切都 React 化。

---

11. 能直接写就不要二次封装
    例如：

不要：
useVideoPlaybackController()

直接：
player.play()

即可。

---

12. 最终目标
    代码要像 TikTok 工程：

* 直接
* 快
* 稳
* 少废层
* 易调试

而不是“React 教程项目”。
