import type { CourseManifest } from '../lib/types';

type SlidePaginatorProps = {
  manifest: CourseManifest;
  currentSlideId: string;
  onSelectSlide: (slideId: string) => void;
};

export default function SlidePaginator({ manifest, currentSlideId, onSelectSlide }: SlidePaginatorProps) {
  return (
    <div className="slide-paginator" data-testid="slide-paginator">
      <div>
        <p className="eyebrow">Lume Course</p>
        <h2>{manifest.title}</h2>
      </div>
      <div className="slide-paginator-track">
        {manifest.pages.map((page, index) => {
          const isActive = page.id === currentSlideId;
          return (
            <button
              key={page.id}
              type="button"
              className={isActive ? 'slide-pill active' : 'slide-pill'}
              onClick={() => onSelectSlide(page.id)}
              aria-pressed={isActive}
            >
              <span className="slide-pill-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="slide-pill-copy">
                <strong>{page.title}</strong>
                <small>第 {index + 1} 页</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
