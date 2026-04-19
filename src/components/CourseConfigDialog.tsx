import CourseConfigPanel from './CourseConfigPanel';
import type { CourseManifest } from '../lib/types';

type CourseConfigDialogProps = {
  manifest: CourseManifest;
  open: boolean;
  onClose: () => void;
  onSave: (manifest: CourseManifest) => void;
};

export default function CourseConfigDialog({ manifest, open, onClose, onSave }: CourseConfigDialogProps) {
  if (!open) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="course-config-title">
      <div className="settings-panel course-config-panel">
        <div className="settings-header">
          <div>
            <p className="eyebrow">Course Manifest</p>
            <h2 id="course-config-title">查看和编辑课件配置</h2>
          </div>
          <button type="button" className="icon-button" aria-label="关闭配置面板" onClick={onClose}>
            x
          </button>
        </div>
        <CourseConfigPanel manifest={manifest} onSave={onSave} />
      </div>
    </div>
  );
}
