import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "./FormField";
import { Input } from "./input";
import { Picker } from "./Picker";
import { countryDescription, countryOptionLabel } from "@/shared/lib/countries";

/// Lo que se le puede pasar al campo del número: lo de `register` de react-hook-form (name, ref, onChange, onBlur)
/// y poco más. El tipo, el autocompletado y los atributos de accesibilidad los pone este componente.
type NumberInputProps = Omit<ComponentProps<"input">, "id" | "type" | "autoComplete" | "aria-invalid" | "aria-describedby">;

interface PhoneFieldProps extends NumberInputProps {
  label: string;
  /// Opcional: en el ingreso dice por dónde llega el código; en el diálogo del perfil eso ya lo dice la descripción.
  hint?: string;
  /// Reemplaza a la ayuda en el mismo renglón, como en cualquier `FormField`.
  error?: string;
  /// Los países a los que se mandan códigos (`whatsappCountries` de `login-methods`), en ISO 3166-1 alfa-2.
  countries: readonly string[];
  country: string;
  onCountryChange: (country: string) => void;
}

/// Un número de celular: el país a la izquierda y el número a la derecha, con la etiqueta, la ayuda y el error de
/// `FormField`. El país solo dice cómo leer el número; el que lo interpreta es el servidor.
///
/// Lo usan el ingreso con WhatsApp (`/login`) y el perfil, al vincular el número: por eso vive acá y no en una feature.
export function PhoneField({ label, hint, error, countries, country, onCountryChange, ...numberProps }: PhoneFieldProps) {
  return (
    <FormField label={label} hint={hint} error={error}>
      <PhoneInputs countries={countries} country={country} onCountryChange={onCountryChange} numberProps={numberProps} />
    </FormField>
  );
}

interface PhoneInputsProps {
  // Los tres que `FormField` le enchufa a su hijo.
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  countries: readonly string[];
  country: string;
  onCountryChange: (country: string) => void;
  numberProps: NumberInputProps;
}

/// `FormField` le pone el id, `aria-invalid` y `aria-describedby` a su único hijo. Acá los recibe el envoltorio y se
/// los pasa al número, que es el campo que nombra la etiqueta y el que se marca con el error. El país se nombra
/// solo, con el país completo ("País Argentina, +54"): "AR +54" no le dice mucho a un lector de pantalla.
function PhoneInputs({
  id,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  countries,
  country,
  onCountryChange,
  numberProps,
}: PhoneInputsProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex gap-2">
      {/* The only piece to choose (DS1-A) with a narrow trigger: it says "AR +54", and each country of the list goes by its
          whole name. */}
      <Picker
        label={t("phone.country")}
        className="w-28 shrink-0"
        options={countries.map((option) => ({
          id: option,
          label: countryDescription(option, i18n.language),
          short: countryOptionLabel(option),
        }))}
        value={country}
        onChange={onCountryChange}
      />
      <Input
        {...numberProps}
        id={id}
        type="tel"
        // Sin el prefijo del país: ese lo pone el desplegable de al lado.
        autoComplete="tel-national"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    </div>
  );
}
