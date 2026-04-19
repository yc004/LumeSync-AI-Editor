import type { CourseManifest, SlideSource } from '../lib/types';

export const mockManifest: CourseManifest = {
  schemaVersion: '1.0.0',
  id: 'empty-demo-course',
  title: '示例课件',
  runtime: {
    format: 'lumesync-zip',
    react: '18',
    slideModule: 'tsx',
    entryMode: 'pages',
    preferredAspectRatio: '16:9',
  },
  pages: [{ id: 'opening', title: '开场页', file: 'slides/Opening.tsx' }],
};

export const mockSlides: SlideSource[] = [
  {
    file: 'slides/Opening.tsx',
    title: '开场页',
    source: `export default function Opening() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 p-14 text-white">
      <section className="max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-200">LumeSync</p>
        <h1 className="mt-5 text-6xl font-black leading-tight">从这里开始编辑你的课件。</h1>
        <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-200">
          右侧栏不再注入模拟对话。你输入真实需求后，AI 对话记录才会出现在这里。
        </p>
      </section>
    </div>
  );
}
`,
  },
];
