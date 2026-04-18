import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import type { CourseAssetSource, CourseManifest, SlideSource } from '../lib/types';
import PreviewStage from './PreviewStage';

type CodePreviewViewProps = {
  tab: 'code' | 'preview';
  manifest: CourseManifest;
  slides: SlideSource[];
  assets?: CourseAssetSource[];
  currentSlideId: string;
  sidebarCollapsed: boolean;
  chatCollapsed: boolean;
  onToggleSidebar: () => void;
  onToggleChat: () => void;
  onTabChange: (tab: 'code' | 'preview') => void;
  onSelectSlide: (slideId: string) => void;
  onSourceChange: (file: string, source: string) => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onPageTitleChange: (pageId: string, title: string) => void;
  onPageTitleBlur: () => void;
  onOpenConfig: () => void;
  onSave: () => void;
  onBackHome: () => void;
};

export default function CodePreviewView({
  tab,
  manifest,
  slides,
  assets = [],
  currentSlideId,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onTabChange,
  onSelectSlide,
  onSourceChange,
  onTitleChange,
  onTitleBlur,
  onPageTitleChange,
  onPageTitleBlur,
  onOpenConfig,
  onSave,
  onBackHome,
}: CodePreviewViewProps) {
  const codeDocumentRef = useRef<HTMLDivElement | null>(null);
  const codeScrollFrameRef = useRef<number | undefined>(undefined);
  const codeAutoScrollingRef = useRef(false);
  const codeAutoScrollTimeoutRef = useRef<number | undefined>(undefined);
  const codeHasPositionedRef = useRef(false);
  const codeExtensions = useMemo(() => [javascript({ jsx: true, typescript: true })], []);
  const orderedSlides = useMemo(
    () =>
      manifest.pages
        .map((page, index) => {
          const slide = slides.find((item) => item.file === page.file);
          return slide ? { ...slide, pageId: page.id, pageIndex: index } : null;
        })
        .filter((item): item is SlideSource & { pageId: string; pageIndex: number } => item !== null),
    [manifest.pages, slides],
  );

  const currentSlide = orderedSlides.find((slide) => slide.pageId === currentSlideId) ?? orderedSlides[0];

  useEffect(() => {
    if (tab !== 'code') {
      codeHasPositionedRef.current = false;
      return;
    }

    const codeDocument = codeDocumentRef.current;
    if (!codeDocument || !currentSlideId) {
      return;
    }

    const activeBlock = codeDocument.querySelector<HTMLElement>(`[data-code-page-id="${CSS.escape(currentSlideId)}"]`);
    if (!activeBlock) {
      return;
    }

    const documentRect = codeDocument.getBoundingClientRect();
    const blockRect = activeBlock.getBoundingClientRect();
    const coversViewportFocus =
      blockRect.bottom > documentRect.top + documentRect.height * 0.25 &&
      blockRect.top < documentRect.bottom - documentRect.height * 0.25;

    if (coversViewportFocus) {
      return;
    }

    codeAutoScrollingRef.current = true;
    if (codeAutoScrollTimeoutRef.current !== undefined) {
      window.clearTimeout(codeAutoScrollTimeoutRef.current);
    }
    const scrollBehavior: ScrollBehavior = codeHasPositionedRef.current ? 'smooth' : 'auto';
    activeBlock?.scrollIntoView({
      behavior: scrollBehavior,
      block: 'start',
      inline: 'nearest',
    });
    codeHasPositionedRef.current = true;
    codeAutoScrollTimeoutRef.current = window.setTimeout(() => {
      codeAutoScrollingRef.current = false;
      codeAutoScrollTimeoutRef.current = undefined;
    }, scrollBehavior === 'smooth' ? 520 : 80);
  }, [currentSlideId, tab]);

  useEffect(() => {
    if (tab !== 'code') {
      return;
    }

    const codeDocument = codeDocumentRef.current;
    if (!codeDocument) {
      return;
    }

    const syncCurrentPageFromScroll = () => {
      const blocks = Array.from(codeDocument.querySelectorAll<HTMLElement>('[data-code-page-id]'));
      if (!blocks.length) {
        return;
      }

      const viewportCenter = codeDocument.getBoundingClientRect().top + codeDocument.clientHeight / 2;
      const closestBlock = blocks.reduce((closest, block) => {
        const blockRect = block.getBoundingClientRect();
        const blockCenter = blockRect.top + blockRect.height / 2;
        const distance = Math.abs(blockCenter - viewportCenter);
        return distance < closest.distance ? { block, distance } : closest;
      }, { block: blocks[0], distance: Number.POSITIVE_INFINITY });

      const pageId = closestBlock.block.dataset.codePageId;
      if (pageId && pageId !== currentSlideId) {
        onSelectSlide(pageId);
      }
    };

    const handleScroll = () => {
      if (codeAutoScrollingRef.current) {
        return;
      }

      if (codeScrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(codeScrollFrameRef.current);
      }
      codeScrollFrameRef.current = window.requestAnimationFrame(syncCurrentPageFromScroll);
    };

    codeDocument.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      codeDocument.removeEventListener('scroll', handleScroll);
      if (codeScrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(codeScrollFrameRef.current);
        codeScrollFrameRef.current = undefined;
      }
      if (codeAutoScrollTimeoutRef.current !== undefined) {
        window.clearTimeout(codeAutoScrollTimeoutRef.current);
        codeAutoScrollTimeoutRef.current = undefined;
      }
    };
  }, [currentSlideId, onSelectSlide, tab]);

  return (
    <section className="workspace-panel">
      <header className="editor-header">
        <div className="editor-header-main">
          <button type="button" className="editor-back-button" onClick={onBackHome}>
            返回首页
          </button>
          <div className="editor-title-group">
            <span className="editor-title-eyebrow">当前课程</span>
            <input
              type="text"
              className="course-title-input"
              aria-label="course-title"
              data-testid="course-title-input"
              value={manifest.title}
              onChange={(event) => onTitleChange(event.target.value)}
              onBlur={onTitleBlur}
            />
          </div>
        </div>

        <div className="editor-header-actions">
          <button type="button" className="editor-config-button" onClick={onOpenConfig}>
            配置
          </button>
          <button type="button" className="editor-download-button" onClick={onSave}>
            下载课件
          </button>
        </div>
      </header>

      <div className="workspace-stage-area">
        <div className="workspace-subtitle">
          <div>
            <input
              type="text"
              className="page-title-input"
              aria-label="当前页面名称"
              data-testid="page-title-input"
              value={currentSlide?.title ?? ''}
              placeholder="未命名页面"
              onChange={(event) => {
                if (currentSlide) {
                  onPageTitleChange(currentSlide.pageId, event.target.value);
                }
              }}
              onBlur={onPageTitleBlur}
            />
          </div>

          <div className="workspace-tabs" role="tablist" aria-label="编辑器标签">
            <button type="button" className={tab === 'preview' ? 'tab active' : 'tab'} onClick={() => onTabChange('preview')}>
              预览
            </button>
            <button type="button" className={tab === 'code' ? 'tab active' : 'tab'} onClick={() => onTabChange('code')}>
              源码
            </button>
          </div>
        </div>

        {tab === 'preview' ? (
          <PreviewStage
            manifest={manifest}
            slides={slides}
            assets={assets}
            currentSlideId={currentSlideId}
            onSelectSlide={onSelectSlide}
          />
        ) : (
          <div ref={codeDocumentRef} className="code-document custom-scrollbar" data-testid="code-view">
            {orderedSlides.map((slide) => {
              const isActive = slide.pageId === currentSlideId;
              return (
                <section
                  key={slide.file}
                  className={isActive ? 'code-slide-block active' : 'code-slide-block'}
                  data-code-page-id={slide.pageId}
                  onClick={() => onSelectSlide(slide.pageId)}
                >
                  <div className="code-slide-header">
                    <div>
                      <span className="code-slide-index">
                        场景 {slide.pageIndex + 1} / {orderedSlides.length}
                      </span>
                      <input
                        type="text"
                        className="code-slide-title-input"
                        aria-label={`页面名称 ${slide.pageIndex + 1}`}
                        value={slide.title}
                        placeholder="未命名页面"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onPageTitleChange(slide.pageId, event.target.value)}
                        onBlur={onPageTitleBlur}
                      />
                    </div>
                    <button type="button" className="mini-action">
                      {slide.file}
                    </button>
                  </div>
                  <div className="code-editor-shell">
                    <CodeMirror
                      value={slide.source}
                      height="100%"
                      extensions={codeExtensions}
                      theme={oneDark}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                      }}
                      className="code-editor-surface"
                      onChange={(value) => onSourceChange(slide.file, value)}
                    />
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="editor-bottom-toolbar">
          <div className="editor-toolbar-group">
            <button type="button" className="toolbar-mini-button" onClick={onToggleSidebar}>
              {sidebarCollapsed ? '展开场景栏' : '收起场景栏'}
            </button>
            <button type="button" className="toolbar-mini-button" onClick={onToggleChat}>
              {chatCollapsed ? '展开右栏' : '收起右栏'}
            </button>
          </div>

          <div className="editor-toolbar-meta">
            <span>
              {manifest.pages.findIndex((page) => page.id === currentSlideId) + 1} / {manifest.pages.length}
            </span>
            <span>{tab === 'preview' ? '预览模式' : '源码模式'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
