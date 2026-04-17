import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureCoreRuntime } from '../lib/coreRuntime';
import type { CourseManifest, SlideSource } from '../lib/types';

type PreviewStageProps = {
  manifest: CourseManifest;
  slides: SlideSource[];
  currentSlideId: string;
  onSelectSlide: (slideId: string) => void;
};

export default function PreviewStage({ manifest, slides, currentSlideId, onSelectSlide }: PreviewStageProps) {
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string>('');
  const slideSelectionCleanupRef = useRef<(() => void) | undefined>(undefined);

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

  useEffect(() => {
    const rootElement = previewRootRef.current;
    if (!rootElement) {
      return;
    }

    const sections = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-export-page]'));
    sections.forEach((section) => {
      section.dataset.active = section.dataset.slideId === currentSlideId ? 'true' : 'false';
    });
  }, [currentSlideId]);

  useEffect(() => {
    const rootElement = previewRootRef.current;
    if (!rootElement || orderedSlides.length === 0) {
      return;
    }

    let cancelled = false;
    let renderedRoot: { unmount?: () => void } | undefined;
    let mountElement: HTMLDivElement | undefined;

    const applySelectionBindings = () => {
      slideSelectionCleanupRef.current?.();
      const sections = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-export-page]'));
      sections.forEach((section, index) => {
        const slide = orderedSlides[index];
        if (!slide) {
          return;
        }
        section.dataset.slideId = slide.pageId;
        section.dataset.active = slide.pageId === currentSlideId ? 'true' : 'false';
        section.style.cursor = 'pointer';
      });

      const clickHandler = (event: Event) => {
        const target = event.currentTarget as HTMLElement | null;
        const slideId = target?.dataset.slideId;
        if (slideId) {
          onSelectSlide(slideId);
        }
      };

      sections.forEach((section) => section.addEventListener('click', clickHandler));
      slideSelectionCleanupRef.current = () => {
        sections.forEach((section) => section.removeEventListener('click', clickHandler));
      };
    };

    setPreviewState('loading');
    setPreviewError('');

    ensureCoreRuntime()
      .then(async (runtime) => {
        const courseData = await runtime.buildCourseDataFromMemory({
          manifest,
          slides,
          course: {
            id: manifest.id,
            title: manifest.title,
          },
        });
        return { runtime, courseData };
      })
      .then(({ runtime, courseData }) => {
        if (cancelled || !rootElement) {
          return;
        }

        mountElement = document.createElement('div');
        mountElement.className = 'core-preview-mount';
        rootElement.replaceChildren(mountElement);

        const previewWidth = Math.min(Math.max(rootElement.clientWidth - 48, 320), 1280);
        const previewScale = previewWidth / 1280;
        renderedRoot = runtime.renderCourseExportDocument(mountElement, {
          course: { id: manifest.id, title: manifest.title },
          courseData,
          contentScale: previewScale,
        });
        applySelectionBindings();
        setPreviewState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('[ai-editor] core preview render failed:', error);
        setPreviewState('error');
        setPreviewError(error instanceof Error ? error.message : '未知预览错误');
      });

    return () => {
      cancelled = true;
      slideSelectionCleanupRef.current?.();
      slideSelectionCleanupRef.current = undefined;
      const rootToUnmount = renderedRoot;
      const elementToRemove = mountElement;
      window.setTimeout(() => {
        rootToUnmount?.unmount?.();
        elementToRemove?.remove();
      }, 0);
    };
  }, [manifest, onSelectSlide, orderedSlides, slides]);

  return (
    <div className="preview-shell" data-testid="preview-stage">
      {previewState === 'error' ? (
        <div className="preview-empty-state">
          <h3>Core 预览失败</h3>
          <p>{previewError || '无法渲染当前课件页面。'}</p>
        </div>
      ) : null}
      <div
        ref={previewRootRef}
        className={previewState === 'error' ? 'preview-document custom-scrollbar is-hidden' : 'preview-document custom-scrollbar core-preview-root'}
      />
      {previewState === 'loading' ? (
        <div className="preview-loading-overlay">
          <div className="preview-loading-card">
            <strong>正在加载 Core 预览</strong>
            <span>使用真实运行时编译当前 `.lume` 课件页面…</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
