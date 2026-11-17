export const MEDIA_IMPORT_COPY = {
  importing: (name: string) => `Importing ${name}…`,
  converting: "QuickTime movies may be converted to MP4, which can take a while.",
  imported: (name: string) => `Imported ${name}`,
  converted: "Converted to MP4 so it plays in the browser.",
  convertedAudio: "Converted to M4A so every browser can play it.",
  failed: (name: string) => `Couldn’t import ${name}`,
  dropTitle: "Drop a video or image here",
  dropDescription: "MP4, MOV or WebM up to 2 GB; PNG, JPEG, WebP or GIF up to 50 MB.",
  choose: "Choose files",
  nothingToImport: "Those files aren’t videos or images this studio can use",
} as const;
