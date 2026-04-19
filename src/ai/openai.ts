import type { AiSettings, CourseEditResult, CourseManifest, SlideSource } from '../lib/types';
import { courseEditorSystemPrompt } from './prompts';

type CourseEditInput = {
  settings: AiSettings;
  prompt: string;
  manifest: CourseManifest;
  slides: SlideSource[];
  currentSlideId?: string;
  onDelta?: (delta: string, fullText: string) => void;
  onEvent?: (event: AiStreamEvent) => void;
};

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export type AiStreamEvent =
  | { type: 'status'; content: string }
  | { type: 'final'; edit: CourseEditResult };

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('请先填写 AI 接口地址。');
  }

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }

  return trimmed.endsWith('/v1') ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
};

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|tsx|ts|jsx|javascript|typescript)?\s*([\s\S]*?)```$/i);
  return match ? match[1].trim() : trimmed;
};

const parseJsonResponse = (value: string): unknown => {
  const stripped = stripCodeFence(value);
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('AI 没有返回可解析的 JSON 对象。');
    }
    return JSON.parse(match[0]);
  }
};

async function callChatCompletions(settings: AiSettings, messages: ChatMessage[]) {
  const endpoint = normalizeBaseUrl(settings.baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.25,
      messages,
    }),
  });

  const json = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(json?.error?.message || `AI 接口请求失败：${response.status}`);
  }

  return json;
}

type StreamingResponse = {
  text: string;
  finalJson?: unknown;
};

async function callStreamingChatCompletions(
  settings: AiSettings,
  messages: ChatMessage[],
  options: {
    onDelta?: (delta: string, fullText: string) => void;
    onJsonLine?: (value: unknown) => void;
  } = {},
): Promise<StreamingResponse> {
  const endpoint = normalizeBaseUrl(settings.baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.25,
      stream: true,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `AI streaming request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('AI streaming response is not readable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let jsonLineBuffer = '';
  let finalJson: unknown;

  const consumeJsonLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const value = JSON.parse(trimmed) as unknown;
      finalJson = value;
      options.onJsonLine?.(value);
    } catch {
      // The model may still be emitting a legacy single JSON object, so line parsing is best-effort.
    }
  };

  const consumeTextDelta = (delta: string) => {
    fullText += delta;
    options.onDelta?.(delta, fullText);

    jsonLineBuffer += delta;
    const jsonLines = jsonLineBuffer.split(/\r?\n/);
    jsonLineBuffer = jsonLines.pop() ?? '';
    jsonLines.forEach(consumeJsonLine);
  };

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      return;
    }

    const payload = trimmed.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') {
      return;
    }

    try {
      const chunk = JSON.parse(payload) as {
        choices?: Array<{
          delta?: { content?: string };
          message?: { content?: string };
          text?: string;
        }>;
      };
      const delta = chunk.choices?.map((choice) => choice.delta?.content ?? choice.message?.content ?? choice.text ?? '').join('') ?? '';
      if (!delta) {
        return;
      }

      consumeTextDelta(delta);
    } catch {
      // SSE streams may include provider-specific bookkeeping lines. The final text is still validated below.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(consumeLine);
  }

  buffer += decoder.decode();
  buffer.split(/\r?\n/).forEach(consumeLine);
  consumeJsonLine(jsonLineBuffer);

  return { text: fullText, finalJson };
}

export async function testAiConnection(settings: AiSettings): Promise<string> {
  if (!settings.model.trim() || !settings.baseUrl.trim() || !settings.apiKey.trim()) {
    throw new Error('请填写模型名称、接口地址和 API Key。');
  }

  const json = await callChatCompletions(settings, [
    {
      role: 'system',
      content: 'Reply with exactly: connection-ok',
    },
    {
      role: 'user',
      content: 'Test the configured model connection.',
    },
  ]);

  const content = json?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('AI 模型没有返回内容。');
  }

  return content;
}

