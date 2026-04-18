import { useEffect, useRef, useState } from 'react';
import { ensureCoreRuntime } from '../lib/coreRuntime';
import { createAssetUrlMap, rewriteSlideAssetReferences } from '../lib/assetPreview';
import type { CourseAssetSource, CourseManifest, SlideSource } from '../lib/types';

type SceneSidebarProps = {
  manifest: CourseManifest;
  slides: SlideSource[];
  assets?: CourseAssetSource[];
  currentSlideId: string;
  collapsed: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onCollapseChange: (collapsed: boolean) => void;
  onSelectSlide: (slideId: string) => void;
};

type SceneThumbnailProps = {
  manifest: CourseManifest;
  page: CourseManifest['pages'][number];
  slide?: SlideSource;
  assets?: CourseAssetSource[];
};

const MIN_WIDTH = 170;
const MAX_WIDTH = 400;

function SceneThumbnail({ manifest, page, slide, assets = [] }: SceneThumbnailProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

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
      const nextScale = Math.min(rect.width / 1280, rect.height / 720);
      mountElement.style.setProperty('--scene-thumb-scale', String(nextScale));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(mountElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement || !slide) {
      return;
    }

    let cancelled = false;
    let renderedRoot: { unmount?: () => void } | undefined;
    const renderElement = document.createElement('div');
    renderElement.className = 'core-preview-mount';

    setFailed(false);
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
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
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

  if (failed || !slide) {
    return (
      <div className="scene-thumb-fallback">
        <strong>{page.title}</strong>
        <span>暂无缩略图</span>
      </div>
    );
  }

  return <div ref={mountRef} className="scene-thumb-runtime" />;
}

export default function SceneSidebar({
  manifest,
  slides,
  assets = [],
  currentSlideId,
  collapsed,
  width,
  onWidthChange,
  onCollapseChange,
  onSelectSlide,
}: SceneSidebarProps) {
  return (
    <aside
      className="scene-sidebar"
      style={{
        width: collapsed ? 0 : width,
      }}
    >
      {!collapsed ? (
        <>
          <div
            className="scene-sidebar-resize"
            onMouseDown={(event) => {
              event.preventDefault();
              const startX = event.clientX;
              const startWidth = width;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const delta = moveEvent.clientX - startX;
                const nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
                onWidthChange(nextWidth);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };

              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />

          <div className="scene-sidebar-inner">
            <div className="scene-sidebar-header">
              <div className="scene-brand">
                <span className="scene-brand-mark">LS</span>
                <span className="scene-brand-text">课程场景</span>
              </div>
              <button type="button" className="scene-collapse-button" onClick={() => onCollapseChange(true)}>
                收起
              </button>
            </div>

            <div className="scene-list custom-scrollbar" data-testid="scene-list">
              {manifest.pages.map((page, index) => {
                const isActive = page.id === currentSlideId;
                const slide = slides.find((item) => item.file === page.file);
                const sourceSize = slide?.source.length ?? 0;

                return (
                  <button
                    key={page.id}
                    type="button"
                    className={isActive ? 'scene-card active' : 'scene-card'}
                    data-testid={`scene-item-${page.id}`}
                    onClick={() => onSelectSlide(page.id)}
                  >
                    <div className="scene-card-meta">
                      <span className="scene-index">{index + 1}</span>
                      <span className="scene-chip">页面</span>
                    </div>
                    <div className="scene-thumb">
                      <SceneThumbnail manifest={manifest} page={page} slide={slide} assets={assets} />
                    </div>
                    <div className="scene-card-copy">
                      <strong>{page.title}</strong>
                      <small>{sourceSize} 字符</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
