import { useCallback, useEffect, useRef, useState } from "react";

// What a browser records that the server accepts, in order of preference: WebM (Chrome, Firefox) or MP4 (Safari).
const recordedTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export type AudioRecorderState = "idle" | "starting" | "recording" | "ready";

function recordedType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return undefined;
  return recordedTypes.find(type => window.MediaRecorder.isTypeSupported(type));
}

/// One recording from the microphone, up to `maxBytes`, kept in the browser to listen to before sending: the owner uploads
/// it. Reaching the bound stops the recording with what fit; discarding drops it.
export function useAudioRecorder(maxBytes: number) {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [recording, setRecording] = useState<Blob>();
  const [seconds, setSeconds] = useState(0);
  const [denied, setDenied] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const discarded = useRef(false);
  const mounted = useRef(true);
  const type = recordedType();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      discarded.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const startedAt = performance.now();
    const timer = setInterval(() => setSeconds(Math.floor((performance.now() - startedAt) / 1000)), 250);
    return () => clearInterval(timer);
  }, [state]);

  const start = useCallback(async () => {
    if (!type || recorder.current) return;
    setDenied(false);
    setRecording(undefined);
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (mounted.current) { setDenied(true); setState("idle"); }
      return;
    }
    if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
    const chunks: Blob[] = [];
    let size = 0;
    let full = false;
    // A low bit rate keeps a few minutes of voice inside the bound.
    const media = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32000 });
    media.ondataavailable = event => {
      if (full || event.data.size === 0) return;
      if (size + event.data.size > maxBytes) { full = true; if (media.state === "recording") media.stop(); return; }
      chunks.push(event.data);
      size += event.data.size;
    };
    media.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      recorder.current = null;
      if (!mounted.current) return;
      if (discarded.current || chunks.length === 0) { setRecording(undefined); setState("idle"); return; }
      setRecording(new Blob(chunks, { type: media.mimeType || type }));
      setState("ready");
    };
    discarded.current = false;
    recorder.current = media;
    media.start(1000);
    setSeconds(0);
    setState("recording");
  }, [maxBytes, type]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const discard = useCallback(() => {
    if (recorder.current?.state === "recording") { discarded.current = true; recorder.current.stop(); return; }
    setRecording(undefined);
    setState("idle");
  }, []);

  return { supported: !!type, state, recording, seconds, denied, start, stop, discard };
}
