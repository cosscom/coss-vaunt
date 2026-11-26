import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findZipEntry, readZipEntry, zipEntries } from "./zip-extract";

/** A minimal ZIP writer for the tests: stored or deflated entries, no CRCs (the reader doesn't check them). */
function makeZip(files: Array<{ name: string; data: string; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data, deflate } of files) {
    const raw = Buffer.from(data);
    const body = deflate ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe("zip extraction", () => {
  const zip = makeZip([
    { name: "ffmpeg-9.1-essentials_build/", data: "" },
    { name: "ffmpeg-9.1-essentials_build/bin/ffmpeg.exe", data: "ffmpeg binary ".repeat(100), deflate: true },
    { name: "ffmpeg-9.1-essentials_build/bin/ffprobe.exe", data: "ffprobe binary" },
  ]);

  it("lists the entries", () => {
    expect(zipEntries(zip).map((entry) => entry.name)).toEqual([
      "ffmpeg-9.1-essentials_build/",
      "ffmpeg-9.1-essentials_build/bin/ffmpeg.exe",
      "ffmpeg-9.1-essentials_build/bin/ffprobe.exe",
    ]);
  });

  it("finds a file by name anywhere in the archive and reads stored and deflated entries", () => {
    const entries = zipEntries(zip);
    const ffmpeg = findZipEntry(entries, "ffmpeg.exe");
    const ffprobe = findZipEntry(entries, "ffprobe.exe");
    expect(ffmpeg && readZipEntry(zip, ffmpeg).toString()).toBe("ffmpeg binary ".repeat(100));
    expect(ffprobe && readZipEntry(zip, ffprobe).toString()).toBe("ffprobe binary");
    expect(findZipEntry(entries, "ffplay.exe")).toBeNull();
    expect(findZipEntry(entries, "ffmpeg-9.1-essentials_build")).toBeNull();
  });

  it("refuses something that isn't a ZIP", () => {
    expect(() => zipEntries(Buffer.from("<html>Not found</html>"))).toThrow(/ZIP/);
  });
});
