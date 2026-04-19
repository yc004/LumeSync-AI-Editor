import { useEffect, useRef, useState } from 'react';
import tailwindRuntimeSource from '../../../teacher/shared/public/lib/tailwindcss.js?raw';
import { ensureCoreRuntime } from '../lib/coreRuntime';
import { normalizeRuntimeForCore } from '../lib/manifestRuntime';
import { scheduleTeacherContentScale } from '../lib/teacherContentScale';
import { getCourseRenderScale } from '../lib/renderScale';
import type { CourseManifest, SlideSource } from '../lib/types';

type RecentCourseSummary = {
  id: string;
  title: string;
  pageCount: number;
  lastOpenedAt: string;
  manifest: CourseManifest;
  slides: SlideSource[];
};

type HomeScreenProps = {
  recentCourses: RecentCourseSummary[];
  onCreateCourse: () => void;
  onOpenLocalCourse: () => void;
  onOpenRecentCourse: (courseId: string) => void;
  onDeleteRecentCourse: (courseId: string) => void;
};

const escapedTailwindRuntimeSource = tailwindRuntimeSource.replace(/<\/script/gi, '<\\/script');

const writeHistoryFrameDocument = (iframe: HTMLIFrameElement) => {
  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    throw new Error('History thumbnail iframe is not available.');
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

  #history-root {
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
    transform: translate(-50%, -50%) scale(var(--history-thumb-scale, 1));
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
  <div id="history-root"><div id="core-preview-mount" class="core-preview-mount"></div></div>
</body>
</html>`);
  frameDocument.close();

  const mountElement = frameDocument.getElementById('core-preview-mount');
  if (!mountElement) {
    throw new Error('History thumbnail iframe mount element was not created.');
  }

  return { frameWindow, mountElement };
};

const updateHistoryFrameScale = (iframe: HTMLIFrameElement | null) => {
  if (!iframe?.contentDocument) return;
  const rect = iframe.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  iframe.contentDocument.documentElement.style.setProperty(
    '--history-thumb-scale',
    String(Math.min(rect.width / 1280, rect.height / 720)),
  );
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
};

function RecentCourseCover({ course }: { course: RecentCourseSummary }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement) return;

    const updateScale = () => updateHistoryFrameScale(frameElement);
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frameElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement || !course.slides.length || !course.manifest.pages.length) return;

    let cancelled = false;
    let renderedRoot: { unmount?: () => void } | undefined;

    setFailed(false);

    try {
      const { frameWindow, mountElement } = writeHistoryFrameDocument(frameElement);
      updateHistoryFrameScale(frameElement);

      ensureCoreRuntime(frameWindow)
        .then(async (runtime) => {
          const firstPage = course.manifest.pages[0];
          const firstSlide = course.slides.find((slide) => slide.file === firstPage?.file) ?? course.slides[0];
          const previewManifest = normalizeRuntimeForCore({
            ...course.manifest,
            pages: firstPage ? [firstPage] : course.manifest.pages.slice(0, 1),
          });
          const previewSlides = firstSlide ? [firstSlide] : [];
          const courseData = await runtime.buildCourseDataFromMemory({
            manifest: previewManifest,
            slides: previewSlides,
            course: {
              id: course.manifest.id,
              title: course.title,
              desc: course.manifest.desc,
              icon: course.manifest.icon,
              color: course.manifest.color,
            },
          });
          return { runtime, courseData };
        })
        .then(({ runtime, courseData }) => {
          if (cancelled || !mountElement.isConnected) return;

          renderedRoot = runtime.renderCourseExportDocument(mountElement, {
            course: {
              id: course.manifest.id,
              title: course.title,
              desc: course.manifest.desc,
              icon: course.manifest.icon,
              color: course.manifest.color,
            },
            courseData,
            contentScale: 1,
          });

          const contentScale = getCourseRenderScale(course.manifest);
          scheduleTeacherContentScale(frameWindow, mountElement, contentScale, () => cancelled);
        })
        .catch((error) => {
          console.error('[ai-editor] history thumbnail render failed:', error);
          if (!cancelled) setFailed(true);
        });
    } catch (error) {
      console.error('[ai-editor] history thumbnail iframe failed:', error);
      setFailed(true);
    }

    return () => {
      cancelled = true;
      renderedRoot?.unmount?.();
    };
  }, [course]);

  if (failed || !course.slides.length) {
    return (
      <div className="history-thumb-fallback">
        <strong>{course.title}</strong>
        <span>暂无封面预览</span>
      </div>
    );
  }

  return <iframe ref={frameRef} className="history-thumb-frame" title={`最近课件封面: ${course.title}`} />;
}

export default function HomeScreen({
  recentCourses,
  onCreateCourse,
  onOpenLocalCourse,
  onOpenRecentCourse,
  onDeleteRecentCourse,
}: HomeScreenProps) {
  const [draft, setDraft] = useState('');

  return (
    <main className="openmaic-home custom-scrollbar" data-testid="home-screen">
      <div className="home-toolbar-pill">
        <button type="button" className="home-toolbar-icon icon-only" aria-label="切换语言">
          中
        </button>
        <span className="home-toolbar-divider" />
        <button type="button" className="home-toolbar-icon icon-only" aria-label="切换主题">
          亮
        </button>
        <span className="home-toolbar-divider" />
        <button type="button" className="home-toolbar-icon icon-only" aria-label="打开设置">
          设
        </button>
      </div>

      <div className="openmaic-home-backdrop" aria-hidden="true">
        <div className="openmaic-home-orb orb-left" />
        <div className="openmaic-home-orb orb-right" />
      </div>

      <section className={recentCourses.length ? 'openmaic-home-hero with-history' : 'openmaic-home-hero'}>
        <div className="openmaic-logo-lockup">
          <div className="openmaic-logo-mark">LS</div>
          <div className="openmaic-logo-text">
            <strong>LumeSync Editor</strong>
            <span>AI 教学编辑工作台</span>
          </div>
        </div>

        <p className="openmaic-home-slogan">把课程策划、舞台预览、讲义生成和 AI 协作收进一个中文教学工作流。</p>

        <div className="openmaic-home-composer">
          <div className="openmaic-home-composer-header">
            <div className="openmaic-home-greeting-bar">
              <div className="openmaic-home-avatar">
                <span>U</span>
                <i />
              </div>
              <div className="openmaic-home-greeting">
                <span className="openmaic-home-greeting-label">你好，Daniel</span>
                <strong>先写下这节课想讲什么，再进入编辑器把页面、讲稿和舞台效果展开。</strong>
              </div>
              <button type="button" className="openmaic-home-greeting-toggle" aria-label="展开个人信息">
                v
              </button>
            </div>
            <div className="openmaic-home-agentbar">
              <span className="agent-pill">教师</span>
              <span className="agent-pill">助教</span>
              <span className="agent-pill">教案</span>
            </div>
          </div>

          <div className="openmaic-home-input">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="输入你的课件需求，例如：为高中人工智能导论设计 3 页课堂课件，第一页介绍大模型概念，第二页讲提示词工程，第三页安排课堂练习。"
              aria-label="课件需求输入框"
              rows={5}
            />
          </div>

          <div className="openmaic-home-toolbar">
            <div className="openmaic-home-toolbar-left">
              <button type="button" className="composer-pill" onClick={onOpenLocalCourse}>
                打开 `.lume`
              </button>
              <span className="composer-pill secondary">中文课件输入</span>
              <span className="composer-pill secondary">Lume 渲染内核</span>
            </div>
            <button
              type="button"
              className="composer-send-button"
              data-testid="create-course"
              onClick={onCreateCourse}
            >
              进入编辑器
            </button>
          </div>
        </div>

        {!recentCourses.length ? (
          <button type="button" className="home-import-link" onClick={onOpenLocalCourse}>
            导入已有课堂
          </button>
        ) : null}
      </section>

      {recentCourses.length ? (
        <section className="openmaic-home-history">
          <div className="openmaic-home-history-header">
            <div className="history-divider-line" />
            <div className="history-toggle-wrap">
              <button type="button" className="history-toggle active">
                最近课件
              </button>
              <span className="history-toggle-meta">{recentCourses.length}</span>
              <button type="button" className="history-import-mini" onClick={onOpenLocalCourse}>
                导入课件
              </button>
            </div>
            <div className="history-divider-line" />
          </div>

          <div className="openmaic-home-history-grid">
            {recentCourses.map((course, index) => (
              <article
                key={course.id}
                className="openmaic-history-card"
                data-testid={`history-item-${course.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenRecentCourse(course.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenRecentCourse(course.id);
                  }
                }}
              >
                <div className="openmaic-history-card-head">
                  <span className="history-scene-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="history-card-actions">
                    <span className="history-scene-time">{formatTimestamp(course.lastOpenedAt)}</span>
                    <button
                      type="button"
                      className="history-delete-button"
                      aria-label={`删除最近课件：${course.title}`}
                      title="删除最近课件"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteRecentCourse(course.id);
                      }}
                    >
                      x
                    </button>
                  </span>
                </div>

                <div className="openmaic-history-thumb">
                  <RecentCourseCover course={course} />
                </div>

                <div className="openmaic-history-copy">
                  <strong>{course.title}</strong>
                  <small>{course.pageCount} 页</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}







