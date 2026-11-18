import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from "three";
import type { FrameSource } from "./frame-source";

/** A still image: one texture, uploaded once the file decodes; `show` has nothing to do. */
export function createImageFrameSource({
  url,
  size,
  maxAnisotropy,
  onFrame,
}: {
  url: string;
  size: { width: number; height: number };
  maxAnisotropy: number;
  onFrame: () => void;
}): FrameSource {
  const texture = new Texture();
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = maxAnisotropy;

  let disposed = false;
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  const decoded = image
    .decode()
    .then(() => {
      if (disposed) return;
      texture.image = image;
      texture.needsUpdate = true;
      onFrame();
    })
    .catch(() => undefined);

  return {
    texture,
    size,
    show: () => undefined,
    prepare: () => decoded,
    idle: () => undefined,
    dispose() {
      disposed = true;
      image.removeAttribute("src");
      texture.dispose();
    },
  };
}
