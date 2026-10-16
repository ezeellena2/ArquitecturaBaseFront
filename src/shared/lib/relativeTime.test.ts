import { expect, it } from "vitest";
import { formatRelativeTime } from "./dateTime";
it("formats elapsed waiting time in the active language",()=>{const now=Date.parse("2026-10-16T12:00:00Z");expect(formatRelativeTime("2026-10-16T10:00:00Z","en",now)).toBe("2 hours ago");expect(formatRelativeTime("2026-10-14T12:00:00Z","es",now)).toBe("hace 2 días");expect(formatRelativeTime("2026-10-16T11:59:30Z","en",now)).toBe("30 seconds ago");});
