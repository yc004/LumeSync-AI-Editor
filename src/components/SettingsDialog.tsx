import { useEffect, useState } from 'react';
import type { AiSettings } from '../lib/types';

type SettingsDialogProps = {
  initialSettings: AiSettings;
  open: boolean;
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
  onTestConnection: (settings: AiSettings) => Promise<string>;
};

export default function SettingsDialog({ initialSettings, open, onClose, onSave, onTestConnection }: SettingsDialogProps) {
  const [draft, setDraft] = useState<AiSettings>(initialSettings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(initialSettings);
      setTestResult('');
    }
  }, [initialSettings, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="settings-panel">
        <div className="settings-header">
          <div>
            <p className="eyebrow">AI 配置</p>
            <h2 id="settings-title">配置课程助手模型</h2>
          </div>
          <button type="button" className="icon-button" aria-label="close-settings" onClick={onClose}>
            关
          </button>
        </div>

        <label className="settings-field">
          <span>模型名称</span>
          <input
            data-testid="settings-model"
            value={draft.model}
            onChange={(event) => setDraft((previous) => ({ ...previous, model: event.target.value }))}
            placeholder="gpt-4.1-mini"
          />
        </label>

        <label className="settings-field">
          <span>接口地址</span>
          <input
            data-testid="settings-baseurl"
            value={draft.baseUrl}
            onChange={(event) => setDraft((previous) => ({ ...previous, baseUrl: event.target.value }))}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label className="settings-field">
          <span>API Key</span>
          <input
            data-testid="settings-apikey"
            type="password"
            value={draft.apiKey}
            onChange={(event) => setDraft((previous) => ({ ...previous, apiKey: event.target.value }))}
            placeholder="sk-..."
          />
        </label>

        <div className="settings-test-row">
          <button
            type="button"
            className="secondary-button"
            data-testid="test-connection"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              setTestResult('');
              try {
                const message = await onTestConnection({
                  model: draft.model.trim(),
                  baseUrl: draft.baseUrl.trim(),
                  apiKey: draft.apiKey.trim(),
                });
                setTestResult(`连接成功：${message}`);
              } catch (error: unknown) {
                setTestResult(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          {testResult ? (
            <span className="settings-test-result" data-testid="test-connection-result">
              {testResult}
            </span>
          ) : null}
        </div>

        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            data-testid="save-settings"
            onClick={() => onSave({ model: draft.model.trim(), baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim() })}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
