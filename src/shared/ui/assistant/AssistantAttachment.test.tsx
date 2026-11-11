import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../tooltip";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantAttach, AssistantFile } from "./AssistantAttachment";

const messages: ThreadMessageLike[] = [];
function Runtime({ children, onNew }: { children: ReactNode; onNew: () => Promise<void> }) {
  const runtime = useExternalStoreRuntime({ messages, convertMessage: (message: ThreadMessageLike) => message, onNew });
  return <TooltipProvider><AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider></TooltipProvider>;
}

function Clip({ onChoose, disabled = false }: { onChoose: (file: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <AssistantAttach label="Adjuntar una planilla" accept=".xlsx,.csv" inputRef={input} disabled={disabled} onChoose={onChoose} />;
}

const fileInput = () => document.querySelector<HTMLInputElement>("input[type=file]")!;

describe("AssistantAttach (IA4)", () => {
  it("opens the file picker for one file of the accepted types and hands the chosen file to its owner", async () => {
    const onChoose = vi.fn();
    render(<TooltipProvider><Clip onChoose={onChoose} /></TooltipProvider>);
    const input = fileInput();
    expect(input).toHaveAttribute("accept", ".xlsx,.csv");
    expect(input.multiple).toBe(false);
    const open = vi.spyOn(input, "click").mockImplementation(() => {});
    await userEvent.click(screen.getByRole("button", { name: "Adjuntar una planilla" }));
    expect(open).toHaveBeenCalledOnce();
    const file = new File(["Código,Cliente"], "clientes.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onChoose).toHaveBeenCalledWith(file);
    // The picker forgets the choice, so the same file can be chosen again after removing it.
    expect(input.value).toBe("");
  });

  it("keeps the clip off while the composer cannot send", () => {
    render(<TooltipProvider><Clip onChoose={() => {}} disabled /></TooltipProvider>);
    expect(screen.getByRole("button", { name: "Adjuntar una planilla" })).toBeDisabled();
  });
});

describe("AssistantFile", () => {
  it("shows the file in the composer with its name and what describes it, and removes it with the X", async () => {
    const onRemove = vi.fn();
    render(<TooltipProvider><AssistantFile name="clientes.xlsx" description="Excel · 24 KB" removeLabel="Quitar clientes.xlsx"
      onRemove={onRemove} /></TooltipProvider>);
    expect(screen.getByText("clientes.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Excel · 24 KB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar clientes.xlsx" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("cannot be removed while it travels", () => {
    render(<TooltipProvider><AssistantFile name="clientes.xlsx" description="Excel · 24 KB" removeLabel="Quitar clientes.xlsx"
      onRemove={() => {}} disabled /></TooltipProvider>);
    expect(screen.getByRole("button", { name: "Quitar clientes.xlsx" })).toBeDisabled();
  });

  it("hands its owner the clip and the X, to pass the focus from one to the other", () => {
    const clip = createRef<HTMLButtonElement>();
    const remove = createRef<HTMLButtonElement>();
    render(<TooltipProvider>
      <AssistantAttach label="Adjuntar una planilla" accept=".xlsx,.csv" inputRef={createRef()} buttonRef={clip} onChoose={() => {}} />
      <AssistantFile name="clientes.xlsx" description="Excel · 24 KB" removeLabel="Quitar clientes.xlsx" removeRef={remove}
        onRemove={() => {}} />
    </TooltipProvider>);
    expect(clip.current).toBe(screen.getByRole("button", { name: "Adjuntar una planilla" }));
    expect(remove.current).toBe(screen.getByRole("button", { name: "Quitar clientes.xlsx" }));
  });

  it("shows the file of a message without a way to remove it", () => {
    render(<AssistantFile name="clientes.xlsx" description="Excel · 86 filas · 24 KB" />);
    expect(screen.getByText("Excel · 86 filas · 24 KB")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("AssistantComposer with a file (IA4)", () => {
  it("puts the clip and the microphone left of the arrow, the file above the text, and sends it through its owner even without text", async () => {
    const onSendMedia = vi.fn();
    const onNew = vi.fn(async () => {});
    render(<Runtime onNew={onNew}><AssistantComposer label="Tu pregunta" hint="Ctrl+Enter envía." placeholder="Agregá un texto, si querés…"
      sendLabel="Enviar" value="" onValueChange={() => {}} disabled={false} attach={<Clip onChoose={() => {}} />}
      record={{ label: "Grabar un audio", onStart: () => {} }}
      attachment={<AssistantFile name="clientes.xlsx" description="Excel · 24 KB" removeLabel="Quitar clientes.xlsx" onRemove={() => {}} />}
      onSendMedia={onSendMedia} /></Runtime>);
    expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label")))
      .toEqual(["Quitar clientes.xlsx", "Adjuntar una planilla", "Grabar un audio", "Enviar"]);
    expect(screen.getByText("clientes.xlsx").compareDocumentPosition(screen.getByRole("textbox", { name: "Tu pregunta" })))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Tu pregunta" }), { key: "Enter", ctrlKey: true });
    expect(onSendMedia).toHaveBeenCalledTimes(2);
    expect(onNew).not.toHaveBeenCalled();
  });
});
