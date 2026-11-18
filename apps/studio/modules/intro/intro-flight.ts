export type ScreenRect = { left: number; top: number; width: number; height: number };

/** The transform that carries an element laid out at `from` onto `to`, scaling from its top-left corner. */
export function flightTransform(from: ScreenRect, to: ScreenRect): string {
  const scale = to.height / from.height;
  return `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`;
}

/** `rect` narrowed or widened about its centre to `aspect`, keeping its height. */
export function withAspect(rect: ScreenRect, aspect: number): ScreenRect {
  const width = rect.height * aspect;
  return { ...rect, left: rect.left + (rect.width - width) / 2, width };
}

/** Where to show the logo when there's no WebGL to draw it: centred, `share` of the screen wide. */
export function centredRect(
  aspect: number,
  viewport: { width: number; height: number },
  share = 0.46
): ScreenRect {
  const width = viewport.width * share;
  const height = width / aspect;
  return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height };
}
