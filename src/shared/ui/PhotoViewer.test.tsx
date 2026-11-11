import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { expect, it } from "vitest";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { Button } from "./button";
import { PhotoViewer } from "./PhotoViewer";

function Viewer(props: Partial<ComponentProps<typeof PhotoViewer>>) {
  return <PhotoViewer title="Foto de la entrega" name="entrega.jpg" size="86 KB" index={0} count={3} loading={false}
    thumbnails={null} onIndex={() => undefined} onClose={() => undefined} onDownload={() => undefined} {...props} />;
}

// The file reads as its name and one grey line with what is known about it (lista de chequeo, 2026-11-11), not as three
// paragraphs. The consumer writes the date with the common formatter: the piece receives it as text and knows no feature.
it("shows the name of the photo and one grey line with its size and its date", async () => {
  const date = formatDateTimeInZone("2026-11-09T17:00:00Z", "es", "America/Argentina/Buenos_Aires");
  renderWithProviders(<Viewer date={date} />);

  const dialog = await screen.findByRole("dialog", { name: "Foto de la entrega" });
  expect(within(dialog).getByText("entrega.jpg")).toBeInTheDocument();
  expect(within(dialog).getByText("86 KB · 09/11/2026, 14:00")).toBeInTheDocument();
  expect(within(dialog).queryByText("86 KB")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("09/11/2026, 14:00")).not.toBeInTheDocument();
});

it("says only the size when no date comes with the photo", async () => {
  renderWithProviders(<Viewer />);

  const dialog = await screen.findByRole("dialog", { name: "Foto de la entrega" });
  expect(within(dialog).getByText("86 KB")).toBeInTheDocument();
  expect(within(dialog).queryByText(/·\s*$/)).not.toBeInTheDocument();
});

it("moves with the arrows, closes with Escape and gives the focus back to what opened it", async () => {
  const moves: number[] = [];
  function Gallery() {
    const [index, setIndex] = useState<number | null>(null);
    return <>
      <Button type="button" onClick={() => setIndex(0)}>Ver fotos</Button>
      {index === null ? null : <Viewer index={index} onIndex={next => { moves.push(next); setIndex(next); }} onClose={() => setIndex(null)} />}
    </>;
  }
  renderWithProviders(<Gallery />);
  await userEvent.click(await screen.findByRole("button", { name: "Ver fotos" }));
  const dialog = await screen.findByRole("dialog", { name: "Foto de la entrega" });
  expect(dialog).toHaveAccessibleDescription("Foto 1 de 3");

  // The first photo has none before it.
  dialog.focus();
  await userEvent.keyboard("{ArrowLeft}");
  expect(moves).toEqual([]);
  await userEvent.keyboard("{ArrowRight}");
  expect(moves).toEqual([1]);
  expect(dialog).toHaveAccessibleDescription("Foto 2 de 3");
  dialog.focus();
  await userEvent.keyboard("{ArrowLeft}");
  expect(moves).toEqual([1, 0]);
  await userEvent.click(within(dialog).getByRole("button", { name: "Foto siguiente" }));
  expect(moves).toEqual([1, 0, 1]);

  dialog.focus();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("button", { name: "Ver fotos" })).toHaveFocus());
});
