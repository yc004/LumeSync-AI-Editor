import type { CourseAssetSource, SlideSource } from './types';

export function createAssetUrlMap(assets: CourseAssetSource[] = []) {
  const objectUrls: string[] = [];
  const urls = new Map<string, string>();

  assets.forEach((asset) => {
    const normalizedPath = asset.file.replace(/\\/g, '/');
    if (!normalizedPath.startsWith('assets/')) {
      return;
    }

    const url = URL.createObjectURL(new Blob([asset.data]));
    objectUrls.push(url);
    urls.set(normalizedPath, url);
    urls.set(`/${normalizedPath}`, url);
  });

  return {
    urls,
    revoke: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)),
  };
}

export function rewriteSlideAssetReferences(slide: SlideSource, assetUrls: Map<string, string>): SlideSource {
  if (!assetUrls.size) {
    return slide;
  }

  const source = slide.source.replace(
    /\b(src|href|poster)=["'](\/?assets\/[^"']+)["']/g,
    (match, attribute: string, assetPath: string) => {
      const normalizedPath = assetPath.replace(/^\/+/, '');
      const url = assetUrls.get(assetPath) ?? assetUrls.get(normalizedPath);
      return url ? `${attribute}="${url}"` : match;
    },
  );

  return source === slide.source ? slide : { ...slide, source };
}
