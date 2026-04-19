export const clampTeacherContentScale = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 0.6), 1.2);
};

export const applyTeacherContentScale = (rootElement: HTMLElement, scale: number) => {
  const contentScale = clampTeacherContentScale(scale);
  const pages = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-export-page]'));

  pages.forEach((page) => {
    const pageFrame = page.firstElementChild as HTMLElement | null;
    const viewport = pageFrame?.firstElementChild as HTMLElement | null;
    const contentLayer = viewport?.firstElementChild as HTMLElement | null;

    if (!contentLayer) return;

    contentLayer.style.transform = `scale(${contentScale})`;
    contentLayer.style.transformOrigin = 'top left';
    contentLayer.style.width = `${100 / contentScale}%`;
    contentLayer.style.height = `${100 / contentScale}%`;
    contentLayer.style.position = 'relative';
  });
};

export const scheduleTeacherContentScale = (
  targetWindow: Window,
  rootElement: HTMLElement,
  scale: number,
  shouldCancel: () => boolean,
) => {
  const apply = () => {
    if (!shouldCancel()) applyTeacherContentScale(rootElement, scale);
  };

  targetWindow.requestAnimationFrame(apply);
  [0, 32, 80, 160, 320].forEach((delay) => {
    targetWindow.setTimeout(apply, delay);
  });
};
