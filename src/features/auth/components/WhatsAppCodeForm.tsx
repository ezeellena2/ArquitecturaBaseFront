import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { z } from "zod";
import { requestWhatsAppLoginCode } from "../api/loginCode";
import { loginCodeErrorMessage, phoneFieldError } from "../errors";
import type { LoginCodeState } from "../lib/loginCodeState";
import { loginCodePathFor } from "../lib/returnUrl";
import type { CodeRequestFormProps } from "./EmailCodeForm";
import { PhoneField } from "./PhoneField";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";

// Acá solo se controla que haya algo escrito. Si es un celular, y de qué país, lo decide el servidor, que es el que
// conoce los formatos de cada uno (con o sin 0, 15 o 9).
const schema = z.object({ number: z.string().trim().min(1) });

type FormValues = z.infer<typeof schema>;

interface WhatsAppCodeFormProps extends CodeRequestFormProps {
  /// Los países a los que se mandan códigos (`whatsappCountries`), en el orden de la configuración: arranca en el
  /// primero.
  countries: readonly string[];
}

/// El pedido del código por WhatsApp, en `/login`. Tiene las mismas reglas que el del correo: se valida al enviar,
/// la respuesta es la misma exista o no la cuenta, y un 429 frena el botón con su cuenta regresiva.
export function WhatsAppCodeForm({ returnUrl, countries, notice, onSubmitStart }: WhatsAppCodeFormProps) {
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
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { number: "" } });

  async function onSubmit(values: FormValues) {
    setFormError(undefined);

    try {
      const response = await requestWhatsAppLoginCode({ country, number: values.number });
      const state: LoginCodeState = {
        channel: "whatsapp",
        phone: response.phone,
        maskedPhone: response.maskedPhone,
        resendAfterSeconds: response.resendAfterSeconds,
      };

      // Como con el correo: el número viaja en el estado de la ruta, no en la URL.
      void navigate(loginCodePathFor(returnUrl), { state });
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      const fieldError = phoneFieldError(caught, t);

      if (fieldError !== undefined) {
        setError("number", { type: "server", message: fieldError });

        return;
      }

      setFormError(loginCodeErrorMessage(caught, t));

      if (caught.retryAfterSeconds !== undefined) {
        restartRetry(caught.retryAfterSeconds);
      }
    }
  }

  // El del servidor trae su texto; el de la validación de acá es siempre el mismo.
  const numberError = errors.number
    ? errors.number.type === "server"
      ? errors.number.message
      : t("login.phoneInvalid")
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
      <PhoneField
        label={t("login.phoneLabel")}
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
        {isRetryLimited ? t("login.submitRetry", { seconds: retrySeconds }) : t("login.submit")}
      </Button>
    </form>
  );
}
