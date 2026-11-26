import { inflateRawSync } from "node:zlib";

/**
 * Just enough ZIP reading to take a few files out of an ffmpeg download, so installing doesn't depend on `unzip`
 * being on the machine (it often isn't on Linux). Handles stored and deflated entries and ZIP64 sizes.
 */

const EOCD = 0x06054b50;
const ZIP64_EOCD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const CENTRAL_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const MAX_32 = 0xffffffff;

export type ZipEntry = { name: string; method: number; compressedSize: number; size: number; offset: number };

function fail(): never {
  throw new Error("The download isn't a readable ZIP archive.");
}

function readU64(buffer: Buffer, at: number): number {
  const value = buffer.readBigUInt64LE(at);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail();
  return Number(value);
}

/** The archive's entries, from its central directory. */
export function zipEntries(zip: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 22 - 0xffff); at--)
    if (zip.readUInt32LE(at) === EOCD) {
      eocd = at;
      break;
    }
  if (eocd < 0) fail();
  let count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (
    (count === 0xffff || offset === MAX_32) &&
    eocd >= 20 &&
    zip.readUInt32LE(eocd - 20) === ZIP64_LOCATOR
  ) {
    const zip64 = readU64(zip, eocd - 20 + 8);
    if (zip.readUInt32LE(zip64) !== ZIP64_EOCD) fail();
    count = readU64(zip, zip64 + 32);
    offset = readU64(zip, zip64 + 48);
  }

  const entries: ZipEntry[] = [];
  let at = offset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== CENTRAL_ENTRY) fail();
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const entry: ZipEntry = {
      name: zip.toString("utf8", at + 46, at + 46 + nameLength),
      method: zip.readUInt16LE(at + 10),
      compressedSize: zip.readUInt32LE(at + 20),
      size: zip.readUInt32LE(at + 24),
      offset: zip.readUInt32LE(at + 42),
    };
    // ZIP64 extra field: the 64-bit values for whichever 32-bit fields are maxed out, in this order.
    let extra = at + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = zip.readUInt16LE(extra);
      const length = zip.readUInt16LE(extra + 2);
      if (id === 0x0001) {
        let field = extra + 4;
        const next = () => {
          const value = readU64(zip, field);
          field += 8;
          return value;
        };
        if (entry.size === MAX_32) entry.size = next();
        if (entry.compressedSize === MAX_32) entry.compressedSize = next();
        if (entry.offset === MAX_32) entry.offset = next();
      }
      extra += 4 + length;
    }
    entries.push(entry);
    at = extraEnd + commentLength;
  }
  return entries;
}

/** One entry's contents. */
export function readZipEntry(zip: Buffer, entry: ZipEntry): Buffer {
  const at = entry.offset;
  if (at + 30 > zip.length || zip.readUInt32LE(at) !== LOCAL_HEADER) fail();
  const start = at + 30 + zip.readUInt16LE(at + 26) + zip.readUInt16LE(at + 28);
  const data = zip.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) fail();
  // 0: stored, 8: deflated; nothing else turns up in ffmpeg's archives.
  if (entry.method !== 0 && entry.method !== 8) fail();
  const contents = entry.method === 8 ? inflateRawSync(data) : Buffer.from(data);
  if (contents.length !== entry.size) fail();
  return contents;
}

/** The file entry whose last path segment is `fileName` (e.g. `ffmpeg-9.1-essentials_build/bin/ffmpeg.exe`). */
export function findZipEntry(entries: ZipEntry[], fileName: string): ZipEntry | null {
  return (
    entries.find((entry) => !entry.name.endsWith("/") && entry.name.split(/[\\/]/).pop() === fileName) ?? null
  );
}
