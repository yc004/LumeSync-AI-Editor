import type { CourseManifest } from './types';

export const getCourseRenderScale = (manifest: CourseManifest | undefined) => {
  const value = manifest?.runtime?.['renderScale'];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 1;
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 0.6), 1.2);
};
