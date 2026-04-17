type HomeScreenProps = {
  hasLoadedCourse: boolean;
  courseTitle: string;
  onCreateCourse: () => void;
  onOpenCourse: () => void;
  onContinueCourse: () => void;
};

export default function HomeScreen({
  hasLoadedCourse,
  courseTitle,
  onCreateCourse,
  onOpenCourse,
  onContinueCourse,
}: HomeScreenProps) {
  return (
    <main className="home-shell" data-testid="home-screen">
      <section className="home-visual">
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=82"
          alt=""
          aria-hidden="true"
        />
        <div className="home-visual-shade" />
        <div className="home-brand">
          <span className="home-mark">L</span>
          <span>LumeSync Editor</span>
        </div>
      </section>

      <section className="home-actions" aria-labelledby="home-title">
        <p className="eyebrow">Course workspace</p>
        <h1 id="home-title">开始制作课件</h1>
        <p className="home-copy">创建一个新课件，或打开已有 `.lume` 文件继续修改。</p>

        <div className="home-action-list">
          <button type="button" className="home-action primary" aria-label="创建新课件" data-testid="create-course" onClick={onCreateCourse}>
            <span>
              <strong>创建新课件</strong>
              <small>从空白模板开始，先写第一页，再逐步扩展。</small>
            </span>
            <b>New</b>
          </button>

          <button type="button" className="home-action" aria-label="打开旧课件" data-testid="open-course" onClick={onOpenCourse}>
            <span>
              <strong>打开旧课件</strong>
              <small>载入已有内容，在编辑器里继续调整和预览。</small>
            </span>
            <b>Open</b>
          </button>

          {hasLoadedCourse ? (
            <button type="button" className="home-action subtle" aria-label="继续编辑" data-testid="continue-course" onClick={onContinueCourse}>
              <span>
                <strong>继续编辑</strong>
                <small>{courseTitle}</small>
              </span>
              <b>Resume</b>
            </button>
          ) : null}
        </div>

        <div className="home-note">
          <span>当前流程</span>
          <strong>选择课件后进入代码、预览和 AI 协作工作区。</strong>
        </div>
      </section>
    </main>
  );
}
