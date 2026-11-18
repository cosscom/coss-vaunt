/** The parts of an `AudioBuffer` a WAV file needs, so tests can pass plain arrays. */
export type PcmSource = {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData: (channel: number) => Float32Array;
};

/** 16-bit PCM WAV, channels interleaved, samples clipped to −1..1. */
export function encodeWav(source: PcmSource): ArrayBuffer {
  const { numberOfChannels: channels, sampleRate, length } = source;
  const bytesPerSample = 2;
  const dataBytes = length * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  const data = Array.from({ length: channels }, (_, channel) => source.getChannelData(channel));
  let offset = 44;
  for (let index = 0; index < length; index++) {
    for (const samples of data) {
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return buffer;
}
