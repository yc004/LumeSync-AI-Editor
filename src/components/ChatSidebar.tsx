import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiSettings, ChatAction, ChatMessage, CourseManifest } from '../lib/types';

marked.setOptions({ breaks: true });

type ChatSidebarProps = {
  manifest: CourseManifest;
  messages: ChatMessage[];
  onAction: (action: ChatAction) => void;
  onSubmit: (content: string) => void;
  onOpenSettings: () => void;
  aiSettings: AiSettings;
  aiBusy: boolean;
  collapsed: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onCollapseChange: (collapsed: boolean) => void;
};

const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

export default function ChatSidebar({
  manifest,
  messages,
  onAction,
  onSubmit,
  onOpenSettings,
  aiSettings,
  aiBusy,
  collapsed,
  width,
  onWidthChange,
  onCollapseChange,
}: ChatSidebarProps) {
  const [draft, setDraft] = useState('');
  const [activeTab, setActiveTab] = useState<'lecture' | 'chat'>('lecture');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        html: marked.parse(message.content) as string,
      })),
    [messages],
  );

  const submitDraft = (value: string) => {
    const next = value.trim();
    if (!next) {
      return;
    }

    onSubmit(next);
    setDraft('');
    setActiveTab('chat');
  };

  useEffect(() => {
    if (activeTab !== 'chat') {
      return;
    }

    const scrollElement = chatScrollRef.current;
    if (!scrollElement) {
      return;
    }

    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [activeTab, renderedMessages]);

  return (
    <aside className="chat-sidebar" style={{ width: collapsed ? 0 : width }}>
      {!collapsed ? (
        <>
          <div
            className="chat-sidebar-resize"
            onMouseDown={(event) => {
              event.preventDefault();
              const startX = event.clientX;
              const startWidth = width;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const delta = startX - moveEvent.clientX;
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

          <div className="chat-sidebar-inner">
            <div className="chat-sidebar-topbar">
              <div className="chat-tab-switcher" role="tablist" aria-label="右侧栏视图">
                <button
                  type="button"
                  className={activeTab === 'lecture' ? 'chat-tab active' : 'chat-tab'}
                  onClick={() => setActiveTab('lecture')}
                >
                  课件
                </button>
                <button type="button" className={activeTab === 'chat' ? 'chat-tab active' : 'chat-tab'} onClick={() => setActiveTab('chat')}>
                  AI
                </button>
              </div>

              <div className="chat-topbar-actions">
                <button type="button" className="chat-ghost-button" onClick={() => onCollapseChange(true)}>
                  收起
                </button>
                <button type="button" className="chat-ghost-button" onClick={onOpenSettings}>
                  设置
                </button>
              </div>
            </div>

            {activeTab === 'lecture' ? (
              <div className="lecture-notes-panel custom-scrollbar">
                <div className="lecture-notes-header">
                  <p className="lecture-notes-eyebrow">当前课件</p>
                  <h2>{manifest.title}</h2>
                </div>

                <div className="lecture-note-list">
                  {manifest.pages.map((page, index) => (
                    <article key={page.id} className={index === 0 ? 'lecture-note-card current' : 'lecture-note-card'}>
                      <div className="lecture-note-head">
                        <div className="lecture-note-order">第 {index + 1} 页</div>
                        {index === 0 ? <span className="lecture-note-current">首页</span> : null}
                      </div>
                      <strong>{page.title}</strong>
                      <p>{page.file}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div ref={chatScrollRef} className="chat-scroll-region custom-scrollbar" data-testid="chat-history">
                  {renderedMessages.length ? (
                    renderedMessages.map((message, index) => (
                      <article key={message.id} className={index === renderedMessages.length - 1 ? 'session-card current' : 'session-card'}>
                        <button type="button" className="session-card-header">
                          <span className={message.role === 'assistant' ? 'session-dot assistant' : 'session-dot user'} />
                          <span className="session-badge">{message.role === 'assistant' ? 'AI' : '你'}</span>
                          <span className="session-title">对话 {String(index + 1).padStart(2, '0')}</span>
                          {message.actions?.length ? <span className="session-count">{message.actions.length}</span> : null}
                        </button>
                        <div className="session-card-body">
                          <div className={message.role === 'user' ? 'chat-message-row user' : 'chat-message-row'}>
                            <div className="chat-avatar">{message.role === 'assistant' ? 'AI' : '我'}</div>
                            <div className={message.role === 'assistant' ? 'chat-message-stack' : 'chat-message-stack user'}>
                              <span className={message.role === 'assistant' ? 'chat-sender-label' : 'chat-sender-label user'}>
                                {message.role === 'assistant' ? '课件助手' : '你'}
                              </span>
                              <div className={message.role === 'assistant' ? 'chat-bubble assistant' : 'chat-bubble user'}>
                                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: message.html }} />
                              </div>
                            </div>
                            {message.actions?.length ? (
                              <div className="chat-actions">
                                {message.actions.map((action) => (
                                  <button
                                    key={`${message.id}-${action.id}-${action.targetSlideId ?? 'self'}`}
                                    type="button"
                                    onClick={() => onAction(action)}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="chat-empty-state">
                      <p>还没有真实对话</p>
                      <small>输入课件修改需求后，这里只会显示你和 AI 的实际交互记录。</small>
                    </div>
                  )}
                </div>

                <div className="chat-composer-wrap">
                  <div className="chat-composer chat-composer-single">
                    <textarea
                      data-testid="chat-input"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="告诉 AI 你要修改课件名称、页面结构、视觉风格、同步交互或某一页内容。"
                      rows={4}
                    />
                    <button type="button" className="primary-button" disabled={aiBusy} onClick={() => submitDraft(draft)}>
                      {aiBusy ? '生成中...' : '发送'}
                    </button>
                  </div>
                  <div className="chat-status-line">{aiSettings.model ? aiSettings.model : '尚未配置 AI 模型'}</div>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </aside>
  );
}
