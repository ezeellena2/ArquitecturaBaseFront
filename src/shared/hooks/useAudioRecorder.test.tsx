import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FakeMediaRecorder, installMicrophone, removeMicrophone } from "@/test/mocks/mediaRecorder";
import { useAudioRecorder } from "./useAudioRecorder";

afterEach(() => removeMicrophone());

describe("useAudioRecorder", () => {
  it("is not offered when the browser cannot record what the server accepts", () => {
    expect(renderHook(() => useAudioRecorder(1000)).result.current.supported).toBe(false);
    installMicrophone();
    FakeMediaRecorder.supported = [];
    try {
      expect(renderHook(() => useAudioRecorder(1000)).result.current.supported).toBe(false);
    } finally { FakeMediaRecorder.supported = ["audio/webm;codecs=opus", "audio/webm"]; }
  });

  it("records WebM at a low bit rate, keeps it to listen to and releases the microphone", async () => {
    const microphone = installMicrophone();
    const { result } = renderHook(() => useAudioRecorder(1000));
    expect(result.current.supported).toBe(true);
    await act(() => result.current.start());
    expect(result.current.state).toBe("recording");
    expect(FakeMediaRecorder.last?.options).toEqual({ mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32000 });
    act(() => FakeMediaRecorder.last!.emit(10));
    act(() => result.current.stop());
    expect(result.current.state).toBe("ready");
    expect(result.current.recording?.size).toBe(14);
    expect(result.current.recording?.type).toBe("audio/webm;codecs=opus");
    expect(microphone.stop).toHaveBeenCalled();
  });

  it("stops by itself at the bound, without the chunk that would pass it", async () => {
    installMicrophone();
    const { result } = renderHook(() => useAudioRecorder(100));
    await act(() => result.current.start());
    act(() => FakeMediaRecorder.last!.emit(60));
    act(() => FakeMediaRecorder.last!.emit(60));
    expect(result.current.state).toBe("ready");
    expect(result.current.recording?.size).toBe(60);
  });

  it("drops a discarded recording, during or after it", async () => {
    installMicrophone();
    const { result } = renderHook(() => useAudioRecorder(1000));
    await act(() => result.current.start());
    act(() => result.current.discard());
    expect(result.current.state).toBe("idle");
    expect(result.current.recording).toBeUndefined();
    await act(() => result.current.start());
    act(() => result.current.stop());
    act(() => result.current.discard());
    expect(result.current.state).toBe("idle");
    expect(result.current.recording).toBeUndefined();
  });

  it("says so when the person does not allow the microphone", async () => {
    installMicrophone({ allowed: false });
    const { result } = renderHook(() => useAudioRecorder(1000));
    await act(() => result.current.start());
    expect(result.current.state).toBe("idle");
    expect(result.current.denied).toBe(true);
  });
});
