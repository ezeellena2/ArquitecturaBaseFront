import { formatNumber } from "./numberFormat";

// The size of a file as people read it: whole kilobytes under a megabyte (never zero) and megabytes with one decimal above, with
// the one number format of the menu language (numberFormat.ts): «1.023 KB», «1,5 MB».
export function formatFileSize(bytes: number, language: string): string {
  return bytes < 1024 * 1024
    ? formatNumber(Math.max(1, Math.ceil(bytes / 1024)), language) + " KB"
    : formatNumber(bytes / (1024 * 1024), language, { maximumFractionDigits: 1 }) + " MB";
}
