import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "./OtpInput";

describe("OtpInput", () => {
  it("moves to the next box while typing and reports the code", async () => {
    const onChange = vi.fn();
    render(<OtpInput length={6} value="" onChange={onChange} label="Código" />);

    const boxes = screen.getAllByRole("textbox");
    await userEvent.type(boxes[0], "1");

    expect(onChange).toHaveBeenLastCalledWith("1");
    expect(boxes[1]).toHaveFocus();
  });

  it("fills every box when the code is pasted", async () => {
    const onChange = vi.fn();
    render(<OtpInput length={6} value="" onChange={onChange} label="Código" />);

    const boxes = screen.getAllByRole("textbox");
    boxes[0].focus();
    await userEvent.paste("482913");

    expect(onChange).toHaveBeenLastCalledWith("482913");
  });

  it("goes back with backspace on an empty box", async () => {
    const onChange = vi.fn();
    render(<OtpInput length={6} value="48" onChange={onChange} label="Código" />);

    const boxes = screen.getAllByRole("textbox");
    boxes[2].focus();
    await userEvent.keyboard("{Backspace}");

    expect(onChange).toHaveBeenLastCalledWith("4");
    expect(boxes[1]).toHaveFocus();
  });

  it("ignores anything that is not a digit", async () => {
    const onChange = vi.fn();
    render(<OtpInput length={6} value="" onChange={onChange} label="Código" />);

    await userEvent.type(screen.getAllByRole("textbox")[0], "a");

    expect(onChange).not.toHaveBeenCalled();
  });
});
