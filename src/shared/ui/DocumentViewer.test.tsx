import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { DocumentViewer } from "./DocumentViewer";

// DOC5-A: a photo is brought closer, taken away and turned inside its box; a PDF goes to the browser's viewer; anything else only
// downloads. The box keeps its place while the file arrives and when it could not be read.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:document");
  URL.revokeObjectURL = vi.fn();
});

it("zooms a photo between its limits, turns it a quarter at a time and downloads it as it is", async () => {
  const user = userEvent.setup();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  renderWithProviders(<DocumentViewer name="comprobante.jpg" mediaType="image/jpeg" blob={new Blob(["jpeg"], { type: "image/jpeg" })} />);
  expect(await screen.findByRole("toolbar", { name: "Ver comprobante.jpg" })).toBeInTheDocument();
  expect(screen.getByText("100%")).toBeInTheDocument();
  const image = screen.getByRole("img", { name: "comprobante.jpg" });
  await user.click(screen.getByRole("button", { name: "Acercar" }));
  expect(screen.getByText("150%")).toBeInTheDocument();
  for (let step = 0; step < 3; step++) await user.click(screen.getByRole("button", { name: "Acercar" }));
  expect(screen.getByText("300%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Acercar" })).toBeDisabled();
  for (let step = 0; step < 5; step++) await user.click(screen.getByRole("button", { name: "Alejar" }));
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Alejar" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Girar" }));
  expect(image.style.transform).toContain("rotate(90deg)");
  // Turned a quarter, the photo takes the other measures of its stage before turning, so it never leaves it.
  expect(image.style.width).toBe("100cqh");
  await user.click(screen.getByRole("button", { name: "Descargar" }));
  expect(click).toHaveBeenCalledTimes(1);
  click.mockRestore();
});

it("shows a PDF with the browser's viewer and something else without a preview, and keeps the box while it loads or fails", async () => {
  const user = userEvent.setup();
  const retry = vi.fn();
  const { rerender } = renderWithProviders(<DocumentViewer name="comprobante.pdf" mediaType="application/pdf" blob={new Blob(["%PDF"], { type: "application/pdf" })} />);
  expect(await screen.findByTitle("PDF comprobante.pdf")).toHaveAttribute("src", "blob:document");
  // A PDF zooms and turns in its own viewer: the toolbar only downloads it.
  expect(screen.queryByRole("button", { name: "Acercar" })).not.toBeInTheDocument();
  rerender(<DocumentViewer name="remito.docx" mediaType="application/vnd.openxmlformats-officedocument.wordprocessingml.document" blob={new Blob(["docx"])} />);
  expect(screen.getByText("Este archivo no se puede ver acá.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Descargar" })).toBeEnabled();
  rerender(<DocumentViewer name="foto.jpg" mediaType="image/jpeg" loading />);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando el documento…");
  expect(screen.getByRole("button", { name: "Descargar" })).toBeDisabled();
  rerender(<DocumentViewer name="foto.jpg" mediaType="image/jpeg" failed onRetry={retry} retryReason="Esperá 5 segundos para volver a intentar." />);
  expect(screen.getByText("No pudimos cargar el documento.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar" })).toHaveAttribute("aria-disabled", "true");
  rerender(<DocumentViewer name="foto.jpg" mediaType="image/jpeg" failed onRetry={retry} />);
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
