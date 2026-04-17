import { useEffect, useMemo, useRef, useState } from 'react';
import ChatSidebar from './components/ChatSidebar';
import CodePreviewView from './components/CodePreviewView';
import HomeScreen from './components/HomeScreen';
import { getBridge } from './lib/bridge';
import type { ChatAction, ChatMessage, CourseManifest, SlideSource } from './lib/types';

const emptyManifest: CourseManifest = {
  id: 'loading',
  title: 'Loading course...',
  pages: [],
};

const newCourseSource = `export default function OpeningSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 p-14 text-white">
      <section className="w-full max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-200">New lesson</p>
        <h1 className="mt-5 text-6xl font-black leading-tight">输入你的课件标题</h1>
        <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-200">
          在这里写下本节课的核心问题、目标或导入活动。
        </p>
      </section>
    </div>
  );
}
`;

const newCourseManifest: CourseManifest = {
  id: 'new-course',
  title: '未命名课件',
  pages: [{ id: 'opening', title: '第一页', file: 'slides/OpeningSlide.tsx' }],
};

const newCourseSlides: SlideSource[] = [
  {
    file: 'slides/OpeningSlide.tsx',
    title: '第一页',
    source: newCourseSource,
  },
];

const newCourseChat: ChatMessage[] = [
  {
    id: 'new-course-guide',
    role: 'assistant',
    content: '新课件已创建。先修改标题和导入语，再切到预览确认版式。',
  },
];

export default function App() {
  const bridge = useMemo(() => getBridge(), []);
  const [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [manifest, setManifest] = useState<CourseManifest>(emptyManifest);
  const [slides, setSlides] = useState<SlideSource[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState('');
  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>('preview');
  const userCreatedCourseRef = useRef(false);

  useEffect(() => {
    const unsubscribe = bridge.onMessage((message) => {
      if (message.type === 'bootstrap') {
        if (userCreatedCourseRef.current) {
          return;
        }
        setManifest(message.payload.manifest);
        setSlides(message.payload.slides);
        setMessages(message.payload.chat);
        setCurrentSlideId((current) => current || message.payload.manifest.pages[0]?.id || '');
      }

    });

    bridge.requestInitialData();
    return unsubscribe;
  }, [bridge]);

  const currentPage = manifest.pages.find((page) => page.id === currentSlideId) ?? manifest.pages[0];
  const currentSlide = slides.find((slide) => slide.file === currentPage?.file) ?? slides[0];

  const updateSlideSource = (file: string, source: string) => {
    setSlides((previous) => previous.map((slide) => (slide.file === file ? { ...slide, source } : slide)));
  };

  const updateCourseTitle = (title: string) => {
    setManifest((previous) => ({ ...previous, title }));
  };

  const normalizeCourseTitle = () => {
    setManifest((previous) => ({ ...previous, title: previous.title.trim() || 'Untitled course' }));
  };

  const handleChatAction = (action: ChatAction) => {
    const targetId = action.targetSlideId ?? currentPage?.id;
    if (!targetId) {
      return;
    }

    setCurrentSlideId(targetId);

    if (action.id === 'apply-slide') {
      const targetPage = manifest.pages.find((page) => page.id === targetId);
      if (!targetPage) {
        return;
      }
      const targetSlide = slides.find((slide) => slide.file === targetPage.file);
      if (!targetSlide) {
        return;
      }
      const patched = `${targetSlide.source.trim()}\n\n// Applied from AI collaboration panel`;
      updateSlideSource(targetSlide.file, patched);
      bridge.applyAiPatch({ target: targetId, content: patched });
      setCurrentTab('code');
      return;
    }

    bridge.rewriteSlide({ slideId: targetId, prompt: '请保留布局但强化页面叙事感。' });
    setCurrentTab('code');
  };

  const handleSubmit = (content: string) => {
    setMessages((previous) => [
      ...previous,
      { id: `user-${Date.now()}`, role: 'user', content },
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `已记录你的要求：**${content}**\n\n我会优先保持当前页结构稳定，只调整文案层次和讲述节奏。`,
        actions: currentPage ? [{ id: 'rewrite-slide', label: '重写本页', targetSlideId: currentPage.id }] : undefined,
      },
    ]);
    bridge.postMessage('chat-submit', { content });
  };

  const handleSave = () => {
    if (!slides.length) {
      return;
    }
    bridge.saveCourse({ manifest, slides });
  };

  const openEditor = () => {
    setCurrentSlideId((current) => current || manifest.pages[0]?.id || '');
    setCurrentTab('preview');
    setScreen('editor');
  };

  const handleCreateCourse = () => {
    userCreatedCourseRef.current = true;
    setManifest(newCourseManifest);
    setSlides(newCourseSlides);
    setMessages(newCourseChat);
    setCurrentSlideId(newCourseManifest.pages[0]?.id ?? '');
    setCurrentTab('code');
    setScreen('editor');
    bridge.createCourse({ source: newCourseSource });
  };

  const handleOpenCourse = () => {
    userCreatedCourseRef.current = false;
    bridge.openCourse();
    openEditor();
  };

  if (screen === 'home') {
    return (
      <HomeScreen
        hasLoadedCourse={slides.length > 0}
        courseTitle={manifest.title}
        onCreateCourse={handleCreateCourse}
        onOpenCourse={handleOpenCourse}
        onContinueCourse={openEditor}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="app-background" />
      <section className="editor-grid">
        <ChatSidebar messages={messages} onAction={handleChatAction} onSubmit={handleSubmit} />

        <section className="workspace-column">
          {currentSlide ? (
            <CodePreviewView
              tab={currentTab}
              manifest={manifest}
              slides={slides}
              currentSlideId={currentPage?.id ?? ''}
              onTabChange={setCurrentTab}
              onSelectSlide={setCurrentSlideId}
              onSourceChange={updateSlideSource}
              onTitleChange={updateCourseTitle}
              onTitleBlur={normalizeCourseTitle}
              onSave={handleSave}
              onBackHome={() => setScreen('home')}
            />
          ) : (
            <section className="workspace-panel glass-panel empty-state">
              <h2>暂无可编辑页面</h2>
              <p>等待宿主提供 `.lume` 课件内容。</p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
