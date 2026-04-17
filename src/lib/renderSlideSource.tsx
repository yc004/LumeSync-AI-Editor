import React from 'react';

const extractClassNames = (source: string): string[] => {
  const matches = [...source.matchAll(/className=\"([^\"]+)\"/g)];
  return Array.from(new Set(matches.flatMap((match) => match[1].split(/\s+/)).filter(Boolean)));
};

const titleFromSource = (source: string): string => {
  const heading = source.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i)?.[1]?.trim();
  if (heading) {
    return heading;
  }
  return source.match(/export default function\s+([A-Za-z0-9_]+)/)?.[1] ?? 'Untitled Slide';
};

const summaryFromSource = (source: string): string => {
  const paragraph = source.match(/<p[^>]*>([^<]+)<\/p>/i)?.[1]?.trim();
  if (paragraph) {
    return paragraph;
  }
  return '预览运行时将在后续阶段接入 teacher/core 的真实 TSX 编译与渲染能力。';
};

export function renderSlideSource(source: string, context?: { title?: string }): React.ReactNode {
  if (!source.trim()) {
    return (
      <div className="preview-empty-state">
        <h3>暂无页面源码</h3>
        <p>选择一个幻灯片或通过 AI 协作区生成内容。</p>
      </div>
    );
  }

  if (!/export\s+default\s+function/.test(source)) {
    throw new Error('当前页面缺少 `export default function`，无法生成预览。');
  }

  const heading = context?.title ?? titleFromSource(source);
  const summary = summaryFromSource(source);
  const classNames = extractClassNames(source);

  return (
    <div className="mock-slide-frame">
      <div className="mock-slide-backdrop" />
      <div className="mock-slide-card">
        <div className="mock-slide-chip">Mock Runtime Preview</div>
        <h1>{heading}</h1>
        <p>{summary}</p>
        <div className="mock-slide-stats">
          <div>
            <span>Format</span>
            <strong>.lume</strong>
          </div>
          <div>
            <span>Layers</span>
            <strong>{classNames.length}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Ready</strong>
          </div>
        </div>
        <div className="mock-slide-classlist">
          {classNames.slice(0, 16).map((className) => (
            <span key={className}>{className}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
