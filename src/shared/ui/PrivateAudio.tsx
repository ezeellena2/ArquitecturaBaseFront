import { useEffect, useRef } from "react";
// The caller owns access and bytes. Playback begins only after its explicit Listen action.
export function PrivateAudio({ blob, label, playOnLoad = false }: { blob: Blob; label: string; playOnLoad?: boolean }) {
 const audio = useRef<HTMLAudioElement>(null);
 useEffect(() => {
  const element = audio.current; if (!element) return;
  const url = URL.createObjectURL(blob); element.src = url;
  if (playOnLoad) { element.focus(); void element.play().catch(() => {}); }
  return () => { element.pause(); element.removeAttribute("src"); URL.revokeObjectURL(url); };
 }, [blob, playOnLoad]);
 return <audio ref={audio} controls preload="none" tabIndex={0} aria-label={label} className="h-10 w-full max-w-full"/>;
}
