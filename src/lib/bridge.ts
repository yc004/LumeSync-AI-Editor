import JSZip from 'jszip';
import { mockManifest, mockSlides } from '../data/mockData';
import type {
  BootstrapPayload,
  BridgeApi,
  BridgeHandler,
  BridgeMessage,
  CourseAssetSource,
  CourseManifest,
  JsonValue,
  SlideSource,
} from './types';

interface WindowWithVsCode extends Window {
  acquireVsCodeApi?: () => { postMessage: (message: BridgeMessage) => void };
  __LumeSyncPickCourseFile?: () => Promise<File | null> | File | null;
}

const listeners = new Set<BridgeHandler>();

const emit = (message: BridgeMessage) => {
  listeners.forEach((listener) => listener(message));
};

const isTestEnvironment = (): boolean => /jsdom/i.test(window.navigator.userAgent);

const safeCourseName = (title: string): string => title.trim().replace(/[<>:"|?*\\/]+/g, '-').replace(/\s+/g, '-') || 'course';

const isPlainRecord = (value: unknown): value is Record<string, JsonValue> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const cleanEmptyStrings = <T extends Record<string, unknown>>(value: T): T => {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== '' && entryValue !== undefined);
  return Object.fromEntries(entries) as T;
};

const buildLumeManifest = (manifest: CourseManifest): CourseManifest => {
  const now = new Date().toISOString();
  const runtime = manifest.runtime ?? {};

  return cleanEmptyStrings({
    schemaVersion: manifest.schemaVersion || '1.0.0',
    id: manifest.id,
    title: manifest.title,
    version: manifest.version || '1.0.0',
    author: isPlainRecord(manifest.author) ? manifest.author : { name: 'LumeSync' },
    createdAt: manifest.createdAt || now,
    updatedAt: now,
    icon: manifest.icon ?? '',
    desc: manifest.desc ?? '',
    description: manifest.description ?? '',
    color: manifest.color ?? '',
    runtime: cleanEmptyStrings({
      ...runtime,
      format: typeof runtime.format === 'string' && runtime.format.trim() ? runtime.format.trim() : 'lumesync-zip',
      react: typeof runtime.react === 'string' && runtime.react.trim() ? runtime.react.trim() : '18',
      slideModule: typeof runtime.slideModule === 'string' && runtime.slideModule.trim() ? runtime.slideModule.trim() : 'tsx',
      entryMode: typeof runtime.entryMode === 'string' && runtime.entryMode.trim() ? runtime.entryMode.trim() : 'pages',
      preferredAspectRatio:
        typeof runtime.preferredAspectRatio === 'string' && runtime.preferredAspectRatio.trim()
          ? runtime.preferredAspectRatio.trim()
          : '16:9',
    }),
    pages: manifest.pages.map((page) =>
      cleanEmptyStrings({
        ...page,
        id: page.id,
        file: page.file,
        title: page.title,
      }),
    ),
    assets: manifest.assets ?? {},
    dependencies: manifest.dependencies ?? [],
    modelsUrls: manifest.modelsUrls,
  });
};

const createLumePackage = async (
  manifest: CourseManifest,
  slides: SlideSource[],
  assets: CourseAssetSource[] = [],
): Promise<Blob> => {
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
  assets.forEach((asset) => {
    const assetPath = asset.file.replace(/\\/g, '/');
    if (assetPath.startsWith('assets/')) {
      zip.file(assetPath, asset.data);
    }
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

const localSaveCourse = async (payload: { manifest: CourseManifest; slides: SlideSource[]; assets?: CourseAssetSource[] }) => {
  const blob = await createLumePackage(payload.manifest, payload.slides, payload.assets);
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

const promptCourseFile = (): Promise<File | null> => {
  const customPicker = (window as WindowWithVsCode).__LumeSyncPickCourseFile;
  if (customPicker) {
    return Promise.resolve(customPicker());
  }

  if (isTestEnvironment()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lume,application/zip';
    input.style.display = 'none';

    const cleanup = () => {
      input.removeEventListener('change', handleChange);
      input.remove();
    };

    const handleChange = () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };

    input.addEventListener('change', handleChange, { once: true });
    document.body.appendChild(input);
    input.click();
  });
};

const loadCourseFromFile = async (file: Blob): Promise<BootstrapPayload> => {
  const zip = await JSZip.loadAsync(file);
  const manifestText = await zip.file('manifest.json')?.async('string');
  if (!manifestText) {
    throw new Error('无法读取 manifest.json。');
  }

  const parsedManifest = JSON.parse(manifestText) as Partial<CourseManifest>;
  if (!parsedManifest.id || !parsedManifest.title || !Array.isArray(parsedManifest.pages)) {
    throw new Error('课件 manifest 结构不完整。');
  }

  const manifest: CourseManifest = {
    ...parsedManifest,
    schemaVersion: parsedManifest.schemaVersion ?? '',
    id: parsedManifest.id,
    title: parsedManifest.title,
    version: parsedManifest.version ?? '',
    author: parsedManifest.author ?? {},
    createdAt: parsedManifest.createdAt ?? '',
    updatedAt: parsedManifest.updatedAt ?? '',
    icon: parsedManifest.icon ?? '',
    desc: parsedManifest.desc ?? '',
    description: parsedManifest.description ?? '',
    color: parsedManifest.color ?? '',
    assets: parsedManifest.assets ?? {},
    dependencies: parsedManifest.dependencies ?? [],
    modelsUrls: parsedManifest.modelsUrls,
    runtime: {
      ...(parsedManifest.runtime ?? {}),
      format: parsedManifest.runtime?.format ?? '',
      entryMode: parsedManifest.runtime?.entryMode ?? '',
    },
    pages: parsedManifest.pages.map((page) => ({
      ...page,
      id: page.id ?? page.file ?? `page-${Math.random().toString(36).slice(2, 8)}`,
      title: page.title ?? page.id ?? 'Untitled page',
      file: page.file ?? '',
      exportName: page.exportName ?? '',
      transition: page.transition,
      scrollable: page.scrollable === true,
    })),
  };

  const slides = await Promise.all(
    manifest.pages.map(async (page) => {
      if (!page.file) {
        throw new Error(`页面 ${page.id} 缺少文件路径。`);
      }
      const source = await zip.file(page.file)?.async('string');
      if (typeof source !== 'string') {
        throw new Error(`无法读取页面源码：${page.file}`);
      }
      return {
        file: page.file,
        title: page.title,
        source,
      };
    }),
  );
  const assets = await Promise.all(
    Object.keys(zip.files || {})
      .filter((name) => name.replace(/\\/g, '/').startsWith('assets/') && !zip.files[name].dir)
      .map(async (name) => ({
        file: name.replace(/\\/g, '/'),
        data: await zip.files[name].async('arraybuffer'),
      })),
  );

  return {
    manifest,
    slides,
    assets,
    chat: [
      {
        id: `local-open-${Date.now()}`,
        role: 'assistant',
        content: `已载入本地课件“${manifest.title}”。`,
      },
    ],
  };
};

const openLocalCourse = async (): Promise<BootstrapPayload | null> => {
  const file = await promptCourseFile();
  if (!file) {
    return null;
  }

  emit({ type: 'sync-status', payload: { status: 'saving', detail: 'Loading local .lume course...' } });

  try {
    const payload = await loadCourseFromFile(file);
    emit({ type: 'sync-status', payload: { status: 'saved', detail: 'Loaded local course file.' } });
    return payload;
  } catch (error: unknown) {
    emit({
      type: 'sync-status',
      payload: { status: 'error', detail: error instanceof Error ? error.message : 'Open course failed.' },
    });
    return null;
  }
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
      listeners.add(handler);
      const listener = (event: MessageEvent<BridgeMessage>) => {
        if (event.data?.type) {
          handler(event.data);
        }
      };
      window.addEventListener('message', listener as EventListener);
      return () => {
        listeners.delete(handler);
        window.removeEventListener('message', listener as EventListener);
      };
    },
    requestInitialData: () => api.postMessage({ type: 'bootstrap', payload: { manifest: mockManifest, slides: mockSlides, chat: [] } }),
    createCourse: (payload) => api.postMessage({ type: 'create-course', payload }),
    openCourse: () => openLocalCourse(),
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
      const savePayload = payload as Partial<{ manifest: CourseManifest; slides: SlideSource[]; assets: CourseAssetSource[] }>;
      void Promise.resolve()
        .then(() => {
          if (!savePayload.manifest || !Array.isArray(savePayload.slides)) {
            throw new Error('Course manifest or slides are missing.');
          }
          return localSaveCourse({ manifest: savePayload.manifest, slides: savePayload.slides, assets: savePayload.assets });
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
        payload: { manifest: mockManifest, slides: mockSlides, chat: [] },
      });
    }, 16);
  },
  createCourse: () => {
    emit({ type: 'sync-status', payload: { status: 'idle', detail: 'New course template is ready.' } });
  },
  openCourse: async () => {
    if (isTestEnvironment()) {
      return { manifest: mockManifest, slides: mockSlides, chat: [] };
    }

    return openLocalCourse();
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
