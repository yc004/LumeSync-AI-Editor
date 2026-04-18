import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureCoreRuntime } from '../lib/coreRuntime';
import { createAssetUrlMap, rewriteSlideAssetReferences } from '../lib/assetPreview';
import type { CourseAssetSource, CourseManifest, SlideSource } from '../lib/types';

type PreviewStageProps = {
  manifest: CourseManifest;
  slides: SlideSource[];
  assets?: CourseAssetSource[];
  currentSlideId: string;
  onSelectSlide: (slideId: string) => void;
};

type OrderedSlide = SlideSource & {
  pageId: string;
  pageIndex: number;
};

type PreviewPageCardProps = {
  manifest: CourseManifest;
  page: CourseManifest['pages'][number];
  slide?: OrderedSlide;
  assets?: CourseAssetSource[];
  index: number;
  total: number;
  isActive: boolean;
  onSelectSlide: (slideId: string) => void;
};

function PreviewPageCard({ manifest, page, slide, assets = [], index, total, isActive, onSelectSlide }: PreviewPageCardProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) {
      return;
    }

    const updateScale = () => {
      const rect = mountElement.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      mountElement.style.setProperty('--preview-page-scale', String(Math.min(rect.width / 1280, rect.height / 720)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(mountElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement || !slide) {
      setState('error');
      setError('找不到这一页对应的课件源码。');
      return;
    }

    let cancelled = false;
    let renderedRoot: { unmount?: () => void } | undefined;
    const renderElement = document.createElement('div');
    renderElement.className = 'core-preview-mount';

    setState('loading');
    setError('');
    mountElement.replaceChildren(renderElement);
    const assetUrlMap = createAssetUrlMap(assets);
    const previewSlide = rewriteSlideAssetReferences(slide, assetUrlMap.urls);

    ensureCoreRuntime()
      .then(async (runtime) => {
        const previewManifest: CourseManifest = {
          ...manifest,
          pages: [page],
        };
        const courseData = await runtime.buildCourseDataFromMemory({
          manifest: previewManifest,
          slides: [previewSlide],
          course: {
            id: manifest.id,
            title: manifest.title,
            desc: manifest.desc,
            icon: manifest.icon,
            color: manifest.color,
          },
        });
        return { runtime, courseData };
      })
      .then(({ runtime, courseData }) => {
        if (cancelled || !renderElement.isConnected) {
          return;
        }

        renderedRoot = runtime.renderCourseExportDocument(renderElement, {
          course: {
            id: manifest.id,
            title: manifest.title,
            desc: manifest.desc,
            icon: manifest.icon,
            color: manifest.color,
          },
          courseData,
          contentScale: 1,
        });
        setState('ready');
      })
      .catch((renderError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('[ai-editor] page preview render failed:', renderError);
        setState('error');
        setError(renderError instanceof Error ? renderError.message : '这一页暂时无法预览。');
      });

    return () => {
      cancelled = true;
      const rootToUnmount = renderedRoot;
      window.setTimeout(() => {
        rootToUnmount?.unmount?.();
        renderElement.remove();
        assetUrlMap.revoke();
      }, 0);
    };
  }, [assets, manifest, page, slide]);

  return (
    <section
      className={isActive ? 'preview-page-card active' : 'preview-page-card'}
      data-page-id={page.id}
      data-testid={`preview-page-${page.id}`}
      onClick={() => onSelectSlide(page.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectSlide(page.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`预览页面 ${index + 1} / ${total}：${page.title}`}
    >
      <div ref={mountRef} className="preview-page-runtime" />
      <div className="preview-page-overlay-layer">
        {state === 'loading' ? (
          <div className="preview-page-overlay">
            <strong>正在渲染页面</strong>
          </div>
        ) : null}
        {state === 'error' ? (
          <div className="preview-page-overlay error">
            <strong>预览不可用</strong>
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function PreviewStage({ manifest, slides, assets = [], currentSlideId, onSelectSlide }: PreviewStageProps) {
  const previewDocumentRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const autoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef<number | undefined>(undefined);
  const hasPositionedRef = useRef(false);

  const orderedSlides = useMemo(
    () =>
      manifest.pages
        .map((page, index) => {
          const slide = slides.find((item) => item.file === page.file);
          return slide ? { ...slide, pageId: page.id, pageIndex: index } : null;
        })
        .filter((item): item is OrderedSlide => item !== null),
    [manifest.pages, slides],
  );

  const slideByPageId = useMemo(() => {
    const slideMap = new Map<string, OrderedSlide>();
    orderedSlides.forEach((slide) => slideMap.set(slide.pageId, slide));
    return slideMap;
  }, [orderedSlides]);

  useEffect(() => {
    const previewDocument = previewDocumentRef.current;
    if (!previewDocument || !currentSlideId) {
      return;
    }

    const activePage = previewDocument.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(currentSlideId)}"]`);
    if (!activePage) {
      return;
    }

    const documentRect = previewDocument.getBoundingClientRect();
    const pageRect = activePage.getBoundingClientRect();
    const coversViewportFocus =
      pageRect.bottom > documentRect.top + documentRect.height * 0.25 &&
      pageRect.top < documentRect.bottom - documentRect.height * 0.25;

    if (coversViewportFocus) {
      return;
    }

    autoScrollingRef.current = true;
    if (autoScrollTimeoutRef.current !== undefined) {
      window.clearTimeout(autoScrollTimeoutRef.current);
    }
    const scrollBehavior: ScrollBehavior = hasPositionedRef.current ? 'smooth' : 'auto';
    activePage?.scrollIntoView({
      behavior: scrollBehavior,
      block: 'start',
      inline: 'nearest',
    });
    hasPositionedRef.current = true;
    autoScrollTimeoutRef.current = window.setTimeout(() => {
      autoScrollingRef.current = false;
      autoScrollTimeoutRef.current = undefined;
    }, scrollBehavior === 'smooth' ? 520 : 80);
  }, [currentSlideId]);

  useEffect(() => {
    const previewDocument = previewDocumentRef.current;
    if (!previewDocument) {
      return;
    }

    const syncCurrentPageFromScroll = () => {
      const pages = Array.from(previewDocument.querySelectorAll<HTMLElement>('[data-page-id]'));
      if (!pages.length) {
        return;
      }

      const viewportCenter = previewDocument.getBoundingClientRect().top + previewDocument.clientHeight / 2;
      const closestPage = pages.reduce((closest, page) => {
        const pageRect = page.getBoundingClientRect();
        const pageCenter = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageCenter - viewportCenter);
        return distance < closest.distance ? { page, distance } : closest;
      }, { page: pages[0], distance: Number.POSITIVE_INFINITY });

      const pageId = closestPage.page.dataset.pageId;
      if (pageId && pageId !== currentSlideId) {
        onSelectSlide(pageId);
      }
    };

    const handleScroll = () => {
      if (autoScrollingRef.current) {
        return;
      }

      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = window.requestAnimationFrame(syncCurrentPageFromScroll);
    };

    previewDocument.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      previewDocument.removeEventListener('scroll', handleScroll);
      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
      if (autoScrollTimeoutRef.current !== undefined) {
        window.clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = undefined;
      }
    };
  }, [currentSlideId, onSelectSlide]);

  return (
    <div ref={previewDocumentRef} className="preview-shell custom-scrollbar" data-testid="preview-stage">
      {manifest.pages.map((page, index) => (
        <PreviewPageCard
          key={page.id}
          manifest={manifest}
          page={page}
          slide={slideByPageId.get(page.id)}
          assets={assets}
          index={index}
          total={manifest.pages.length}
          isActive={page.id === currentSlideId}
          onSelectSlide={onSelectSlide}
        />
      ))}
    </div>
  );
}
