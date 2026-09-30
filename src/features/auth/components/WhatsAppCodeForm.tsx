import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { z } from "zod";
import { requestWhatsAppLoginCode } from "../api/loginCode";
import type { LoginCodeState } from "../lib/loginCodeState";
import { loginCodePathFor } from "../lib/returnUrl";
import type { CodeRequestFormProps } from "./EmailCodeForm";
import { ApiError } from "@/shared/api/ApiError";
import { codeRequestErrorMessage, phoneFieldError } from "@/shared/api/codeErrors";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { PhoneField } from "@/shared/ui/PhoneField";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";

// Acá solo se controla que haya algo escrito. Si es un celular, y de qué país, lo decide el servidor, que es el que
// conoce los formatos de cada uno (con o sin 0, 15 o 9).
const schema = z.object({ number: z.string().trim().min(1), displayName: z.string().trim().max(100).optional() });

type FormValues = z.infer<typeof schema>;

interface WhatsAppCodeFormProps extends CodeRequestFormProps {
  /// Los países a los que se mandan códigos (`whatsappCountries`), en el orden de la configuración: arranca en el
  /// primero.
  countries: readonly string[];
}

/// El pedido del código por WhatsApp, en `/login`. Tiene las mismas reglas que el del correo: se valida al enviar,
/// la respuesta es la misma exista o no la cuenta, y un 429 frena el botón con su cuenta regresiva.
export function WhatsAppCodeForm({ returnUrl, countries, notice, onSubmitStart, registration = false, displayName, onDisplayNameChange }: WhatsAppCodeFormProps) {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [country, setCountry] = useState(countries[0] ?? "");
  const [formError, setFormError] = useState<string | undefined>();
  const { seconds: retrySeconds, isRunning: isRetryLimited, restart: restartRetry } = useCountdown(0);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(registration ? schema.extend({ displayName: z.string().trim().min(1).max(100) }) : schema), defaultValues: { number: "", displayName } });

  async function onSubmit(values: FormValues) {
    setFormError(undefined);

    try {
      const response = await requestWhatsAppLoginCode({ country, number: values.number });
      const state: LoginCodeState = {
        channel: "whatsapp",
        register: registration,
        ...(registration ? { displayName: values.displayName } : {}),
        phone: response.phone,
        maskedPhone: response.maskedPhone,
        resendAfterSeconds: response.resendAfterSeconds,
      };

      // Como con el correo: el número viaja en el estado de la ruta, no en la URL.
      void navigate(loginCodePathFor(returnUrl, registration), { state });
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      const fieldError = phoneFieldError(caught, t);

      if (fieldError !== undefined) {
        setError("number", { type: "server", message: fieldError });

        return;
      }

      setFormError(codeRequestErrorMessage(caught, t));

      if (caught.retryAfterSeconds !== undefined) {
        restartRetry(caught.retryAfterSeconds);
      }
    }
  }

  // El del servidor trae su texto; el de la validación de acá es siempre el mismo.
  const numberError = errors.number
    ? errors.number.type === "server"
      ? errors.number.message
      : t("common:phone.invalid")
    : undefined;
  const message = formError ?? notice;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        onSubmitStart();
        void handleSubmit(onSubmit)(event);
      }}
    >
      {registration ? <FormField label={t("registration.name")} error={errors.displayName ? t("registration.nameInvalid") : undefined}>
        <Input autoComplete="name" maxLength={100} {...register("displayName", { onChange: (event) => onDisplayNameChange?.(event.target.value) })} />
      </FormField> : null}
      <PhoneField
        label={t("common:phone.label")}
        hint={t("login.phoneHint")}
        error={numberError}
        countries={countries}
        country={country}
        onCountryChange={setCountry}
        {...register("number")}
      />

      {message ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting || isRetryLimited}>
        {isRetryLimited ? t("common:code.retryIn", { seconds: retrySeconds }) : t("common:code.send")}
      </Button>
    </form>
  );
}
