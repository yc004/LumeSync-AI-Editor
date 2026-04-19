import { useEffect, useMemo, useRef, useState } from "react";
import tailwindRuntimeSource from "../../../teacher/shared/public/lib/tailwindcss.js?raw";
import {
  createAssetUrlMap,
  rewriteSlideAssetReferences,
} from "../lib/assetPreview";
import { ensureCoreRuntime } from "../lib/coreRuntime";
import { normalizeRuntimeForCore } from "../lib/manifestRuntime";
import { scheduleTeacherContentScale } from '../lib/teacherContentScale';
import { getCourseRenderScale } from "../lib/renderScale";
import type {
  CourseAssetSource,
  CourseManifest,
  SlideSource,
} from "../lib/types";

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
  page: CourseManifest["pages"][number];
  slide?: OrderedSlide;
  assets?: CourseAssetSource[];
  index: number;
  total: number;
  isActive: boolean;
  onSelectSlide: (slideId: string) => void;
};

const escapedTailwindRuntimeSource = tailwindRuntimeSource.replace(
  /<\/script/gi,
  "<\\/script",
);

const writePreviewFrameDocument = (iframe: HTMLIFrameElement) => {
  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    throw new Error("Preview iframe is not available.");
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

  #preview-root {
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
    transform: translate(-50%, -50%) scale(var(--preview-page-scale, 1));
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
  <div id="preview-root"><div id="core-preview-mount" class="core-preview-mount"></div></div>
</body>
</html>`);
  frameDocument.close();

  const mountElement = frameDocument.getElementById("core-preview-mount");
  if (!mountElement) {
    throw new Error("Preview iframe mount element was not created.");
  }

  return { frameWindow, frameDocument, mountElement };
};

const updatePreviewFrameScale = (iframe: HTMLIFrameElement | null) => {
  if (!iframe?.contentDocument) return;
  const rect = iframe.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  iframe.contentDocument.documentElement.style.setProperty(
    "--preview-page-scale",
    String(Math.min(rect.width / 1280, rect.height / 720)),
  );
};

function PreviewPageCard({
  manifest,
  page,
  slide,
  assets = [],
  index,
  total,
  isActive,
  onSelectSlide,
}: PreviewPageCardProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement) return;

    const updateScale = () => updatePreviewFrameScale(frameElement);
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frameElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement || !slide) {
      setState("error");
      setError("Slide source was not found.");
      return;
    }

    let cancelled = false;
    let renderedRoot: { unmount?: () => void } | undefined;
    const assetUrlMap = createAssetUrlMap(assets);

    setState("loading");
    setError("");

    try {
      const { frameWindow, frameDocument, mountElement } =
        writePreviewFrameDocument(frameElement);
      updatePreviewFrameScale(frameElement);
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

          window.setTimeout(() => {
            if (!cancelled) setState("ready");
          }, 80);
        })
        .catch((renderError: unknown) => {
          if (cancelled) return;
          console.error("[ai-editor] page preview render failed:", renderError);
          setState("error");
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Preview sandbox failed to initialize.",
          );
        });

      return () => {
        cancelled = true;
        renderedRoot?.unmount?.();
        assetUrlMap.revoke();
      };
    } catch (renderError) {
      assetUrlMap.revoke();
      console.error("[ai-editor] page preview iframe failed:", renderError);
      setState("error");
      setError(
        renderError instanceof Error
          ? renderError.message
          : "Preview sandbox failed to initialize.",
      );
    }
  }, [assets, manifest, page, slide]);

  return (
    <section
      className={isActive ? "preview-page-card active" : "preview-page-card"}
      data-page-id={page.id}
      data-testid={`preview-page-${page.id}`}
      onClick={() => onSelectSlide(page.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectSlide(page.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`预览页面 ${index + 1} / ${total}：${page.title}`}
    >
      <iframe
        ref={frameRef}
        className="preview-page-frame"
        title={`预览页面 ${index + 1}: ${page.title}`}
      />
      <div className="preview-page-overlay-layer">
        {state === "loading" ? (
          <div className="preview-page-overlay">
            <strong>Rendering page</strong>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="preview-page-overlay error">
            <strong>Preview unavailable</strong>
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function PreviewStage({
  manifest,
  slides,
  assets = [],
  currentSlideId,
  onSelectSlide,
}: PreviewStageProps) {
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
    if (!previewDocument || !currentSlideId) return;

    const activePage = previewDocument.querySelector<HTMLElement>(
      `[data-page-id="${CSS.escape(currentSlideId)}"]`,
    );
    if (!activePage) return;

    const documentRect = previewDocument.getBoundingClientRect();
    const pageRect = activePage.getBoundingClientRect();
    const coversViewportFocus =
      pageRect.bottom > documentRect.top + documentRect.height * 0.25 &&
      pageRect.top < documentRect.bottom - documentRect.height * 0.25;

    if (coversViewportFocus) return;

    autoScrollingRef.current = true;
    if (autoScrollTimeoutRef.current !== undefined) {
      window.clearTimeout(autoScrollTimeoutRef.current);
    }
    const scrollBehavior: ScrollBehavior = hasPositionedRef.current
      ? "smooth"
      : "auto";
    activePage.scrollIntoView({
      behavior: scrollBehavior,
      block: "start",
      inline: "nearest",
    });
    hasPositionedRef.current = true;
    autoScrollTimeoutRef.current = window.setTimeout(
      () => {
        autoScrollingRef.current = false;
        autoScrollTimeoutRef.current = undefined;
      },
      scrollBehavior === "smooth" ? 520 : 80,
    );
  }, [currentSlideId]);

  useEffect(() => {
    const previewDocument = previewDocumentRef.current;
    if (!previewDocument) return;

    const syncCurrentPageFromScroll = () => {
      const pages = Array.from(
        previewDocument.querySelectorAll<HTMLElement>("[data-page-id]"),
      );
      if (!pages.length) return;

      const viewportCenter =
        previewDocument.getBoundingClientRect().top +
        previewDocument.clientHeight / 2;
      const closestPage = pages.reduce(
        (closest, page) => {
          const pageRect = page.getBoundingClientRect();
          const pageCenter = pageRect.top + pageRect.height / 2;
          const distance = Math.abs(pageCenter - viewportCenter);
          return distance < closest.distance ? { page, distance } : closest;
        },
        { page: pages[0], distance: Number.POSITIVE_INFINITY },
      );

      const pageId = closestPage.page.dataset.pageId;
      if (pageId && pageId !== currentSlideId) {
        onSelectSlide(pageId);
      }
    };

    const handleScroll = () => {
      if (autoScrollingRef.current) return;

      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = window.requestAnimationFrame(
        syncCurrentPageFromScroll,
      );
    };

    previewDocument.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      previewDocument.removeEventListener("scroll", handleScroll);
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
    <div
      ref={previewDocumentRef}
      className="preview-shell custom-scrollbar"
      data-testid="preview-stage"
    >
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







