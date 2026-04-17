import type { ChatMessage, CourseManifest, SlideSource } from '../lib/types';

export const mockManifest: CourseManifest = {
  id: 'ai-lesson-demo',
  title: 'LumeSync AI 协作课件.lume',
  pages: [
    { id: 'opening', title: '课程导入', file: 'slides/Opening.tsx' },
    { id: 'workflow', title: '智能体流程', file: 'slides/Workflow.tsx' },
    { id: 'reflection', title: '课堂反思', file: 'slides/Reflection.tsx' },
  ],
};

export const mockSlides: SlideSource[] = [
  {
    file: 'slides/Opening.tsx',
    title: '课程导入',
    source: `export default function Opening() {
  return (
    <div className="h-full w-full bg-slate-950 text-white p-14">
      <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-10 rounded-[2rem] border border-cyan-400/15 bg-white/5 p-10 shadow-2xl">
        <section className="flex flex-col justify-between">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              AI 协作课堂 / Module 01
            </div>
            <h1 className="mt-6 text-6xl font-black tracking-tight">让学生看见 AI 如何协同工作</h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-200">
              用一个真实任务串起提示词、页面结构和课堂互动，帮助学生理解“生成”背后的设计过程。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">目标: 共创课件</div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">形式: 分组讨论</div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">产出: 页面改写</div>
          </div>
        </section>
        <aside className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(93,211,255,0.28),_transparent_55%),linear-gradient(180deg,_rgba(10,35,56,0.95),_rgba(5,12,23,0.9))] p-8">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/70">教研提示</p>
            <ul className="mt-4 space-y-3 text-base leading-7 text-slate-200">
              <li>1. 先给学生完整成品，再回看生成过程。</li>
              <li>2. 对比“AI 草稿”和“教师定稿”的差异。</li>
              <li>3. 引导学生关注页面结构，而非只看文案。</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
`,
  },
  {
    file: 'slides/Workflow.tsx',
    title: '智能体流程',
    source: `export default function Workflow() {
  const steps = [
    ['输入任务', '老师用自然语言描述课堂目标和页面风格'],
    ['拆解结构', 'AI 输出页面结构、交互建议和演讲节奏'],
    ['调整代码', '按页修改 TSX，保持每一页都可以独立预览'],
    ['同步演示', '课堂中继续根据学生反馈快速重写本页'],
  ];

  return (
    <div className="h-full w-full bg-[#03111c] p-12 text-white">
      <div className="flex h-full flex-col rounded-[2rem] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(13,34,52,0.94),rgba(4,10,20,0.92))] p-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/60">Agentic workflow</p>
            <h2 className="mt-4 text-5xl font-black tracking-tight">从提示到课件页面的协同链路</h2>
          </div>
          <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-2 text-sm font-semibold text-emerald-100">
            目标: 让生成过程可解释
          </div>
        </div>
        <div className="mt-10 grid flex-1 grid-cols-2 gap-6">
          {steps.map(([title, desc], index) => (
            <div key={title} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/15 text-lg font-black text-cyan-100">0{index + 1}</div>
              <h3 className="mt-6 text-2xl font-bold">{title}</h3>
              <p className="mt-3 text-lg leading-8 text-slate-300">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    file: 'slides/Reflection.tsx',
    title: '课堂反思',
    source: `export default function Reflection() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(77,208,225,0.24),_transparent_32%),linear-gradient(180deg,_#08101b,_#03070e)] p-14 text-white">
      <div className="grid w-full max-w-6xl grid-cols-[0.95fr_1.05fr] gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/60">Exit ticket</p>
          <h2 className="mt-4 text-5xl font-black">今天你最想保留的 AI 协作习惯是什么？</h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            请学生在一分钟内写下一个“下次生成课件时一定会继续做”的动作，并说明原因。
          </p>
        </div>
        <div className="grid gap-5">
          <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-6">
            <h3 className="text-2xl font-bold text-emerald-50">复盘问题 01</h3>
            <p className="mt-3 text-base leading-7 text-emerald-50/85">我有没有先定义页面目标，而不是一上来就让 AI 写整套内容？</p>
          </div>
          <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-6">
            <h3 className="text-2xl font-bold text-cyan-50">复盘问题 02</h3>
            <p className="mt-3 text-base leading-7 text-cyan-50/85">我有没有把生成结果转化成“课堂可讲述”的节奏？</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6">
            <h3 className="text-2xl font-bold">复盘问题 03</h3>
            <p className="mt-3 text-base leading-7 text-slate-200">如果要在下一节课继续改这页，我最先会改哪一个区块？</p>
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  },
];

export const mockChat: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: '请帮我生成一套 3 页的 AI 协作课堂课件，风格偏未来感，适合在 VS Code 里边聊边改。',
  },
  {
    id: 'm2',
    role: 'assistant',
    content: '已为你拆成 3 页：\n\n1. **课程导入**：明确课堂目标与氛围\n2. **智能体流程**：可视化 AI 协同链路\n3. **课堂反思**：留给学生可执行的复盘问题\n\n我建议先应用到幻灯片，再逐页精修文案。',
    actions: [
      { id: 'apply-slide', label: '应用到幻灯片', targetSlideId: 'opening' },
    ],
  },
  {
    id: 'm3',
    role: 'user',
    content: '第二页再强调一下“一个课件包里逐页编辑”的使用方式，不要让老师感受到内部文件拆解。',
  },
  {
    id: 'm4',
    role: 'assistant',
    content: '可以。我会把第二页改成“从提示到课件页”的工作流，对老师只展示 `.lume` 课件与页面，不暴露底层拆分文件。',
    actions: [
      { id: 'rewrite-slide', label: '重写本页', targetSlideId: 'workflow' },
    ],
  },
  {
    id: 'm5',
    role: 'assistant',
    content: '补充建议：右侧预览保持 16:9，左侧消息按钮直接把 AI 改写结果应用到当前页，这样会更像真正的课件编排台。',
    actions: [
      { id: 'apply-slide', label: '应用到幻灯片', targetSlideId: 'reflection' },
      { id: 'rewrite-slide', label: '重写本页', targetSlideId: 'reflection' },
    ],
  },
];
