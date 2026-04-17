import { marked } from 'marked';
import { useMemo, useState } from 'react';
import type { ChatAction, ChatMessage } from '../lib/types';

marked.setOptions({ breaks: true });

type ChatSidebarProps = {
  messages: ChatMessage[];
  onAction: (action: ChatAction) => void;
  onSubmit: (content: string) => void;
};

export default function ChatSidebar({ messages, onAction, onSubmit }: ChatSidebarProps) {
  const [draft, setDraft] = useState('');
  const quickLinks = ['新建课件对话', '课件结构优化', '互动环节增强'];
  const recentThreads = ['【PPT】制作说课PPT', '说课通用结构模板', '【Agent】感知机互动课设计', '课堂活动节奏优化'];

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        html: marked.parse(message.content) as string,
      })),
    [messages],
  );

  return (
    <aside className="chat-sidebar">
      <header className="chat-sidebar-header">
        <div className="brand-lockup">
          <div className="brand-mark">L</div>
          <div>
            <p className="eyebrow">Lume Course</p>
            <h1>LumeSync Copilot</h1>
          </div>
        </div>
        <span className="status-badge">PPT 模式</span>
      </header>

      <section className="chat-sidebar-nav">
        {quickLinks.map((item, index) => (
          <button key={item} type="button" className={index === 0 ? 'nav-chip active' : 'nav-chip'}>
            {item}
          </button>
        ))}
      </section>

      <div className="chat-scroll-region custom-scrollbar" data-testid="chat-history">
        {renderedMessages.map((message) => (
          <article key={message.id} className={message.role === 'assistant' ? 'chat-bubble assistant' : 'chat-bubble user'}>
            <div className="chat-meta">
              <span>{message.role === 'assistant' ? 'AI' : 'You'}</span>
            </div>
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: message.html }} />
            {message.actions?.length ? (
              <div className="chat-actions">
                {message.actions.map((action) => (
                  <button key={`${message.id}-${action.id}-${action.targetSlideId ?? 'self'}`} type="button" onClick={() => onAction(action)}>
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <section className="recent-thread-panel">
        <p className="eyebrow">最近对话</p>
        <div className="recent-thread-list">
          {recentThreads.map((item, index) => (
            <button key={item} type="button" className={index === 0 ? 'recent-thread active' : 'recent-thread'}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="chat-composer-wrap">
        <div className="chat-composer">
          <button type="button" className="icon-button" aria-label="上传附件占位">
            ⌁
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="继续描述你想修改的页面结构、讲述节奏或视觉方向..."
            rows={4}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              const next = draft.trim();
              if (!next) return;
              onSubmit(next);
              setDraft('');
            }}
          >
            发送
          </button>
        </div>
      </div>
    </aside>
  );
}
