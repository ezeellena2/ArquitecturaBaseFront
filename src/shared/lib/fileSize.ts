// The size of a file as people read it: whole kilobytes under a megabyte (never zero) and megabytes with one decimal above, in the
// menu language. Each language keeps its two formatters: building one costs much more than using it.
const formats = new Map<string, { whole: Intl.NumberFormat; tenths: Intl.NumberFormat }>();

export function formatFileSize(bytes: number, language: string): string {
  let format = formats.get(language);
  if (!format) formats.set(language, format = {
    whole: new Intl.NumberFormat(language),
    tenths: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
  });
  return bytes < 1024 * 1024
    ? format.whole.format(Math.max(1, Math.ceil(bytes / 1024))) + " KB"
    : format.tenths.format(bytes / (1024 * 1024)) + " MB";
}
