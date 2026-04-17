import { mockChat, mockManifest, mockSlides } from '../data/mockData';
import type { BridgeApi, BridgeHandler, BridgeMessage } from './types';

interface WindowWithVsCode extends Window {
  acquireVsCodeApi?: () => { postMessage: (message: BridgeMessage) => void };
}

const listeners = new Set<BridgeHandler>();

const emit = (message: BridgeMessage) => {
  listeners.forEach((listener) => listener(message));
};

const vscodeBridge = (): BridgeApi | null => {
  const api = (window as WindowWithVsCode).acquireVsCodeApi?.();
  if (!api) {
    return null;
  }

  return {
    getBridge: () => bridge,
    postMessage: (type, payload) => api.postMessage({ type, payload } as BridgeMessage),
    onMessage: (handler) => {
      const listener = (event: MessageEvent<BridgeMessage>) => {
        if (event.data?.type) {
          handler(event.data);
        }
      };
      window.addEventListener('message', listener as EventListener);
      return () => window.removeEventListener('message', listener as EventListener);
    },
    requestInitialData: () => api.postMessage({ type: 'bootstrap', payload: { manifest: mockManifest, slides: mockSlides, chat: mockChat } }),
    saveSlideSource: (payload) => api.postMessage({ type: 'save-slide', payload }),
    applyAiPatch: (payload) => api.postMessage({ type: 'apply-ai-result', payload: { slideId: payload.target, source: payload.content } }),
    rewriteSlide: (payload) => api.postMessage({ type: 'rewrite-slide', payload }),
  };
};

const mockBridge: BridgeApi = {
  getBridge: () => bridge,
  postMessage: (type, payload) => {
    if (type === 'save-slide') {
      emit({ type: 'sync-status', payload: { status: 'saving', detail: '正在通过 mock bridge 写回 .lume 课件...' } });
      window.setTimeout(() => {
        emit({ type: 'sync-status', payload: { status: 'saved', detail: '当前页面已同步回课件包' } });
      }, 420);
    }

    if (type === 'apply-ai-result') {
      const detail =
        payload && typeof payload === 'object' && 'slideId' in payload
          ? `AI 改写已应用到 ${payload.slideId}`
          : 'AI 改写已应用到当前幻灯片';
      emit({ type: 'sync-status', payload: { status: 'saved', detail } });
    }

    if (type === 'rewrite-slide') {
      const detail =
        payload && typeof payload === 'object' && 'slideId' in payload
          ? `已发送“重写 ${payload.slideId}”请求，等待宿主生成结果`
          : '已发送重写请求，等待宿主生成结果';
      emit({ type: 'sync-status', payload: { status: 'idle', detail } });
    }

    if (type === 'chat-submit') {
      emit({ type: 'sync-status', payload: { status: 'idle', detail: '消息已发送到 AI 协作区（mock）' } });
    }
  },
  onMessage: (handler) => {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },
  requestInitialData: () => {
    window.setTimeout(() => {
      emit({
        type: 'bootstrap',
        payload: { manifest: mockManifest, slides: mockSlides, chat: mockChat },
      });
    }, 16);
  },
  saveSlideSource: (payload) => mockBridge.postMessage('save-slide', payload),
  applyAiPatch: (payload) => mockBridge.postMessage('apply-ai-result', { slideId: payload.target, source: payload.content }),
  rewriteSlide: (payload) => mockBridge.postMessage('rewrite-slide', payload),
};

const bridge = vscodeBridge() ?? mockBridge;

export function getBridge(): BridgeApi {
  return bridge;
}
