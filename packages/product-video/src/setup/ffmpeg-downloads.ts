/**
 * Where vaunt downloads ffmpeg from when the user asks it to. vaunt doesn't ship or host ffmpeg itself: each entry
 * is a static GPL build published by a third party, pinned to one version with the SHA-256 we checked it against,
 * so a file swapped on the server later is refused rather than installed. Every build here includes the libx264
 * and libwebp encoders vaunt needs.
 *
 * - macOS and Linux: Martin Riedl's FFmpeg build server, https://ffmpeg.martin-riedl.de ("Download Release Build").
 *   Static ffmpeg and ffprobe, one ZIP each; the macOS builds are signed and notarized. Each file has a `.sha256`
 *   next to it, and `codecs.txt` lists the encoders.
 * - Windows: Gyan Doshi's "release essentials" build, https://www.gyan.dev/ffmpeg/builds (linked from ffmpeg.org),
 *   from its GitHub release mirror https://github.com/GyanD/codexffmpeg/releases. The ZIP holds bin/ffmpeg.exe and
 *   bin/ffprobe.exe; the checksum is the one GitHub reports for the release asset.
 *
 * To update: pick the new release on those pages, then for each archive set the URL, `sha256` (from the `.sha256`
 * file / `gh release view -R GyanD/codexffmpeg <tag> --json assets`) and `bytes` (`curl -sIL <url>` Content-Length),
 * and bump `FFMPEG_DOWNLOAD_VERSION`. Platforms without an entry (e.g. Windows on Arm) report `installable: false`.
 */
export const FFMPEG_DOWNLOAD_VERSION = "9.1";

export type FfmpegArchive = {
  url: string;
  sha256: string;
  /** Size of the download, for "About 57 MB". */
  bytes: number;
};

export type FfmpegDownload = {
  version: string;
  /** ZIP archives that together hold `ffmpeg` and `ffprobe` (with `.exe` on Windows) somewhere inside. */
  archives: FfmpegArchive[];
};

const RIEDL = "https://ffmpeg.martin-riedl.de/download";

const DOWNLOADS: Record<string, FfmpegDownload> = {
  "darwin-arm64": {
    version: FFMPEG_DOWNLOAD_VERSION,
    archives: [
      {
        url: `${RIEDL}/macos/arm64/1795207104_9.1/ffmpeg.zip`,
        sha256: "1f66e9a690a7f1c9e60b012379f8869c11818d1797f45b21dbb2f2564ba61ae1",
        bytes: 28_623_086,
      },
      {
        url: `${RIEDL}/macos/arm64/1795207104_9.1/ffprobe.zip`,
        sha256: "6ef2df5f575042923a28537ab37adf936f28bf3e7b85de23a1447ed447ec1dbd",
        bytes: 28_541_295,
      },
    ],
  },
  "darwin-x64": {
    version: FFMPEG_DOWNLOAD_VERSION,
    archives: [
      {
        url: `${RIEDL}/macos/amd64/1795212433_9.1/ffmpeg.zip`,
        sha256: "35b3d82cccc2c1d644d49d15f5e57eb913a08ef68f798042c90eecec62c51f1e",
        bytes: 34_064_287,
      },
      {
        url: `${RIEDL}/macos/amd64/1795212433_9.1/ffprobe.zip`,
        sha256: "41ca7b7cba7992e33f1da3f1bf54db8ec103a4d387b1bfac3162062e8b1074ad",
        bytes: 33_959_464,
      },
    ],
  },
  "linux-x64": {
    version: FFMPEG_DOWNLOAD_VERSION,
    archives: [
      {
        url: `${RIEDL}/linux/amd64/1795205506_9.1/ffmpeg.zip`,
        sha256: "707d4fa675932cc310e39e1506ac9224049786119689e345fed1c453a8a0896e",
        bytes: 33_573_944,
      },
      {
        url: `${RIEDL}/linux/amd64/1795205506_9.1/ffprobe.zip`,
        sha256: "5e4c53c9c86d6371027efa83d62c2cea00e02ded0234d8cc952d06c9259e4b33",
        bytes: 33_467_313,
      },
    ],
  },
  "linux-arm64": {
    version: FFMPEG_DOWNLOAD_VERSION,
    archives: [
      {
        url: `${RIEDL}/linux/arm64/1795204341_9.1/ffmpeg.zip`,
        sha256: "e42242dd20b01cf9fe6cff1902b6e5e72be07c2b551d95abc8f332cdb0ff7d86",
        bytes: 29_002_466,
      },
      {
        url: `${RIEDL}/linux/arm64/1795204341_9.1/ffprobe.zip`,
        sha256: "a1561aa2136bce9f51dac9b13be4480466a3031f82907d551619dcdc3b867ccc",
        bytes: 28_892_361,
      },
    ],
  },
  "win32-x64": {
    version: FFMPEG_DOWNLOAD_VERSION,
    archives: [
      {
        url: "https://github.com/GyanD/codexffmpeg/releases/download/9.1/ffmpeg-9.1-essentials_build.zip",
        sha256: "b9bbbb3acece000cbeec994f856649354e52c773807841e78908374b24d658fd",
        bytes: 119_467_219,
      },
    ],
  },
};

/** The ffmpeg download for a platform and CPU, or null when there's no build vaunt trusts for it. */
export function ffmpegDownloadFor(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): FfmpegDownload | null {
  return DOWNLOADS[`${platform}-${arch}`] ?? null;
}

export function downloadBytes(download: FfmpegDownload): number {
  return download.archives.reduce((sum, archive) => sum + archive.bytes, 0);
}
