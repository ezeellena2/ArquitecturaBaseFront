import { vi } from "vitest";

/// A microphone recorder for jsdom: it records nothing, and the test decides when each chunk arrives. Stopping delivers one
/// last chunk, as browsers do.
export class FakeMediaRecorder {
  static supported = ["audio/webm;codecs=opus", "audio/webm"];
  static isTypeSupported = (type: string) => FakeMediaRecorder.supported.includes(type);
  static last: FakeMediaRecorder | undefined;
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly stream: MediaStream;
  readonly options?: { mimeType?: string; audioBitsPerSecond?: number };
  constructor(stream: MediaStream, options?: { mimeType?: string; audioBitsPerSecond?: number }) {
    this.stream = stream;
    this.options = options;
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeMediaRecorder.last = this;
  }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.emit(4);
    this.onstop?.();
  }
  emit(size: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(size)], { type: this.mimeType }) });
  }
}

/// Installs the fake recorder and a microphone that the person allows or denies.
export function installMicrophone({ allowed = true }: { allowed?: boolean } = {}) {
  const stop = vi.fn();
  const getUserMedia = vi.fn(() => allowed
    ? Promise.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    : Promise.reject(new DOMException("Permission denied", "NotAllowedError")));
  FakeMediaRecorder.last = undefined;
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { getUserMedia, stop };
}

export function removeMicrophone() {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "mediaDevices");
}
