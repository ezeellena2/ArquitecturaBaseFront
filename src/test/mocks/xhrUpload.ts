import { vi } from "vitest";

/// jsdom cannot hand a File inside FormData to MSW, so an upload with a file is observed at XMLHttpRequest, as the browser
/// sends it. Each send takes the next answer (status and JSON body), or the last one again. An answer may first report how much
/// went up (`progress`, fractions from 0 to 1) and wait for `release` before the server answers.
export function captureUploads(answers: { status: number; body: unknown; progress?: readonly number[]; release?: Promise<void> }[]) {
  const sends: { url: string; body: FormData }[] = [];
  class FakeXhr {
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    status = 0;
    responseText = "";
    url = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    open(_method: string, url: string) { this.url = url; }
    setRequestHeader() {}
    abort() { this.onabort?.(); }
    getAllResponseHeaders() { return "content-type: application/json"; }
    send(body: FormData) {
      sends.push({ url: this.url, body });
      const answer = answers.length > 1 ? answers.shift()! : answers[0];
      const respond = () => { this.status = answer.status; this.responseText = JSON.stringify(answer.body); this.onload?.(); };
      setTimeout(() => {
        for (const fraction of answer.progress ?? [])
          this.upload.onprogress?.({ lengthComputable: true, loaded: fraction * 100, total: 100 } as ProgressEvent);
        if (answer.release) void answer.release.then(respond);
        else respond();
      }, 0);
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  return sends;
}
