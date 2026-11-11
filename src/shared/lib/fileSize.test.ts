import { expect, it } from "vitest";
import { formatFileSize } from "./fileSize";

it("shows kilobytes under a megabyte, never zero, and megabytes with one decimal in the menu language", () => {
  expect(formatFileSize(0, "es")).toBe("1 KB");
  expect(formatFileSize(1, "es")).toBe("1 KB");
  expect(formatFileSize(24 * 1024 + 1, "es")).toBe("25 KB");
  expect(formatFileSize(1023 * 1024, "en")).toBe("1,023 KB");
  expect(formatFileSize(1024 * 1024, "es")).toBe("1 MB");
  expect(formatFileSize(1.5 * 1024 * 1024, "es")).toBe("1,5 MB");
  expect(formatFileSize(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
  expect(formatFileSize(10 * 1024 * 1024 + 1, "es")).toBe("10 MB");
});
