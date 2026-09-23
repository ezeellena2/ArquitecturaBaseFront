import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { z } from "zod";
import { requestLoginCode } from "../api/loginCode";
import { loginCodeErrorMessage } from "../errors";
import type { LoginCodeState } from "../lib/loginCodeState";
import { loginCodePathFor } from "../lib/returnUrl";
import { ApiError } from "@/shared/api/ApiError";
import { applyApiErrorToForm } from "@/shared/api/formErrors";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";

const schema = z.object({ email: z.email() });

type FormValues = z.infer<typeof schema>;

export interface CodeRequestFormProps {
  /// Ya validado por `authorizeReturnUrl`: viaja tal cual a `/login/codigo`.
  returnUrl: string;
  /// Un mensaje que llegó de afuera del formulario (por qué falló el ingreso con Google). Va en el mismo renglón
  /// que los errores del pedido, arriba del botón.
  notice?: string;
  /// Se llama al enviar, antes de validar: desde ahí, el mensaje de afuera ya no describe lo que está pasando.
  onSubmitStart: () => void;
}

/// El pedido del código por correo, en `/login`.
export function EmailCodeForm({ returnUrl, notice, onSubmitStart }: CodeRequestFormProps) {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | undefined>();
  const { seconds: retrySeconds, isRunning: isRetryLimited, restart: restartRetry } = useCountdown(0);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function setFieldError(field: string, error: { type: string; message: string }) {
    // El backend responde nombres de campo en camelCase, que acá son las claves de FormValues.
    setError(field as Path<FormValues>, error);
  }

  async function onSubmit(values: FormValues) {
    setFormError(undefined);

    try {
      const response = await requestLoginCode(values.email);
      const state: LoginCodeState = {
        channel: "email",
        email: values.email,
        resendAfterSeconds: response.resendAfterSeconds,
      };

      // Navegación del router, no del navegador: el código nunca pasa por acá, y el email viaja en el
      // estado de la ruta, no en la URL.
      void navigate(loginCodePathFor(returnUrl), { state });
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      if (applyApiErrorToForm(caught, setFieldError)) {
        return;
      }

      setFormError(loginCodeErrorMessage(caught, t));

      if (caught.retryAfterSeconds !== undefined) {
        restartRetry(caught.retryAfterSeconds);
      }
    }
  }

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
      <FormField label={t("login.emailLabel")} error={errors.email ? t("login.emailInvalid") : undefined}>
        <Input type="email" autoComplete="email" {...register("email")} />
      </FormField>

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
