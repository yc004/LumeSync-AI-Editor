export type CourseManifest = {
  id: string;
  title: string;
  pages: Array<{
    id: string;
    title: string;
    file: string;
  }>;
};

export type SlideSource = {
  file: string;
  title: string;
  source: string;
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

export type BridgeMessage =
  | { type: 'bootstrap'; payload: { manifest: CourseManifest; slides: SlideSource[]; chat: ChatMessage[] } }
  | { type: 'create-course'; payload: { source: string } }
  | { type: 'open-course'; payload: Record<string, never> }
  | { type: 'save-course'; payload: { manifest: CourseManifest; slides: SlideSource[] } }
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
  openCourse: () => void;
  saveCourse: (payload: { manifest: CourseManifest; slides: SlideSource[] }) => void;
  saveSlideSource: (payload: { file: string; source: string }) => void;
  applyAiPatch: (payload: { target: string; content: string }) => void;
  rewriteSlide: (payload: { slideId: string; prompt: string }) => void;
};

export type SyncState = {
  status: 'idle' | 'saving' | 'saved' | 'error';
  detail: string;
};