const normalizeFilePath = (value: unknown): string => (typeof value === 'string' ? value.replace(/\\/g, '/').trim() : '');

const normalizeTitle = (value: unknown, fallback: string): string => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

const normalizeCourseEditResult = (raw: unknown, fallback: CourseEditInput): CourseEditResult => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI 返回的课件编辑结果不是有效对象。');
  }

  const candidate = raw as Partial<CourseEditResult>;
  if (!candidate.manifest || !Array.isArray(candidate.slides)) {
    throw new Error('AI 返回结果缺少 manifest 或 slides。');
  }

  const manifest = candidate.manifest;
  if (!manifest.id?.trim() || !manifest.title?.trim() || !Array.isArray(manifest.pages) || !manifest.pages.length) {
    throw new Error('AI 返回的 manifest 不完整。');
  }

  const slides = candidate.slides.map((slide, index) => {
    const file = normalizeFilePath(slide?.file);
    const source = typeof slide?.source === 'string' ? slide.source : '';
    if (!file || !source.trim()) {
      throw new Error(`AI 返回的第 ${index + 1} 个 slide 不完整。`);
    }

    return {
      file,
      title: normalizeTitle(slide.title, manifest.pages.find((page) => normalizeFilePath(page.file) === file)?.title || `Page ${index + 1}`),
      source,
    };
  });

  const slideFiles = new Set(slides.map((slide) => slide.file));
  const pages = manifest.pages.map((page, index) => {
    const file = normalizeFilePath(page.file);
    if (!file) {
      throw new Error(`AI 返回的第 ${index + 1} 页缺少 file。`);
    }

    if (!slideFiles.has(file)) {
      throw new Error(`AI 返回的页面 "${page.id || file}" 没有匹配的 slide source。`);
    }

    return {
      ...page,
      id: normalizeTitle(page.id, file.replace(/^slides\//, '').replace(/\.[^.]+$/, '') || `page-${index + 1}`),
      file,
      title: normalizeTitle(page.title, slides.find((slide) => slide.file === file)?.title || `Page ${index + 1}`),
    };
  });

  const pageIds = new Set(pages.map((page) => page.id));
  const currentSlideId =
    candidate.currentSlideId && pageIds.has(candidate.currentSlideId)
      ? candidate.currentSlideId
      : fallback.currentSlideId && pageIds.has(fallback.currentSlideId)
        ? fallback.currentSlideId
        : pages[0]?.id;

  return {
    message: normalizeTitle(candidate.message, '已根据你的要求更新课件。'),
    manifest: {
      ...manifest,
      runtime: {
        ...(manifest.runtime ?? {}),
        format: 'lumesync-zip',
        react: manifest.runtime?.react || '18',
        slideModule: 'tsx',
        entryMode: 'pages',
        preferredAspectRatio: manifest.runtime?.preferredAspectRatio || '16:9',
      },
      pages,
    },
    slides,
    currentSlideId,
    tab: candidate.tab === 'code' ? 'code' : 'preview',
  };
};

export async function editCourseWithAi(input: CourseEditInput): Promise<CourseEditResult> {
  const response = await callStreamingChatCompletions(input.settings, [
    {
      role: 'system',
      content: courseEditorSystemPrompt,
    },
    {
      role: 'user',
      content: [
        `User request: ${input.prompt}`,
        `Current selected page id: ${input.currentSlideId || ''}`,
        'Current manifest JSON:',
        JSON.stringify(input.manifest, null, 2),
        'Current slides JSON:',
        JSON.stringify(input.slides, null, 2),
      ].join('\n\n'),
    },
  ], { onDelta: input.onDelta });

  if (!response.finalJson && !response.text.trim()) {
    throw new Error('AI 返回了空的课件编辑结果。');
  }

  return normalizeCourseEditResult(response.finalJson ?? parseJsonResponse(response.text), input);
}
