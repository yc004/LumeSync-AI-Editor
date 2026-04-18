import { useEffect, useState } from 'react';
import type { CourseManifest, JsonValue } from '../lib/types';

type CourseConfigDialogProps = {
  manifest: CourseManifest;
  open: boolean;
  onClose: () => void;
  onSave: (manifest: CourseManifest) => void;
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
  };
  pages: CourseManifest['pages'];
};

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
    format: manifest.runtime?.format ?? '',
    react: manifest.runtime?.react ?? '',
    slideModule: manifest.runtime?.slideModule ?? '',
    entryMode: manifest.runtime?.entryMode ?? '',
    preferredAspectRatio: manifest.runtime?.preferredAspectRatio ?? '',
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

        if (asset.type.trim()) {
          value.type = asset.type.trim();
        }
        if (asset.size.trim() && Number.isFinite(size)) {
          value.size = size;
        }
        if (usage.length) {
          value.usage = usage;
        }

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

const validateDraft = (draft: ConfigDraft): CourseManifest => {
  const id = draft.id.trim();
  const title = draft.title.trim();

  if (!id) {
    throw new Error('课件 ID 不能为空。');
  }

  if (!title) {
    throw new Error('课件名称不能为空。');
  }

  return {
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
      format: draft.runtime.format.trim(),
      react: draft.runtime.react.trim(),
      slideModule: draft.runtime.slideModule.trim(),
      entryMode: draft.runtime.entryMode.trim(),
      preferredAspectRatio: draft.runtime.preferredAspectRatio.trim(),
    },
    dependencies: buildDependencies(draft.dependencies),
    modelsUrls: {
      local: draft.modelsUrls.local.trim(),
      public: draft.modelsUrls.public.trim(),
    },
    pages: draft.pages,
    assets: buildAssets(draft.assets),
  };
};

