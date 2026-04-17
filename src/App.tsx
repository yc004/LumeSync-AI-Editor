import { useEffect, useMemo, useState } from 'react';
import ChatSidebar from './components/ChatSidebar';
import CodePreviewView from './components/CodePreviewView';
import { getBridge } from './lib/bridge';
import type { ChatAction, ChatMessage, CourseManifest, SlideSource } from './lib/types';

const emptyManifest: CourseManifest = {
  id: 'loading',
  title: 'Loading course...',
  pages: [],
};

export default function App() {
  const bridge = useMemo(() => getBridge(), []);
  const [manifest, setManifest] = useState<CourseManifest>(emptyManifest);
  const [slides, setSlides] = useState<SlideSource[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState('');
  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>('preview');

  useEffect(() => {
    const unsubscribe = bridge.onMessage((message) => {
      if (message.type === 'bootstrap') {
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
    if (!currentSlide) {
      return;
    }
    bridge.saveSlideSource({ file: currentSlide.file, source: currentSlide.source });
  };

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
              onSave={handleSave}
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
