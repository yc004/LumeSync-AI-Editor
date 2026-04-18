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
  return source.match(/export default function\s+([A-Za-z0-9_]+)/)?.[1] ?? '未命名页面';
};

const summaryFromSource = (source: string): string => {
  const paragraph = source.match(/<p[^>]*>([^<]+)<\/p>/i)?.[1]?.trim();
  if (paragraph) {
    return paragraph;
  }
  return '当前源码没有可提取的段落描述，预览区域会根据 TSX 结构生成一个简化的中文占位视图。';
};

export function renderSlideSource(source: string, context?: { title?: string }): React.ReactNode {
  if (!source.trim()) {
    return (
      <div className="preview-empty-state">
        <h3>当前页面没有源码</h3>
        <p>先在源码视图中写入内容，或让 AI 生成初始页面，再回到这里查看预览。</p>
      </div>
    );
  }

  if (!/export\s+default\s+function/.test(source)) {
    throw new Error('当前页面源码缺少 `export default function`，无法生成占位预览。');
  }

  const heading = context?.title ?? titleFromSource(source);
  const summary = summaryFromSource(source);
  const classNames = extractClassNames(source);

  return (
    <div className="mock-slide-frame">
      <div className="mock-slide-backdrop" />
      <div className="mock-slide-card">
        <div className="mock-slide-chip">运行时预览</div>
        <h1>{heading}</h1>
        <p>{summary}</p>
        <div className="mock-slide-stats">
          <div>
            <span>格式</span>
            <strong>.lume</strong>
          </div>
          <div>
            <span>层级</span>
            <strong>{classNames.length}</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>就绪</strong>
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