export default function CourseConfigDialog({ manifest, open, onClose, onSave }: CourseConfigDialogProps) {
  const [draft, setDraft] = useState<ConfigDraft>(() => createDraft(manifest));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(createDraft(manifest));
      setError('');
    }
  }, [manifest, open]);

  if (!open) {
    return null;
  }

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

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="course-config-title">
      <div className="settings-panel course-config-panel">
        <div className="settings-header">
          <div>
            <p className="eyebrow">Course Manifest</p>
            <h2 id="course-config-title">查看和编辑课件配置</h2>
          </div>
          <button type="button" className="icon-button" aria-label="关闭配置面板" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="course-config-body custom-scrollbar">
          <div className="course-config-section course-config-section-primary">
            <div className="course-config-section-head">
              <span>课程信息</span>
            </div>
            <div className="course-config-grid">
              <label className="settings-field">
                <span>schemaVersion</span>
                <input
                  value={draft.schemaVersion}
                  placeholder="默认 1.0.0"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, schemaVersion: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>version</span>
                <input
                  value={draft.version}
                  placeholder="默认 1.0.0"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, version: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>课件 ID</span>
                <input
                  value={draft.id}
                  data-testid="course-config-id"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, id: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>课件名称</span>
                <input
                  value={draft.title}
                  data-testid="course-config-title-input"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, title: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>作者名称</span>
                <input
                  value={draft.authorName}
                  placeholder="默认 LumeSync"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, authorName: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>图标 icon</span>
                <input
                  value={draft.icon}
                  placeholder="未使用时留空"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, icon: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>createdAt</span>
                <input
                  value={draft.createdAt}
                  placeholder="导出时自动补当前时间"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, createdAt: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>updatedAt</span>
                <input
                  value={draft.updatedAt}
                  placeholder="导出时自动更新"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, updatedAt: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>主题色 color</span>
                <input
                  value={draft.color}
                  placeholder="例如 from-blue-500 to-indigo-600"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, color: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field course-config-wide-field">
                <span>简介 desc</span>
                <textarea
                  value={draft.desc}
                  placeholder="未使用时留空"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, desc: event.target.value }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field course-config-wide-field">
                <span>兼容简介 description</span>
                <textarea
                  value={draft.description}
                  placeholder="Core 会在 desc 为空时读取 description"
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, description: event.target.value }));
                    setError('');
                  }}
                />
              </label>
            </div>
          </div>

          <div className="course-config-section">
            <div className="course-config-section-head">
              <span>运行时配置</span>
            </div>
            <div className="course-config-grid">
              <label className="settings-field">
                <span>runtime.format</span>
                <input
                  value={draft.runtime.format}
                  placeholder="默认 lumesync-zip"
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      runtime: { ...previous.runtime, format: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>runtime.react</span>
                <input
                  value={draft.runtime.react}
                  placeholder="默认 18"
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      runtime: { ...previous.runtime, react: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>runtime.slideModule</span>
                <input
                  value={draft.runtime.slideModule}
                  placeholder="默认 tsx"
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      runtime: { ...previous.runtime, slideModule: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>runtime.entryMode</span>
                <input
                  value={draft.runtime.entryMode}
                  placeholder="默认 pages"
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      runtime: { ...previous.runtime, entryMode: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field course-config-wide-field">
                <span>runtime.preferredAspectRatio</span>
                <input
                  value={draft.runtime.preferredAspectRatio}
                  placeholder="默认 16:9"
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      runtime: { ...previous.runtime, preferredAspectRatio: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
            </div>
          </div>

          <div className="course-config-section">
            <div className="course-config-section-head">
              <span>静态资源 assets</span>
              <button
                type="button"
                className="course-config-inline-button"
                onClick={() => {
                  setDraft((previous) => ({
                    ...previous,
                    assets: [...previous.assets, { path: '', type: '', size: '', usage: '' }],
                  }));
                  setError('');
                }}
              >
                添加资源
              </button>
            </div>

            {draft.assets.length ? (
              <div className="course-config-assets">
                {draft.assets.map((asset, index) => (
                  <div className="course-config-asset-row" key={`${asset.path}-${index}`}>
                    <label className="settings-field">
                      <span>资源路径</span>
                      <input
                        value={asset.path}
                        placeholder="assets/example.png"
                        onChange={(event) => updateAsset(index, { path: event.target.value })}
                      />
                    </label>
                    <label className="settings-field">
                      <span>MIME 类型</span>
                      <input
                        value={asset.type}
                        placeholder="image/svg+xml"
                        onChange={(event) => updateAsset(index, { type: event.target.value })}
                      />
                    </label>
                    <label className="settings-field">
                      <span>文件大小</span>
                      <input
                        value={asset.size}
                        placeholder="0"
                        onChange={(event) => updateAsset(index, { size: event.target.value })}
                      />
                    </label>
                    <label className="settings-field">
                      <span>使用页面</span>
                      <input
                        value={asset.usage}
                        placeholder="asset-check, cover"
                        onChange={(event) => updateAsset(index, { usage: event.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="course-config-remove-button"
                      onClick={() => {
                        setDraft((previous) => ({
                          ...previous,
                          assets: previous.assets.filter((_, assetIndex) => assetIndex !== index),
                        }));
                        setError('');
                      }}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="course-config-empty">当前没有显式配置资源；Core 仍会自动读取包内 assets/ 目录。</p>
            )}
          </div>

          <div className="course-config-section">
            <div className="course-config-section-head">
              <span>外部脚本 dependencies</span>
              <button
                type="button"
                className="course-config-inline-button"
                onClick={() => {
                  setDraft((previous) => ({
                    ...previous,
                    dependencies: [...previous.dependencies, { name: '', localSrc: '', publicSrc: '' }],
                  }));
                  setError('');
                }}
              >
                添加依赖
              </button>
            </div>

            {draft.dependencies.length ? (
              <div className="course-config-dependencies">
                {draft.dependencies.map((dependency, index) => (
                  <div className="course-config-dependency-row" key={`${dependency.localSrc}-${index}`}>
                    <label className="settings-field">
                      <span>依赖名称</span>
                      <input
                        value={dependency.name}
                        placeholder="chartjs"
                        onChange={(event) => updateDependency(index, { name: event.target.value })}
                      />
                    </label>
                    <label className="settings-field">
                      <span>本地路径 localSrc</span>
                      <input
                        value={dependency.localSrc}
                        placeholder="/lib/chart.umd.min.js"
                        onChange={(event) => updateDependency(index, { localSrc: event.target.value })}
                      />
                    </label>
                    <label className="settings-field">
                      <span>公网地址 publicSrc</span>
                      <input
                        value={dependency.publicSrc}
                        placeholder="https://fastly.jsdelivr.net/..."
                        onChange={(event) => updateDependency(index, { publicSrc: event.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="course-config-remove-button"
                      onClick={() => {
                        setDraft((previous) => ({
                          ...previous,
                          dependencies: previous.dependencies.filter((_, dependencyIndex) => dependencyIndex !== index),
                        }));
                        setError('');
                      }}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="course-config-empty">当前没有外部脚本依赖；需要 CDN fallback 时再添加。</p>
            )}
          </div>

          <div className="course-config-section">
            <div className="course-config-section-head">
              <span>模型资源 modelsUrls</span>
            </div>
            <div className="course-config-grid">
              <label className="settings-field">
                <span>modelsUrls.local</span>
                <input
                  value={draft.modelsUrls.local}
                  placeholder="/weights"
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      modelsUrls: { ...previous.modelsUrls, local: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
              <label className="settings-field">
                <span>modelsUrls.public</span>
                <input
                  value={draft.modelsUrls.public}
                  placeholder="https://fastly.jsdelivr.net/gh/..."
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      modelsUrls: { ...previous.modelsUrls, public: event.target.value },
                    }));
                    setError('');
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {error ? (
          <div className="course-config-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            data-testid="save-course-config"
            onClick={() => {
              try {
                onSave(validateDraft(draft));
              } catch (validationError: unknown) {
                setError(validationError instanceof Error ? validationError.message : '配置校验失败。');
              }
            }}
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
