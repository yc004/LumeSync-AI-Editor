import { useEffect, useState } from 'react';
import { normalizeRuntimeForCore } from '../lib/manifestRuntime';
import type { CourseManifest, JsonValue } from '../lib/types';

type CourseConfigPanelProps = {
  manifest: CourseManifest;
  onSave: (manifest: CourseManifest) => void;
  compact?: boolean;
};

type AssetDraft = {
  path: string;
  type: string;
  size: string;
  usage: string;
};

type DependencyDraft = {
  name: string;
  localSrc: string;
  publicSrc: string;
};

type PageDraft = CourseManifest['pages'][number] & {
  scrollable?: boolean;
};

type ConfigDraft = {
  schemaVersion: string;
  id: string;
  title: string;
  version: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  icon: string;
  desc: string;
  description: string;
  color: string;
  assets: AssetDraft[];
  dependencies: DependencyDraft[];
  modelsUrls: {
    local: string;
    public: string;
  };
  runtime: {
    format: string;
    react: string;
    slideModule: string;
    entryMode: string;
    preferredAspectRatio: string;
    renderScale: string;
  };
  pages: PageDraft[];
};

type ConfigTab = 'basic' | 'runtime' | 'assets' | 'dependencies' | 'pages';

const configTabs: Array<{ id: ConfigTab; label: string }> = [
  { id: 'basic', label: '基础' },
  { id: 'runtime', label: '运行时' },
  { id: 'assets', label: '资源' },
  { id: 'dependencies', label: '依赖' },
  { id: 'pages', label: '页面' },
];

const isRecord = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const assetToDraft = ([path, value]: [string, JsonValue]): AssetDraft => {
  if (!isRecord(value)) {
    return { path, type: '', size: '', usage: '' };
  }

  const usage = Array.isArray(value.usage) ? value.usage.filter((item): item is string => typeof item === 'string').join(', ') : '';

  return {
    path,
    type: typeof value.type === 'string' ? value.type : '',
    size: typeof value.size === 'number' ? String(value.size) : '',
    usage,
  };
};

const getRuntimeNumber = (runtime: CourseManifest['runtime'] | undefined, key: string, fallback: string) => {
  const value = runtime?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : fallback;
};

const createDraft = (manifest: CourseManifest): ConfigDraft => ({
  schemaVersion: manifest.schemaVersion ?? '',
  id: manifest.id,
  title: manifest.title,
  version: manifest.version ?? '',
  authorName: typeof manifest.author?.name === 'string' ? manifest.author.name : '',
  createdAt: manifest.createdAt ?? '',
  updatedAt: manifest.updatedAt ?? '',
  icon: manifest.icon ?? '',
  desc: manifest.desc ?? '',
  description: manifest.description ?? '',
  color: manifest.color ?? '',
  assets: Object.entries(manifest.assets ?? {}).map(assetToDraft),
  dependencies: (manifest.dependencies ?? []).map((dependency) => ({
    name: dependency.name ?? '',
    localSrc: dependency.localSrc ?? '',
    publicSrc: dependency.publicSrc ?? '',
  })),
  modelsUrls: {
    local: manifest.modelsUrls?.local ?? '',
    public: manifest.modelsUrls?.public ?? '',
  },
  runtime: {
    format: manifest.runtime?.format || 'lumesync-zip',
    react: manifest.runtime?.react || '18',
    slideModule: manifest.runtime?.slideModule || 'tsx',
    entryMode: manifest.runtime?.entryMode || 'pages',
    preferredAspectRatio: manifest.runtime?.preferredAspectRatio || '16:9',
    renderScale: getRuntimeNumber(manifest.runtime, 'renderScale', '1'),
  },
  pages: manifest.pages.map((page) => ({ ...page })),
});

