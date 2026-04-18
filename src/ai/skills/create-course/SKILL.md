---
name: create-course
description: 当需要创建、扩写、重写、修复或优化 LumeSync AI 课件时使用。适用于生成 .lume 课件、编辑 manifest、增删页面、修改页面 TSX、配置资源依赖、加入课堂交互和同步变量。
---

# 创建与编辑 LumeSync 课件

## 工作目标

把用户的教学需求转换成一份可被 LumeSync Core 直接加载的标准 Zip `.lume` 课件。每次输出都必须包含完整 `manifest` 和所有页面的完整 TSX 源码，而不是局部补丁。

## 标准课件结构

- 课件是 Zip `.lume` 包。
- 根目录必须包含 `manifest.json`。
- 页面源码放在 `slides/*.tsx`。
- 静态资源放在 `assets/*`。
- 所有路径必须使用 `/`，不能使用 Windows 反斜杠。

## Manifest 规则

- 新建课件时，`schemaVersion` 使用 `"1.0.0"`。
- `runtime.format` 必须是 `"lumesync-zip"`。
- `runtime.entryMode` 必须是 `"pages"`。
- `runtime.slideModule` 必须是 `"tsx"`。
- `runtime.react` 默认使用 `"18"`。
- `runtime.preferredAspectRatio` 默认使用 `"16:9"`。
- 页面顺序只由 `manifest.pages` 决定。
- 每个页面必须有稳定的 `id`、`title`、`file`。
- 每个 `manifest.pages[].file` 必须在 `slides` 中有对应源码。
- 不要虚构二进制资源文件；只有用户明确提供或现有课件已有的资源，才能写入 `assets/*` 引用。
- 外部脚本依赖写入 `manifest.dependencies`，必要字段包括 `name`、`localSrc`、`publicSrc`。
- 模型文件地址写入 `manifest.modelsUrls`，可包含 `local` 和 `public`。

## 页面 TSX 规则

- 每个页面源码都必须是完整、有效的 TSX。
- 默认导出 React 组件；如果使用命名导出，必须在 `manifest.pages[].exportName` 中声明。
- 不要导入未声明或运行时不可用的包。
- 优先使用当前运行时可用的 Tailwind utility class。
- 页面应自包含，适合教室投屏。

## 课件设计规范

- 延续当前编辑器的 OpenMAIC 风格：电影感课堂舞台、深色层次背景、强标题、清晰信息层级、充足留白。
- 优先服务 16:9 教室大屏投影，避免小字号和密集段落。
- 中文教学内容必须自然，像真实教师会使用的课堂语言。
- 每页只承载一个清晰教学动作，例如导入、讲解、活动、讨论、反思、退出票。
- 推荐节奏：开场页、概念页、流程/活动页、练习页、反思页。
- 不要做泛 SaaS 卡片堆叠，除非这些卡片直接服务教学任务。
- 不要使用外部图片，除非资源已经在 `assets` 中声明并可用。

## 同步变量规则

- 只能在 React 组件渲染逻辑中使用 `window.CourseGlobalContext`。
- 需要教师端同步给学生端的状态，使用 `window.CourseGlobalContext.useSyncVar(key, initialValue)`。
- 只影响当前客户端的临时 UI 状态，使用 `window.CourseGlobalContext.useLocalVar(key, initialValue)`。
- 同步变量 key 必须稳定、可读、避免冲突，例如 `quiz:selected-option`、`drag-demo:position`。
- 不要使用随机 key、时间戳、`Math.random()` 或依赖渲染顺序的 key。
- 同步变量值必须可序列化，例如 string、number、boolean、null、数组、普通对象。
- 不要把 DOM 节点、函数、类实例、MediaStream、Canvas context、React element 等不可序列化对象放进同步变量。
- 拖拽、绘图等高频交互必须节流后再调用同步 setter。
- 是否真正广播给学生端取决于教师端运行时的 `syncInteraction` 设置；关闭同步时页面仍应能本地工作。
- 同步范围按 `courseId` 和当前页面索引过滤；跨页面复用 key 必须有明确意图。

## 编辑行为

- 除非用户明确要求，或修改确实需要，不要删除已有页面、资源、依赖和元数据。
- 新增页面时，同时新增 `manifest.pages[]` 和对应 `slides[]`。
- 删除页面时，同时删除对应 `slides[]`。
- 重命名课程或页面时，更新 manifest，并同步匹配 slide 的 `title`。
- 调整结构后，`currentSlideId` 必须指向仍然存在的页面。
- 用户需求含糊时，做最小且有用的修改，并保持现有课件风格。

## 输出约束

- 返回完整课件编辑结果，不要返回解释性散文。
- 不要输出 Markdown 代码块。
- 不要只返回某一页源码。
- 不要只返回 diff。
