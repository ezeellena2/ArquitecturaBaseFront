import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { FormRecordFiles } from "./FormRecordFiles";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { readFormFile } from "@/shared/api/formFiles";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
vi.mock("@/shared/api/formFiles", () => ({ readFormFile: vi.fn(async () => new Blob(["photo"], { type: "image/jpeg" })) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"), savePrivateBlob: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
it("loads visible thumbnails once during the response scope and purges them when it ends", async () => {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); } observe() {} disconnect() {} });
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:photo"), revokeObjectURL: vi.fn() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const files = [{ fileId: "photo", name: "photo.jpg", contentType: "image/jpeg", size: 20, hasThumbnail: true }];
  const content = (visible: boolean, scope = "reader:form") => <PrivateFormFilesScopeProvider scope={scope}>{visible ? <FormRecordFiles actor="reader" recordId="record" files={files} photo label="Photos" number="R-1" onForbidden={() => undefined} onError={() => undefined} /> : null}</PrivateFormFilesScopeProvider>;
  const view = render(content(true), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  expect(readFormFile).not.toHaveBeenCalled();
  await act(async () => callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  await waitFor(() => expect(readFormFile).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ["form-files", "reader:form"] })[0]?.state.status).toBe("success"));
  view.rerender(content(false));
  view.rerender(content(true));
  await act(async () => callbacks.at(-1)!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(readFormFile).toHaveBeenCalledTimes(1);
  view.rerender(content(false, "reader:permission-changed"));
  expect(client.getQueryCache().findAll({ queryKey: ["form-files", "reader:form"] })).toHaveLength(0);
  view.rerender(content(true));
  await act(async () => callbacks.at(-1)!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  await waitFor(() => expect(readFormFile).toHaveBeenCalledTimes(2));
  view.unmount();
  expect(client.getQueryCache().findAll({ queryKey: ["form-files", "reader:form"] })).toHaveLength(0);
});

// Downloading a document shows that it works on its button (board LC1-A) until the file arrives.
it("shows that Descargar works while it brings the document", async () => {
  let release!: () => void;
  vi.mocked(readFormFile).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(new Blob(["pdf"], { type: "application/pdf" })); }));
  const files = [{ fileId: "document", name: "remito.pdf", contentType: "application/pdf", size: 2048, hasThumbnail: false }];
  renderWithProviders(<FormRecordFiles actor="reader" recordId="record" files={files} photo={false} label="Documentos" number="R-1" onForbidden={() => undefined} onError={() => undefined} />);
  await userEvent.click(screen.getByRole("button", { name: "Descargar" }));
  expect(await screen.findByRole("button", { name: "Descargando…" })).toHaveAttribute("aria-busy", "true");
  await act(async () => release());
  await waitFor(() => expect(savePrivateBlob).toHaveBeenCalledWith(expect.anything(), "remito.pdf"));
  expect(screen.getByRole("button", { name: "Descargar" })).toBeEnabled();
});

it("shows a spinner in a thumbnail while its photo loads", async () => {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); } observe() {} disconnect() {} });
  vi.mocked(readFormFile).mockImplementationOnce(() => new Promise(() => undefined));
  const files = [{ fileId: "photo", name: "entrega.jpg", contentType: "image/jpeg", size: 20, hasThumbnail: true }];
  renderWithProviders(<FormRecordFiles actor="reader" recordId="record" files={files} photo label="Fotos" number="R-1" onForbidden={() => undefined} onError={() => undefined} />);
  await act(async () => callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  const thumbnail = screen.getByRole("button", { name: "Ver entrega.jpg · Cargando…" });
  expect(thumbnail.querySelector('[data-slot="thumbnail-spinner"]')).not.toBeNull();
});
