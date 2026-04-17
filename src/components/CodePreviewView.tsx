import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import type { CourseManifest, SlideSource } from '../lib/types';
import PreviewStage from './PreviewStage';

type CodePreviewViewProps = {
  tab: 'code' | 'preview';
  manifest: CourseManifest;
  slides: SlideSource[];
  currentSlideId: string;
  onTabChange: (tab: 'code' | 'preview') => void;
  onSelectSlide: (slideId: string) => void;
  onSourceChange: (file: string, source: string) => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onSave: () => void;
  onBackHome: () => void;
};

export default function CodePreviewView({
  tab,
  manifest,
  slides,
  currentSlideId,
  onTabChange,
  onSelectSlide,
  onSourceChange,
  onTitleChange,
  onTitleBlur,
  onSave,
  onBackHome,
}: CodePreviewViewProps) {
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

  return (
    <section className="workspace-panel">
      <div className="workspace-toolbar workspace-toolbar-floating">
        <div className="workspace-document-title">
          <span className="document-dot" />
          <input
            type="text"
            className="course-title-input"
            aria-label="course-title"
            data-testid="course-title-input"
            value={manifest.title}
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={onTitleBlur}
          />
          <small>说课 PPT</small>
        </div>
        <div className="workspace-tabs" role="tablist" aria-label="Editor tabs">
          <button type="button" className={tab === 'code' ? 'tab active' : 'tab'} onClick={() => onTabChange('code')}>
            页面源码
          </button>
          <button type="button" className={tab === 'preview' ? 'tab active' : 'tab'} onClick={() => onTabChange('preview')}>
            预览
          </button>
        </div>
        <div className="workspace-toolbar-meta">
          <button type="button" className="secondary-button" aria-label="back-home" onClick={onBackHome}>
            返回主页
          </button>
          <button type="button" className="primary-button" aria-label="save-course" onClick={onSave}>
            保存到本地
          </button>
        </div>
      </div>

      {tab === 'code' ? (
        <div className="code-document custom-scrollbar" data-testid="code-view">
          {orderedSlides.map((slide) => {
            const isActive = slide.pageId === currentSlideId;
            return (
              <section
                key={slide.file}
                className={isActive ? 'code-slide-block active' : 'code-slide-block'}
                onClick={() => onSelectSlide(slide.pageId)}
              >
                <div className="code-slide-header">
                  <span className="code-slide-index">{slide.pageIndex + 1} / {orderedSlides.length}</span>
                  <button type="button" className="mini-action">
                    编辑页面
                  </button>
                </div>
                <div className="code-editor-shell">
                  <CodeMirror
                    value={slide.source}
                    height="100%"
                    extensions={codeExtensions}
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
      ) : (
        <PreviewStage
          manifest={manifest}
          slides={slides}
          currentSlideId={currentSlideId}
          onSelectSlide={onSelectSlide}
        />
      )}
    </section>
  );
}
