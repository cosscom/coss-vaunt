import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav-encoding";

describe("encodeWav", () => {
  it("writes a 16-bit PCM header and interleaves clipped samples", () => {
    const left = new Float32Array([0, 1, -1]);
    const right = new Float32Array([0.5, 2, -2]);
    const wav = encodeWav({
      numberOfChannels: 2,
      sampleRate: 48000,
      length: 3,
      getChannelData: (channel) => (channel === 0 ? left : right),
    });
    const view = new DataView(wav);
    const text = (offset: number) => String.fromCharCode(...new Uint8Array(wav, offset, 4));
    expect([text(0), text(8), text(36)]).toEqual(["RIFF", "WAVE", "data"]);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(40, true)).toBe(12);
    expect([0, 1, 2, 3, 4, 5].map((index) => view.getInt16(44 + index * 2, true))).toEqual([
      0, 16383, 32767, 32767, -32768, -32768,
    ]);
  });
});
