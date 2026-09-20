import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { Input } from "@/shared/ui/input";

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}

/// Casilleros para el código de ingreso: avanzan solos, aceptan pegar y vuelven con Backspace.
export function OtpInput({ length, value, onChange, label, disabled }: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  function focusBox(index: number) {
    boxes.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const digit = event.target.value.replace(/\D/gu, "").slice(-1);

    if (!digit) {
      return;
    }

    const next = value.padEnd(index, " ").slice(0, index) + digit + value.slice(index + 1);
    onChange(next.trimEnd());
    focusBox(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index]?.trim()) {
      event.preventDefault();
      onChange(value.slice(0, Math.max(index - 1, 0)));
      focusBox(index - 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/gu, "").slice(0, length);

    if (!pasted) {
      return;
    }

    event.preventDefault();
    onChange(pasted);
    focusBox(pasted.length);
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {digits.map((digit, index) => (
        <Input
          // El índice es la identidad real de cada casillero.
          key={index}
          ref={(element: HTMLInputElement | null) => {
            boxes.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`${label} ${index + 1}`}
          value={digit.trim()}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className="size-12 text-center text-lg"
        />
      ))}
    </div>
  );
}
