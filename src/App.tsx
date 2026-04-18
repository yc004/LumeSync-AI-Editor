import { useEffect, useMemo, useRef, useState } from 'react';
import { editCourseWithAi, testAiConnection } from './ai/openai';
import ChatSidebar from './components/ChatSidebar';
import CodePreviewView from './components/CodePreviewView';
import CourseConfigDialog from './components/CourseConfigDialog';
import HomeScreen from './components/HomeScreen';
import SceneSidebar from './components/SceneSidebar';
import SettingsDialog from './components/SettingsDialog';
import { getBridge } from './lib/bridge';
import type { AiSettings, BootstrapPayload, ChatAction, ChatMessage, CourseAssetSource, CourseManifest, SlideSource } from './lib/types';

type RecentCourseEntry = {
  id: string;
  title: string;
  pageCount: number;
  lastOpenedAt: string;
  manifest: CourseManifest;
  slides: SlideSource[];
  chat: ChatMessage[];
};

const recentCoursesStorageKey = 'lumesync-ai-editor-history';
const aiSettingsStorageKey = 'lumesync-ai-editor-settings';

const emptyManifest: CourseManifest = {
  id: 'loading',
  title: '正在加载课件...',
  pages: [],
};

const newCourseSource = `export default function OpeningSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 p-14 text-white">
      <section className="w-full max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200">新课开始</p>
        <h1 className="mt-5 text-6xl font-black leading-tight">设计下一页 AI 课堂场景。</h1>
        <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-200">
          先写下教学目标，再用编辑器生成讲义、舞台画面和课堂页面逻辑，逐步完善整节课的中文表达。
        </p>
      </section>
    </div>
  );
}
`;

const loadRecentCourses = (): RecentCourseEntry[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(recentCoursesStorageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is RecentCourseEntry => {
        return Boolean(
          item &&
            typeof item === 'object' &&
            'id' in item &&
            'title' in item &&
            'lastOpenedAt' in item &&
            'manifest' in item &&
            'slides' in item &&
            'chat' in item,
        );
      })
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  } catch {
    return [];
  }
};

const saveRecentCourses = (entries: RecentCourseEntry[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(recentCoursesStorageKey, JSON.stringify(entries));
};

const loadAiSettings = (): AiSettings => {
  if (typeof window === 'undefined') {
    return { model: '', baseUrl: '', apiKey: '' };
  }

  try {
    const raw = window.localStorage.getItem(aiSettingsStorageKey);
    if (!raw) {
      return { model: '', baseUrl: '', apiKey: '' };
    }

    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      model: parsed.model ?? '',
      baseUrl: parsed.baseUrl ?? '',
      apiKey: parsed.apiKey ?? '',
    };
  } catch {
    return { model: '', baseUrl: '', apiKey: '' };
  }
};

