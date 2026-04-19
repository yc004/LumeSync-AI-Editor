import { useEffect, useRef, useState } from 'react';
import tailwindRuntimeSource from '../../../teacher/shared/public/lib/tailwindcss.js?raw';
import { createAssetUrlMap, rewriteSlideAssetReferences } from '../lib/assetPreview';
import { ensureCoreRuntime } from '../lib/coreRuntime';
import { normalizeRuntimeForCore } from '../lib/manifestRuntime';
import { scheduleTeacherContentScale } from '../lib/teacherContentScale';
import { getCourseRenderScale } from '../lib/renderScale';
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
const escapedTailwindRuntimeSource = tailwindRuntimeSource.replace(/<\/script/gi, '<\\/script');

const writeSceneFrameDocument = (iframe: HTMLIFrameElement) => {
  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    throw new Error('Thumbnail iframe is not available.');
  }

  frameDocument.open();
  frameDocument.write(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #0f172a;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  #thumb-root {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #0f172a;
  }

  .core-preview-mount {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1280px;
    height: 720px;
    transform: translate(-50%, -50%) scale(var(--scene-thumb-scale, 1));
    transform-origin: center center;
  }

  .core-preview-mount > div {
    width: 1280px !important;
    height: 720px !important;
    min-height: 720px !important;
    padding: 0 !important;
    background: transparent !important;
  }

  .core-preview-mount [data-export-page] {
    width: 1280px !important;
    max-width: none !important;
    height: 720px !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
  }

  .core-preview-mount [data-export-page] > div {
    width: 1280px !important;
    height: 720px !important;
    margin: 0 !important;
    border-radius: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
  }
</style>
<script>${escapedTailwindRuntimeSource}</script>
<script>
  tailwind.config = {
    theme: {
      screens: { sm: '10px', md: '10px', lg: '10px', xl: '10px', '2xl': '10px' },
      extend: {
        height: { screen: '100%' },
        width: { screen: '100%' },
        minHeight: { screen: '100%' },
        minWidth: { screen: '100%' }
      }
    }
  };
</script>
</head>
<body>
  <div id="thumb-root"><div id="core-preview-mount" class="core-preview-mount"></div></div>
</body>
</html>`);
  frameDocument.close();

  const mountElement = frameDocument.getElementById('core-preview-mount');
  if (!mountElement) {
    throw new Error('Thumbnail iframe mount element was not created.');
  }

  return { frameWindow, mountElement };
};

const updateSceneFrameScale = (iframe: HTMLIFrameElement | null) => {
  if (!iframe?.contentDocument) return;
  const rect = iframe.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  iframe.contentDocument.documentElement.style.setProperty(
    '--scene-thumb-scale',
    String(Math.min(rect.width / 1280, rect.height / 720)),
  );
};

function SceneThumbnail({ manifest, page, slide, assets = [] }: SceneThumbnailProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement) return;

    const updateScale = () => updateSceneFrameScale(frameElement);
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frameElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement || !slide) return;

    let cancelled = false;
    let renderedRoot: { unmount?: () => void } | undefined;
    const assetUrlMap = createAssetUrlMap(assets);

    setFailed(false);

    try {
      const { frameWindow, mountElement } = writeSceneFrameDocument(frameElement);
      updateSceneFrameScale(frameElement);
      const previewSlide = rewriteSlideAssetReferences(slide, assetUrlMap.urls);

      ensureCoreRuntime(frameWindow)
        .then(async (runtime) => {
          const previewManifest = normalizeRuntimeForCore({
            ...manifest,
            pages: [page],
          });
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
          if (cancelled || !mountElement.isConnected) return;

          renderedRoot = runtime.renderCourseExportDocument(mountElement, {
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

          const contentScale = getCourseRenderScale(manifest);
          scheduleTeacherContentScale(frameWindow, mountElement, contentScale, () => cancelled);
        })
        .catch((error) => {
          console.error('[ai-editor] scene thumbnail render failed:', error);
          if (!cancelled) setFailed(true);
        });
    } catch (error) {
      console.error('[ai-editor] scene thumbnail iframe failed:', error);
      assetUrlMap.revoke();
      setFailed(true);
    }

    return () => {
      cancelled = true;
      renderedRoot?.unmount?.();
      assetUrlMap.revoke();
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

  return <iframe ref={frameRef} className="scene-thumb-frame" title={`页面缩略图: ${page.title}`} />;
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