const buildAssets = (assets: AssetDraft[]): CourseManifest['assets'] =>
  Object.fromEntries(
    assets
      .map((asset) => {
        const path = asset.path.trim();
        const usage = asset.usage
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const size = Number(asset.size);
        const value: Record<string, JsonValue> = {};

        if (asset.type.trim()) value.type = asset.type.trim();
        if (asset.size.trim() && Number.isFinite(size)) value.size = size;
        if (usage.length) value.usage = usage;

        return [path, value] as const;
      })
      .filter(([path]) => path.length > 0),
  );

const buildDependencies = (dependencies: DependencyDraft[]): CourseManifest['dependencies'] =>
  dependencies
    .map((dependency) => ({
      name: dependency.name.trim(),
      localSrc: dependency.localSrc.trim(),
      publicSrc: dependency.publicSrc.trim(),
    }))
    .filter((dependency) => dependency.localSrc || dependency.publicSrc || dependency.name);

const clampRenderScale = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 0.6), 1.2);
};

const validateDraft = (draft: ConfigDraft): CourseManifest => {
  const id = draft.id.trim();
  const title = draft.title.trim();

  if (!id) throw new Error('课件 ID 不能为空。');
  if (!title) throw new Error('课件名称不能为空。');

  return normalizeRuntimeForCore({
    schemaVersion: draft.schemaVersion.trim(),
    id,
    title,
    version: draft.version.trim(),
    author: { name: draft.authorName.trim() },
    createdAt: draft.createdAt.trim(),
    updatedAt: draft.updatedAt.trim(),
    icon: draft.icon.trim(),
    desc: draft.desc.trim(),
    description: draft.description.trim(),
    color: draft.color.trim(),
    runtime: {
      format: draft.runtime.format.trim() || 'lumesync-zip',
      react: draft.runtime.react.trim() || '18',
      slideModule: draft.runtime.slideModule.trim() || 'tsx',
      entryMode: draft.runtime.entryMode.trim() || 'pages',
      preferredAspectRatio: draft.runtime.preferredAspectRatio.trim() || '16:9',
      renderScale: clampRenderScale(draft.runtime.renderScale),
    },
    dependencies: buildDependencies(draft.dependencies),
    modelsUrls: {
      local: draft.modelsUrls.local.trim(),
      public: draft.modelsUrls.public.trim(),
    },
    pages: draft.pages.map((page) => ({ ...page, id: page.id.trim(), title: page.title.trim(), file: page.file.trim() })),
    assets: buildAssets(draft.assets),
  });
};