export default function App() {
  const bridge = useMemo(() => getBridge(), []);
  const [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [manifest, setManifest] = useState<CourseManifest>(emptyManifest);
  const [slides, setSlides] = useState<SlideSource[]>([]);
  const [courseAssets, setCourseAssets] = useState<CourseAssetSource[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState('');
  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>('preview');
  const [recentCourses, setRecentCourses] = useState<RecentCourseEntry[]>(() => loadRecentCourses());
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [chatWidth, setChatWidth] = useState(340);
  const userCreatedCourseRef = useRef(false);

  const rememberCourse = (nextManifest: CourseManifest, nextSlides: SlideSource[], nextMessages: ChatMessage[]) => {
    if (!nextSlides.length || nextManifest.id === emptyManifest.id) {
      return;
    }

    setRecentCourses((previous) => {
      const nextEntry: RecentCourseEntry = {
        id: nextManifest.id,
        title: nextManifest.title.trim() || '未命名课程',
        pageCount: nextManifest.pages.length,
        lastOpenedAt: new Date().toISOString(),
        manifest: nextManifest,
        slides: nextSlides,
        chat: nextMessages,
      };

      const merged = [nextEntry, ...previous.filter((item) => item.id !== nextEntry.id)].slice(0, 12);
      saveRecentCourses(merged);
      return merged;
    });
  };

  const updateSlideSource = (file: string, source: string) => {
    setSlides((previous) => previous.map((slide) => (slide.file === file ? { ...slide, source } : slide)));
  };

  const updateCourseTitle = (title: string) => {
    setManifest((previous) => ({ ...previous, title }));
  };

  const normalizeCourseTitle = () => {
    setManifest((previous) => ({ ...previous, title: previous.title.trim() || '未命名课程' }));
  };

  const updatePageTitle = (pageId: string, title: string) => {
    const targetPage = manifest.pages.find((page) => page.id === pageId);
    setManifest((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => (page.id === pageId ? { ...page, title } : page)),
    }));

    if (targetPage?.file) {
      setSlides((previous) => previous.map((slide) => (slide.file === targetPage.file ? { ...slide, title } : slide)));
    }
  };

  const normalizeCurrentPageTitle = () => {
    const targetPage = manifest.pages.find((page) => page.id === currentSlideId);
    if (!targetPage) {
      return;
    }
    updatePageTitle(targetPage.id, targetPage.title.trim() || '未命名页面');
  };

  const openEditorWithCourse = (payload: BootstrapPayload, nextTab: 'code' | 'preview' = 'preview') => {
    userCreatedCourseRef.current = false;
    setManifest(payload.manifest);
    setSlides(payload.slides);
    setCourseAssets(payload.assets ?? []);
    setMessages(payload.chat);
    setCurrentSlideId(payload.manifest.pages[0]?.id ?? '');
    setCurrentTab(nextTab);
    setScreen('editor');
    setSidebarCollapsed(false);
    setChatCollapsed(false);
    rememberCourse(payload.manifest, payload.slides, payload.chat);
  };

  useEffect(() => {
    const unsubscribe = bridge.onMessage((message) => {
      if (message.type !== 'bootstrap') {
        return;
      }
      if (userCreatedCourseRef.current) {
        return;
      }
      setManifest(message.payload.manifest);
      setSlides(message.payload.slides);
      setCourseAssets(message.payload.assets ?? []);
      setMessages(message.payload.chat);
      setCurrentSlideId((current) => current || message.payload.manifest.pages[0]?.id || '');
      rememberCourse(message.payload.manifest, message.payload.slides, message.payload.chat);
    });

    bridge.requestInitialData();
    return unsubscribe;
  }, [bridge]);

  useEffect(() => {
    if (!aiBusy) {
      rememberCourse(manifest, slides, messages);
    }
  }, [aiBusy, manifest, slides, messages]);

  const currentPage = manifest.pages.find((page) => page.id === currentSlideId) ?? manifest.pages[0];
  const currentSlide = slides.find((slide) => slide.file === currentPage?.file) ?? slides[0];

  const saveAiSettings = (nextSettings: AiSettings) => {
    setAiSettings(nextSettings);
    window.localStorage.setItem(aiSettingsStorageKey, JSON.stringify(nextSettings));
    setSettingsOpen(false);
  };

  const runAiCourseEdit = async (prompt: string, targetSlideId?: string) => {
    if (!aiSettings.model || !aiSettings.baseUrl || !aiSettings.apiKey) {
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: '请先完成 AI 配置，再继续编辑课件。需要填写模型名称、接口地址和 API Key。',
        },
      ]);
      setSettingsOpen(true);
      return;
    }

    const assistantMessageId = `assistant-${Date.now()}`;
    setChatCollapsed(false);
    setMessages((previous) => [
      ...previous,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '正在连接 AI...',
      },
    ]);
    setAiBusy(true);
    try {
      const edit = await editCourseWithAi({
        settings: aiSettings,
        manifest,
        slides,
        currentSlideId: targetSlideId ?? currentPage?.id,
        prompt,
        onDelta: (_delta, fullText) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: fullText || '正在接收 AI 输出...',
                  }
                : message,
            ),
          );
        },
      });

      setManifest(edit.manifest);
      setSlides(edit.slides);
      setCurrentSlideId(edit.currentSlideId ?? edit.manifest.pages[0]?.id ?? '');
      setCurrentTab(edit.tab ?? 'preview');
      setMessages((previous) => previous.map((message) => (message.id === assistantMessageId ? { ...message, content: edit.message } : message)));
    } catch (error: unknown) {
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `AI 编辑失败：${error instanceof Error ? error.message : '未知错误'}`,
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  };

  const handleChatAction = (action: ChatAction) => {
    const targetId = action.targetSlideId ?? currentPage?.id;
    if (!targetId) {
      return;
    }

    setCurrentSlideId(targetId);

    if (action.id === 'apply-slide') {
      void runAiCourseEdit('请把这条 AI 建议正式应用到当前课件中。可以修改课程配置、页面顺序、页面标题和 TSX 源码，但必须遵守 LumeSync 课件格式与 OpenMAIC 风格设计规则。', targetId);
      return;
    }

    void runAiCourseEdit('请保持 OpenMAIC 的界面节奏和课堂舞台感，但把这一页的内容和表达方式优化成更自然的中文教学页面。', targetId);
  };

  const handleSubmit = (content: string) => {
    setMessages((previous) => [...previous, { id: `user-${Date.now()}`, role: 'user', content }]);
    void runAiCourseEdit(content);
  };

  const handleSave = () => {
    if (!slides.length) {
      return;
    }
    bridge.saveCourse({ manifest, slides, assets: courseAssets });
  };

  const handleSaveCourseConfig = (nextManifest: CourseManifest) => {
    setManifest(nextManifest);
    setSlides((previous) =>
      previous.map((slide) => {
        const page = nextManifest.pages.find((item) => item.file === slide.file);
        return page ? { ...slide, title: page.title } : slide;
      }),
    );
    setCurrentSlideId((current) => {
      if (nextManifest.pages.some((page) => page.id === current)) {
        return current;
      }
      return nextManifest.pages[0]?.id ?? '';
    });
    setConfigOpen(false);
  };

  const handleCreateCourse = () => {
    const nextCourseId = `course-${Date.now()}`;
    const nextManifest: CourseManifest = {
      schemaVersion: '1.0.0',
      id: nextCourseId,
      title: '新建 AI 课程',
      runtime: {
        format: 'lumesync-zip',
        react: '18',
        slideModule: 'tsx',
        entryMode: 'pages',
        preferredAspectRatio: '16:9',
      },
      pages: [{ id: 'opening', title: '开场页', file: 'slides/OpeningSlide.tsx' }],
    };
    const nextSlides: SlideSource[] = [
      {
        file: 'slides/OpeningSlide.tsx',
        title: '开场页',
        source: newCourseSource,
      },
    ];

    userCreatedCourseRef.current = true;
    setManifest(nextManifest);
    setSlides(nextSlides);
    setCourseAssets([]);
    setMessages([]);
    setCurrentSlideId(nextManifest.pages[0]?.id ?? '');
    setCurrentTab('preview');
    setScreen('editor');
    setSidebarCollapsed(false);
    setChatCollapsed(false);
    bridge.createCourse({ source: newCourseSource });
    rememberCourse(nextManifest, nextSlides, []);
  };

  const handleOpenCourse = async () => {
    const payload = await bridge.openCourse();
    if (!payload) {
      return;
    }
    openEditorWithCourse(payload);
  };

  const handleOpenRecentCourse = (courseId: string) => {
    const entry = recentCourses.find((item) => item.id === courseId);
    if (!entry) {
      return;
    }

    openEditorWithCourse(
      {
        manifest: entry.manifest,
        slides: entry.slides,
        chat: entry.chat,
      },
      'preview',
    );
  };

  const handleDeleteRecentCourse = (courseId: string) => {
    setRecentCourses((previous) => {
      const nextEntries = previous.filter((item) => item.id !== courseId);
      saveRecentCourses(nextEntries);
      return nextEntries;
    });
  };

  if (screen === 'home') {
    return (
      <>
        <SettingsDialog
          open={settingsOpen}
          initialSettings={aiSettings}
          onClose={() => setSettingsOpen(false)}
          onSave={saveAiSettings}
          onTestConnection={testAiConnection}
        />
        <HomeScreen
          recentCourses={recentCourses}
          onCreateCourse={handleCreateCourse}
          onOpenLocalCourse={handleOpenCourse}
          onOpenRecentCourse={handleOpenRecentCourse}
          onDeleteRecentCourse={handleDeleteRecentCourse}
        />
      </>
    );
  }

  return (
    <>
      <SettingsDialog
        open={settingsOpen}
        initialSettings={aiSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveAiSettings}
        onTestConnection={testAiConnection}
      />
      <CourseConfigDialog open={configOpen} manifest={manifest} onClose={() => setConfigOpen(false)} onSave={handleSaveCourseConfig} />
      <main className="app-shell openmaic-shell">
        <section className="editor-grid openmaic-editor-grid">
          <SceneSidebar
            manifest={manifest}
            slides={slides}
            assets={courseAssets}
            currentSlideId={currentPage?.id ?? ''}
            collapsed={sidebarCollapsed}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onCollapseChange={setSidebarCollapsed}
            onSelectSlide={setCurrentSlideId}
          />

          <section className="workspace-column">
            {currentSlide ? (
              <CodePreviewView
                tab={currentTab}
                manifest={manifest}
                slides={slides}
                assets={courseAssets}
                currentSlideId={currentPage?.id ?? ''}
                sidebarCollapsed={sidebarCollapsed}
                chatCollapsed={chatCollapsed}
                onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
                onToggleChat={() => setChatCollapsed((value) => !value)}
                onTabChange={setCurrentTab}
                onSelectSlide={setCurrentSlideId}
                onSourceChange={updateSlideSource}
                onTitleChange={updateCourseTitle}
                onTitleBlur={normalizeCourseTitle}
                onPageTitleChange={updatePageTitle}
                onPageTitleBlur={normalizeCurrentPageTitle}
                onOpenConfig={() => setConfigOpen(true)}
                onSave={handleSave}
                onBackHome={() => setScreen('home')}
              />
            ) : (
              <section className="workspace-panel empty-state">
                <h2>当前课程还没有可编辑页面</h2>
                <p>你可以先创建一节新课，或者导入现有 `.lume` 课程后继续编辑。</p>
              </section>
            )}
          </section>

          <ChatSidebar
            manifest={manifest}
            messages={messages}
            onAction={handleChatAction}
            onSubmit={handleSubmit}
            onOpenSettings={() => setSettingsOpen(true)}
            aiSettings={aiSettings}
            aiBusy={aiBusy}
            collapsed={chatCollapsed}
            width={chatWidth}
            onWidthChange={setChatWidth}
            onCollapseChange={setChatCollapsed}
          />
        </section>
      </main>
    </>
  );
}
