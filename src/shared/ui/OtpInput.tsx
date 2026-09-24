import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { Input } from "./input";

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  /// El código que se verificó no era el correcto: todas las casillas quedan marcadas hasta que se escriba otro.
  invalid?: boolean;
  /// La primera casilla toma el foco al aparecer: en el diálogo del perfil, el código reemplaza al campo en el que se
  /// estaba escribiendo, y sin esto el foco se pierde con él.
  autoFocus?: boolean;
  /// Lo que describe al código entero (a dónde se mandó, cuándo vence), para el grupo de casillas. Hace falta cuando
  /// el foco llega directo a una casilla sin pasar por ese texto, como en el diálogo del perfil.
  "aria-describedby"?: string;
}

/// Casilleros para un código de un solo uso: avanzan solos, aceptan pegar y vuelven con Backspace. Los usan el ingreso
/// (`/login/codigo`) y el perfil, al comprobar un número o un correo.
export function OtpInput({
  length,
  value,
  onChange,
  label,
  disabled,
  invalid,
  autoFocus,
  "aria-describedby": describedBy,
}: OtpInputProps) {
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
    <div role="group" aria-label={label} aria-describedby={describedBy} className="flex justify-center gap-2">
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
          autoFocus={index === 0 ? autoFocus : undefined}
          maxLength={1}
          disabled={disabled}
          aria-label={`${label} ${index + 1}`}
          aria-invalid={invalid ? true : undefined}
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
