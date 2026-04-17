import { mockChat, mockManifest, mockSlides } from '../data/mockData';
import JSZip from 'jszip';
import type { BridgeApi, BridgeHandler, BridgeMessage, CourseManifest, SlideSource } from './types';

interface WindowWithVsCode extends Window {
  acquireVsCodeApi?: () => { postMessage: (message: BridgeMessage) => void };
}

const listeners = new Set<BridgeHandler>();

const emit = (message: BridgeMessage) => {
  listeners.forEach((listener) => listener(message));
};

const safeCourseName = (title: string): string => title.trim().replace(/[<>:"|?*\\/]+/g, '-').replace(/\s+/g, '-') || 'course';

const buildLumeManifest = (manifest: CourseManifest) => ({
  ...manifest,
  runtime: {
    format: 'lumesync-zip',
    entryMode: 'pages',
  },
});

const createLumePackage = async (manifest: CourseManifest, slides: SlideSource[]): Promise<Blob> => {
  const zip = new JSZip();
  const slideMap = new Map(slides.map((slide) => [slide.file.replace(/\\/g, '/'), slide.source]));

  zip.file('manifest.json', `${JSON.stringify(buildLumeManifest(manifest), null, 2)}\n`);
  manifest.pages.forEach((page) => {
    const slidePath = page.file.replace(/\\/g, '/');
    const source = slideMap.get(slidePath);
    if (!source?.trim()) {
      throw new Error(`Slide source not found: ${page.file}`);
    }
    zip.file(slidePath, source.endsWith('\n') ? source : `${source}\n`);
  });
  zip.folder('assets');

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

const localSaveCourse = async (payload: { manifest: CourseManifest; slides: SlideSource[] }) => {
  const blob = await createLumePackage(payload.manifest, payload.slides);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeCourseName(payload.manifest.title || payload.manifest.id)}.lume`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
    createCourse: (payload) => api.postMessage({ type: 'create-course', payload }),
    openCourse: () => api.postMessage({ type: 'open-course', payload: {} }),
    saveCourse: (payload) => api.postMessage({ type: 'save-course', payload }),
    saveSlideSource: (payload) => api.postMessage({ type: 'save-slide', payload }),
    applyAiPatch: (payload) => api.postMessage({ type: 'apply-ai-result', payload: { slideId: payload.target, source: payload.content } }),
    rewriteSlide: (payload) => api.postMessage({ type: 'rewrite-slide', payload }),
  };
};

const mockBridge: BridgeApi = {
  getBridge: () => bridge,
  postMessage: (type, payload) => {
    if (type === 'save-course') {
      emit({ type: 'sync-status', payload: { status: 'saving', detail: 'Saving course file...' } });
      const savePayload = payload as Partial<{ manifest: CourseManifest; slides: SlideSource[] }>;
      void Promise.resolve()
        .then(() => {
          if (!savePayload.manifest || !Array.isArray(savePayload.slides)) {
            throw new Error('Course manifest or slides are missing.');
          }
          return localSaveCourse({ manifest: savePayload.manifest, slides: savePayload.slides });
        })
        .then(() => {
          emit({ type: 'sync-status', payload: { status: 'saved', detail: 'Saved as a Core-compatible .lume package.' } });
        })
        .catch((error: unknown) => {
          emit({
            type: 'sync-status',
            payload: { status: 'error', detail: error instanceof Error ? error.message : 'Save failed.' },
          });
        });
    }

    if (type === 'apply-ai-result') {
      const detail =
        payload && typeof payload === 'object' && 'slideId' in payload
          ? `AI patch applied to ${payload.slideId}`
          : 'AI patch applied.';
      emit({ type: 'sync-status', payload: { status: 'saved', detail } });
    }

    if (type === 'rewrite-slide') {
      const detail =
        payload && typeof payload === 'object' && 'slideId' in payload
          ? `Rewrite request queued for ${payload.slideId}.`
          : 'Rewrite request queued.';
      emit({ type: 'sync-status', payload: { status: 'idle', detail } });
    }

    if (type === 'chat-submit') {
      emit({ type: 'sync-status', payload: { status: 'idle', detail: 'Message sent to the AI workspace.' } });
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
  createCourse: (payload) => {
    emit({ type: 'sync-status', payload: { status: 'idle', detail: 'New course template is ready.' } });
    mockBridge.postMessage('create-course', payload);
  },
  openCourse: () => {
    window.setTimeout(() => {
      emit({
        type: 'bootstrap',
        payload: { manifest: mockManifest, slides: mockSlides, chat: mockChat },
      });
    }, 16);
  },
  saveCourse: (payload) => mockBridge.postMessage('save-course', payload),
  saveSlideSource: (payload) => mockBridge.postMessage('save-slide', payload),
  applyAiPatch: (payload) => mockBridge.postMessage('apply-ai-result', { slideId: payload.target, source: payload.content }),
  rewriteSlide: (payload) => mockBridge.postMessage('rewrite-slide', payload),
};

const bridge = vscodeBridge() ?? mockBridge;

export function getBridge(): BridgeApi {
  return bridge;
}
