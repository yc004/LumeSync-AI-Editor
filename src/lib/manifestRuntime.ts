import type { CourseManifest } from './types';

export const normalizeRuntimeForCore = (manifest: CourseManifest): CourseManifest => ({
  ...manifest,
  runtime: {
    ...(manifest.runtime ?? {}),
    format: 'lumesync-zip',
    entryMode: manifest.runtime?.entryMode?.trim() || 'pages',
    react: manifest.runtime?.react?.trim() || '18',
    slideModule: manifest.runtime?.slideModule?.trim() || 'tsx',
    preferredAspectRatio: manifest.runtime?.preferredAspectRatio?.trim() || '16:9',
  },
});
