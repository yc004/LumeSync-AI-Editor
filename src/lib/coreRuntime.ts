import BabelDefault from '@babel/standalone';
import * as BabelNamespace from '@babel/standalone';
import { coreRuntimeSources } from '@lumesync/core/browser-runtime';
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { createPortal } from 'react-dom';

import type { CourseManifest, SlideSource } from './types';

type CoreCourseData = {
  id: string;
  title: string;
  icon?: string;
  desc?: string;
  color?: string;
  slides: Array<{
    id: string;
    title?: string;
    component: React.ReactNode;
  }>;
};

type CoreRuntimeApi = {
  buildCourseDataFromMemory: (options: {
    manifest: CourseManifest;
    slides: SlideSource[];
    course?: { id?: string; title?: string; desc?: string; icon?: string; color?: string };
  }) => Promise<CoreCourseData>;
  renderCourseExportDocument: (
    rootElement: HTMLElement,
    props: {
      course?: { id?: string; title?: string; desc?: string; icon?: string; color?: string };
      courseData: CoreCourseData;
      contentScale?: number;
    },
  ) => { unmount?: () => void };
};

type BabelRuntime = typeof BabelDefault;

const resolveBabelRuntime = (): BabelRuntime => {
  const candidate = (BabelDefault || BabelNamespace) as BabelRuntime | undefined;
  const namespaceDefault = (BabelNamespace as unknown as { default?: BabelRuntime }).default;
  const runtime = candidate?.transform ? candidate : namespaceDefault;

  if (!runtime?.transform) {
    throw new Error('Babel runtime is not available. Unable to compile Core preview TSX runtime.');
  }

  return runtime;
};

const Babel = resolveBabelRuntime();

declare global {
  interface Window {
    LumeSyncRenderEngine?: Partial<CoreRuntimeApi>;
  }
}

type CoreWindow = Window &
  typeof globalThis & {
    Babel?: typeof Babel;
    React?: typeof React;
    ReactDOM?: typeof runtimeReactDOM;
    LumeSyncRenderEngine?: Partial<CoreRuntimeApi>;
    __LumeSyncPreviewRuntimeReady?: boolean;
  };

const runtimeReactDOM = {
  ...ReactDOMClient,
  createPortal,
};

const runtimePromises = new WeakMap<CoreWindow, Promise<CoreRuntimeApi>>();

const compileRuntimeSource = (fileName: string, source: string) => {
  const compiled = Babel.transform(source, {
    presets: ['react', 'typescript'],
    filename: fileName,
    sourceType: 'script',
  }).code;

  if (!compiled) {
    throw new Error(`Failed to compile core runtime source: ${fileName}`);
  }

  return [`// <lumesync-core-runtime:${fileName}>`, '{', compiled, '}', `// </lumesync-core-runtime:${fileName}>`].join('\n');
};

const executeRuntimeBundle = (runtimeWindow: CoreWindow) => {
  const evaluator = runtimeWindow.eval;
  if (typeof evaluator !== 'function') {
    throw new Error('Current preview environment does not support runtime script evaluation.');
  }

  const compiledBundle = coreRuntimeSources
    .map(({ fileName, source }) => compileRuntimeSource(fileName, source))
    .join('\n\n');

  evaluator.call(runtimeWindow, `${compiledBundle}\n//# sourceURL=lumesync-core-runtime/sdk-bundle.js`);
};

export async function ensureCoreRuntime(targetWindow: Window = window): Promise<CoreRuntimeApi> {
  const runtimeWindow = targetWindow as CoreWindow;
  const existingPromise = runtimePromises.get(runtimeWindow);
  if (existingPromise) {
    return existingPromise;
  }

  const runtimePromise = Promise.resolve().then(() => {
    const runtimeGlobals = runtimeWindow as unknown as {
      Babel?: typeof Babel;
      React?: typeof React;
      ReactDOM?: typeof runtimeReactDOM;
    };

    if (!runtimeGlobals.Babel) {
      runtimeGlobals.Babel = Babel;
    }
    if (!runtimeGlobals.React) {
      runtimeGlobals.React = React;
    }
    if (!runtimeGlobals.ReactDOM) {
      runtimeGlobals.ReactDOM = runtimeReactDOM;
    }

    if (!runtimeWindow.__LumeSyncPreviewRuntimeReady) {
      executeRuntimeBundle(runtimeWindow);
      runtimeWindow.__LumeSyncPreviewRuntimeReady = true;
    }

    const api = runtimeWindow.LumeSyncRenderEngine;
    if (!api?.buildCourseDataFromMemory || !api.renderCourseExportDocument) {
      throw new Error('LumeSync core runtime did not expose the expected preview APIs.');
    }

    return api as CoreRuntimeApi;
  });

  runtimePromises.set(runtimeWindow, runtimePromise);
  return runtimePromise;
}