export default function CourseConfigPanel({ manifest, onSave, compact = false }: CourseConfigPanelProps) {
  const [draft, setDraft] = useState<ConfigDraft>(() => createDraft(manifest));
  const [activeTab, setActiveTab] = useState<ConfigTab>('basic');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(createDraft(manifest));
    setError('');
  }, [manifest]);

  const updateAsset = (index: number, patch: Partial<AssetDraft>) => {
    setDraft((previous) => ({
      ...previous,
      assets: previous.assets.map((asset, assetIndex) => (assetIndex === index ? { ...asset, ...patch } : asset)),
    }));
    setError('');
  };

  const updateDependency = (index: number, patch: Partial<DependencyDraft>) => {
    setDraft((previous) => ({
      ...previous,
      dependencies: previous.dependencies.map((dependency, dependencyIndex) =>
        dependencyIndex === index ? { ...dependency, ...patch } : dependency,
      ),
    }));
    setError('');
  };

  const updatePage = (index: number, patch: Partial<PageDraft>) => {
    setDraft((previous) => ({
      ...previous,
      pages: previous.pages.map((page, pageIndex) => (pageIndex === index ? { ...page, ...patch } : page)),
    }));
    setError('');
  };

  const createUniquePageValue = (existingValues: Set<string>, baseValue: string) => {
    let index = 1;
    let candidate = baseValue;
    while (existingValues.has(candidate)) {
      index += 1;
      candidate = `${baseValue}-${index}`;
    }
    return candidate;
  };

  const createUniquePageFile = (existingFiles: Set<string>, pageNumber: number) => {
    let suffix = 0;
    let candidate = `slides/Page${pageNumber}.tsx`;
    while (existingFiles.has(candidate)) {
      suffix += 1;
      candidate = `slides/Page${pageNumber}_${suffix}.tsx`;
    }
    return candidate;
  };

  const addPage = () => {
    setDraft((previous) => {
      const nextNumber = previous.pages.length + 1;
      const pageId = createUniquePageValue(new Set(previous.pages.map((page) => page.id)), `page-${nextNumber}`);
      const file = createUniquePageFile(new Set(previous.pages.map((page) => page.file)), nextNumber);
      return {
        ...previous,
        pages: [...previous.pages, { id: pageId, title: `新页面 ${nextNumber}`, file }],
      };
    });
    setError('');
  };

  const removePage = (index: number) => {
    setDraft((previous) => {
      if (previous.pages.length <= 1) {
        setError('课件至少需要保留 1 个页面。');
        return previous;
      }
      setError('');
      return {
        ...previous,
        pages: previous.pages.filter((_, pageIndex) => pageIndex !== index),
      };
    });
  };

  const commitDraft = (nextDraft: ConfigDraft) => {
    try {
      onSave(validateDraft(nextDraft));
      setError('');
    } catch (validationError: unknown) {
      setError(validationError instanceof Error ? validationError.message : '配置校验失败。');
    }
  };

  const saveDraft = () => {
    commitDraft(draft);
  };

  const updateRenderScale = (value: string) => {
    setDraft((previous) => {
      const nextDraft = { ...previous, runtime: { ...previous.runtime, renderScale: value } };
      commitDraft(nextDraft);
      return nextDraft;
    });
  };

  return (
    <div className={compact ? 'course-config-panel-body compact' : 'course-config-panel-body'}>
      <div className="course-config-subtabs" role="tablist" aria-label="课件基础配置分类">
        {configTabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="course-config-body custom-scrollbar">
        {activeTab === 'basic' ? (
          <div className="course-config-section course-config-section-primary">
            <div className="course-config-section-head">
              <span>课程信息</span>
              <small>manifest</small>
            </div>
            <div className="course-config-grid">
              <label className="settings-field">
                <span>schemaVersion</span>
                <input value={draft.schemaVersion} placeholder="1.0.0" onChange={(event) => setDraft((previous) => ({ ...previous, schemaVersion: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>version</span>
                <input value={draft.version} placeholder="1.0.0" onChange={(event) => setDraft((previous) => ({ ...previous, version: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>课件 ID</span>
                <input value={draft.id} data-testid="course-config-id" onChange={(event) => setDraft((previous) => ({ ...previous, id: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>课件名称</span>
                <input value={draft.title} data-testid="course-config-title-input" onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>作者</span>
                <input value={draft.authorName} placeholder="LumeSync" onChange={(event) => setDraft((previous) => ({ ...previous, authorName: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>图标 icon</span>
                <input value={draft.icon} onChange={(event) => setDraft((previous) => ({ ...previous, icon: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>createdAt</span>
                <input value={draft.createdAt} onChange={(event) => setDraft((previous) => ({ ...previous, createdAt: event.target.value }))} />
              </label>
              <label className="settings-field">
                <span>updatedAt</span>
                <input value={draft.updatedAt} onChange={(event) => setDraft((previous) => ({ ...previous, updatedAt: event.target.value }))} />
              </label>
              <label className="settings-field course-config-wide-field">
                <span>主题色 color</span>
                <input value={draft.color} placeholder="from-blue-500 to-indigo-600" onChange={(event) => setDraft((previous) => ({ ...previous, color: event.target.value }))} />
              </label>
              <label className="settings-field course-config-wide-field">
                <span>简介 desc</span>
                <textarea value={draft.desc} onChange={(event) => setDraft((previous) => ({ ...previous, desc: event.target.value }))} />
              </label>
              <label className="settings-field course-config-wide-field">
                <span>兼容简介 description</span>
                <textarea value={draft.description} onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))} />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === 'runtime' ? (
          <div className="course-config-section">
            <div className="course-config-section-head">
              <span>运行时配置</span>
              <small>runtime</small>
            </div>
            <div className="course-config-grid">
              <label className="settings-field">
                <span>runtime.format</span>
                <input value={draft.runtime.format} placeholder="lumesync-zip" onChange={(event) => setDraft((previous) => ({ ...previous, runtime: { ...previous.runtime, format: event.target.value } }))} />
              </label>
              <label className="settings-field">
                <span>runtime.react</span>
                <input value={draft.runtime.react} placeholder="18" onChange={(event) => setDraft((previous) => ({ ...previous, runtime: { ...previous.runtime, react: event.target.value } }))} />
              </label>
              <label className="settings-field">
                <span>runtime.slideModule</span>
                <input value={draft.runtime.slideModule} placeholder="tsx" onChange={(event) => setDraft((previous) => ({ ...previous, runtime: { ...previous.runtime, slideModule: event.target.value } }))} />
              </label>
              <label className="settings-field">
                <span>runtime.entryMode</span>
                <input value={draft.runtime.entryMode} placeholder="pages" onChange={(event) => setDraft((previous) => ({ ...previous, runtime: { ...previous.runtime, entryMode: event.target.value } }))} />
              </label>
              <label className="settings-field">
                <span>课件内容缩放</span>
                <input
                  type="number"
                  min="0.6"
                  max="1.2"
                  step="0.01"
                  value={draft.runtime.renderScale}
                  onChange={(event) => updateRenderScale(event.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>runtime.preferredAspectRatio</span>
                <input value={draft.runtime.preferredAspectRatio} placeholder="16:9" onChange={(event) => setDraft((previous) => ({ ...previous, runtime: { ...previous.runtime, preferredAspectRatio: event.target.value } }))} />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === 'assets' ? (
          <div className="course-config-section">
            <div className="course-config-section-head">
              <span>静态资源</span>
              <button type="button" className="course-config-inline-button" onClick={() => setDraft((previous) => ({ ...previous, assets: [...previous.assets, { path: '', type: '', size: '', usage: '' }] }))}>
                添加资源
              </button>
            </div>
            {draft.assets.length ? (
              <div className="course-config-assets">
                {draft.assets.map((asset, index) => (
                  <div className="course-config-asset-row" key={`${asset.path}-${index}`}>
                    <label className="settings-field"><span>资源路径</span><input value={asset.path} placeholder="assets/example.png" onChange={(event) => updateAsset(index, { path: event.target.value })} /></label>
                    <label className="settings-field"><span>MIME 类型</span><input value={asset.type} placeholder="image/png" onChange={(event) => updateAsset(index, { type: event.target.value })} /></label>
                    <label className="settings-field"><span>文件大小</span><input value={asset.size} placeholder="0" onChange={(event) => updateAsset(index, { size: event.target.value })} /></label>
                    <label className="settings-field"><span>使用页面</span><input value={asset.usage} placeholder="cover, page-1" onChange={(event) => updateAsset(index, { usage: event.target.value })} /></label>
                    <button type="button" className="course-config-remove-button" onClick={() => setDraft((previous) => ({ ...previous, assets: previous.assets.filter((_, assetIndex) => assetIndex !== index) }))}>移除</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="course-config-empty">当前没有显式配置资源；Core 仍会自动读取包内 assets/ 目录。</p>
            )}
          </div>
        ) : null}

        {activeTab === 'dependencies' ? (
          <>
            <div className="course-config-section">
              <div className="course-config-section-head">
                <span>外部脚本</span>
                <button type="button" className="course-config-inline-button" onClick={() => setDraft((previous) => ({ ...previous, dependencies: [...previous.dependencies, { name: '', localSrc: '', publicSrc: '' }] }))}>
                  添加依赖
                </button>
              </div>
              {draft.dependencies.length ? (
                <div className="course-config-dependencies">
                  {draft.dependencies.map((dependency, index) => (
                    <div className="course-config-dependency-row" key={`${dependency.localSrc}-${index}`}>
                      <label className="settings-field"><span>依赖名称</span><input value={dependency.name} placeholder="chartjs" onChange={(event) => updateDependency(index, { name: event.target.value })} /></label>
                      <label className="settings-field"><span>localSrc</span><input value={dependency.localSrc} placeholder="/lib/chart.umd.min.js" onChange={(event) => updateDependency(index, { localSrc: event.target.value })} /></label>
                      <label className="settings-field"><span>publicSrc</span><input value={dependency.publicSrc} placeholder="https://fastly.jsdelivr.net/..." onChange={(event) => updateDependency(index, { publicSrc: event.target.value })} /></label>
                      <button type="button" className="course-config-remove-button" onClick={() => setDraft((previous) => ({ ...previous, dependencies: previous.dependencies.filter((_, dependencyIndex) => dependencyIndex !== index) }))}>移除</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="course-config-empty">当前没有外部脚本依赖；需要 CDN fallback 时再添加。</p>
              )}
            </div>
            <div className="course-config-section">
              <div className="course-config-section-head"><span>模型资源</span><small>modelsUrls</small></div>
              <div className="course-config-grid">
                <label className="settings-field"><span>modelsUrls.local</span><input value={draft.modelsUrls.local} placeholder="/weights" onChange={(event) => setDraft((previous) => ({ ...previous, modelsUrls: { ...previous.modelsUrls, local: event.target.value } }))} /></label>
                <label className="settings-field"><span>modelsUrls.public</span><input value={draft.modelsUrls.public} placeholder="https://fastly.jsdelivr.net/gh/..." onChange={(event) => setDraft((previous) => ({ ...previous, modelsUrls: { ...previous.modelsUrls, public: event.target.value } }))} /></label>
              </div>
            </div>
          </>
        ) : null}

        {activeTab === 'pages' ? (
          <div className="course-config-section">
            <div className="course-config-section-head"><span>页面结构</span><button type="button" className="course-config-inline-button" onClick={addPage}>添加页面</button></div>
            <div className="course-config-pages custom-scrollbar">
              {draft.pages.map((page, index) => (
                <div className="course-config-page-card" key={`${page.id}-${index}`}>
                  <span className="course-config-page-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="course-config-page-fields">
                    <label className="settings-field"><span>页面 ID</span><input value={page.id} onChange={(event) => updatePage(index, { id: event.target.value })} /></label>
                    <label className="settings-field"><span>页面标题</span><input value={page.title} onChange={(event) => updatePage(index, { title: event.target.value })} /></label>
                    <label className="settings-field course-config-file-field"><span>源文件</span><input value={page.file} onChange={(event) => updatePage(index, { file: event.target.value })} /></label>
                    <label className="settings-field"><span>exportName</span><input value={page.exportName ?? ''} onChange={(event) => updatePage(index, { exportName: event.target.value })} /></label>
                    <label className="course-config-checkbox"><input type="checkbox" checked={!!page.scrollable} onChange={(event) => updatePage(index, { scrollable: event.target.checked })} />允许页面滚动</label>
                    <button type="button" className="course-config-remove-button" onClick={() => removePage(index)}>删除页面</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="course-config-error" role="alert">{error}</div> : null}

      <div className="course-config-panel-actions">
        <button type="button" className="secondary-button" onClick={() => setDraft(createDraft(manifest))}>重置</button>
        <button type="button" className="primary-button" data-testid="save-course-config" onClick={saveDraft}>保存配置</button>
      </div>
    </div>
  );
}




