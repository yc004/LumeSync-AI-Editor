import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import CourseConfigPanel from './CourseConfigPanel';
import type { AiSettings, ChatAction, ChatMessage, CourseManifest } from '../lib/types';

marked.setOptions({ breaks: true });

type RightPanelTab = 'config' | 'chat';

type ChatSidebarProps = {
  manifest: CourseManifest;
  messages: ChatMessage[];
  onAction: (action: ChatAction) => void;
  onSubmit: (content: string) => void;
  onOpenSettings: () => void;
  onSaveCourseConfig: (manifest: CourseManifest) => void;
  aiSettings: AiSettings;
  aiBusy: boolean;
  collapsed: boolean;
  width: number;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onWidthChange: (width: number) => void;
  onCollapseChange: (collapsed: boolean) => void;
};

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

export default function ChatSidebar({
  manifest,
  messages,
  onAction,
  onSubmit,
  onOpenSettings,
  onSaveCourseConfig,
  aiSettings,
  aiBusy,
  collapsed,
  width,
  activeTab,
  onTabChange,
  onWidthChange,
  onCollapseChange,
}: ChatSidebarProps) {
  const [draft, setDraft] = useState('');
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
    if (!next) return;

    onSubmit(next);
    setDraft('');
    onTabChange('chat');
  };

  useEffect(() => {
    if (activeTab !== 'chat') return;

    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;

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
                <button type="button" className={activeTab === 'config' ? 'chat-tab active' : 'chat-tab'} onClick={() => onTabChange('config')}>
                  课件基础配置
                </button>
                <button type="button" className={activeTab === 'chat' ? 'chat-tab active' : 'chat-tab'} onClick={() => onTabChange('chat')}>
                  AI
                </button>
              </div>

              <div className="chat-topbar-actions">
                <button type="button" className="chat-ghost-button" onClick={() => onCollapseChange(true)}>
                  收起
                </button>
                <button type="button" className="chat-ghost-button" onClick={onOpenSettings}>
                  AI 配置
                </button>
              </div>
            </div>

            {activeTab === 'config' ? (
              <div className="course-config-tab-panel custom-scrollbar">
                <CourseConfigPanel manifest={manifest} onSave={onSaveCourseConfig} compact />
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
                                  <button key={`${message.id}-${action.id}-${action.targetSlideId ?? 'self'}`} type="button" onClick={() => onAction(action)}>
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
