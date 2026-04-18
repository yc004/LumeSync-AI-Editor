export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type CourseManifest = {
  schemaVersion?: string;
  id: string;
  title: string;
  version?: string;
  author?: {
    name?: string;
    [key: string]: JsonValue | undefined;
  };
  createdAt?: string;
  updatedAt?: string;
  icon?: string;
  desc?: string;
  description?: string;
  color?: string;
  assets?: Record<string, JsonValue>;
  dependencies?: Array<{
    name?: string;
    localSrc?: string;
    publicSrc?: string;
    [key: string]: JsonValue | undefined;
  }>;
  modelsUrls?: {
    local?: string;
    public?: string;
    [key: string]: JsonValue | undefined;
  };
  runtime?: {
    format?: string;
    entryMode?: 'pages' | 'legacy-course-data' | string;
    react?: string;
    slideModule?: string;
    preferredAspectRatio?: string;
    [key: string]: JsonValue | undefined;
  };
  pages: Array<{
    id: string;
    title: string;
    file: string;
    exportName?: string;
    transition?: JsonValue;
    scrollable?: boolean;
    [key: string]: JsonValue | undefined;
  }>;
};

export type SlideSource = {
  file: string;
  title: string;
  source: string;
};

export type CourseAssetSource = {
  file: string;
  data: ArrayBuffer;
};

export type ChatAction = {
  id: 'apply-slide' | 'rewrite-slide';
  label: string;
  targetSlideId?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
};

export type BootstrapPayload = {
  manifest: CourseManifest;
  slides: SlideSource[];
  assets?: CourseAssetSource[];
  chat: ChatMessage[];
};

export type AiSettings = {
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type CourseEditResult = {
  message: string;
  manifest: CourseManifest;
  slides: SlideSource[];
  currentSlideId?: string;
  tab?: 'code' | 'preview';
};

export type BridgeMessage =
  | { type: 'bootstrap'; payload: BootstrapPayload }
  | { type: 'create-course'; payload: { source: string } }
  | { type: 'open-course'; payload: Record<string, never> }
  | { type: 'save-course'; payload: { manifest: CourseManifest; slides: SlideSource[]; assets?: CourseAssetSource[] } }
  | { type: 'save-slide'; payload: { file: string; source: string } }
  | { type: 'apply-ai-result'; payload: { slideId: string; source: string } }
  | { type: 'request-preview'; payload: { file: string; source: string } }
  | { type: 'rewrite-slide'; payload: { slideId: string; prompt: string } }
  | { type: 'chat-submit'; payload: { content: string } }
  | { type: 'sync-status'; payload: { status: 'idle' | 'saving' | 'saved' | 'error'; detail?: string } };

export type BridgeHandler = (message: BridgeMessage) => void;

export type BridgeApi = {
  getBridge: () => BridgeApi;
  postMessage: (type: BridgeMessage['type'], payload: BridgeMessage['payload']) => void;
  onMessage: (handler: BridgeHandler) => () => void;
  requestInitialData: () => void;
  createCourse: (payload: { source: string }) => void;
  openCourse: () => Promise<BootstrapPayload | null>;
  saveCourse: (payload: { manifest: CourseManifest; slides: SlideSource[]; assets?: CourseAssetSource[] }) => void;
  saveSlideSource: (payload: { file: string; source: string }) => void;
  applyAiPatch: (payload: { target: string; content: string }) => void;
  rewriteSlide: (payload: { slideId: string; prompt: string }) => void;
};

export type SyncState = {
  status: 'idle' | 'saving' | 'saved' | 'error';
  detail: string;
};
