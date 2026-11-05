import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../tooltip";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantRecorder } from "./AssistantRecorder";

const messages: ThreadMessageLike[] = [];
function Runtime({ children, onNew }: { children: ReactNode; onNew: () => Promise<void> }) {
  const runtime = useExternalStoreRuntime({ messages, convertMessage: (message: ThreadMessageLike) => message, onNew });
  return <TooltipProvider><AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider></TooltipProvider>;
}

function composer(props: Partial<Parameters<typeof AssistantComposer>[0]> = {}) {
  const onNew = vi.fn(async () => {});
  render(<Runtime onNew={onNew}><AssistantComposer label="Tu pregunta" hint="Ctrl+Enter envía." placeholder="Preguntale al sistema…"
    sendLabel="Enviar" value="" onValueChange={() => {}} disabled={false} {...props} /></Runtime>);
  return onNew;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:recording");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("AssistantComposer with a recording (IA4)", () => {
  it("offers the microphone left of the arrow only when its owner takes a recording", async () => {
    const onStart = vi.fn();
    composer({ record: { label: "Grabar un audio", onStart } });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map(button => button.getAttribute("aria-label"))).toEqual(["Grabar un audio", "Enviar"]);
    await userEvent.click(buttons[0]);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("sends a ready recording with the arrow or Ctrl+Enter, even without text, and not through the text runtime", async () => {
    const onSendRecording = vi.fn();
    const onNew = composer({ onSendRecording, value: "" });
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(send).toBeEnabled();
    await userEvent.click(send);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Tu pregunta" }), { key: "Enter", ctrlKey: true });
    expect(onSendRecording).toHaveBeenCalledTimes(2);
    expect(onNew).not.toHaveBeenCalled();
  });

  it("keeps the text send off without text when there is no recording", () => {
    composer();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });
});

describe("AssistantRecorder", () => {
  it("shows the time with Discard and Stop while recording, with the focus on Stop", async () => {
    const onStop = vi.fn();
    const onDiscard = vi.fn();
    render(<AssistantRecorder status="Grabando · 0:12" audioLabel="Tu audio" discardLabel="Descartar" stopLabel="Detener"
      onStop={onStop} onDiscard={onDiscard} />);
    expect(screen.getByRole("timer")).toHaveTextContent("Grabando · 0:12");
    expect(screen.getByRole("button", { name: "Detener" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Detener" }));
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("lets the person listen to the stopped recording, and not discard it while it travels", () => {
    render(<AssistantRecorder recording={new Blob(["webm"], { type: "audio/webm" })} status="Grabando · 0:12" audioLabel="Tu audio"
      discardLabel="Descartar" stopLabel="Detener" onStop={() => {}} onDiscard={() => {}} disabled />);
    expect(screen.getByLabelText("Tu audio").tagName).toBe("AUDIO");
    expect(screen.getByLabelText("Tu audio")).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Detener" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  });
});
