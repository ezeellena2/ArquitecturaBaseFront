import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { Link } from "react-router";
import { getLoginMethods, loginMethodsQueryKey } from "../api/loginCode";
import { loginLinkPreviewQueryKey, previewLoginLink, redeemLoginLink, type LoginLinkPreview } from "../api/loginLink";
import { loginCodeErrorMessage, loginLinkFailureOf, type LoginLinkFailure } from "../errors";
import { loginLinkTokenFromAddress, removeFragmentFromAddress } from "../lib/loginLinkToken";
import { initialOf } from "@/auth/accountName";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { BanIcon, ClockIcon } from "@/shared/ui/icons";
import { Spinner } from "@/shared/ui/Spinner";

/// Firma mínima de `t` (la del namespace "auth"), como en `errors.ts`.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// Los pedidos del enlace fallan con `ApiError`; cualquier otra cosa es un bug, y se trata como un error que pasa.
function failureOf(error: Error): LoginLinkFailure {
  return error instanceof ApiError ? loginLinkFailureOf(error) : "retry";
}

function retryMessageOf(error: Error, t: Translate): string {
  return error instanceof ApiError ? loginCodeErrorMessage(error, t) : t("errors.generic");
}

/// Los botones de esta pantalla miden 44 px y no los 36 del resto del ingreso: el enlace se abre casi siempre en el
/// celular, donde es el mínimo de un objetivo táctil (tablero "WhatsApp · El enlace del chat").
const touchButtonClassName = "h-11 w-full";

/// Un ref que enfoca el elemento apenas se monta. Es una función fija, así React la llama al montar y al desmontar, y
/// no en cada render.
function focusOnMount(element: HTMLElement | null) {
  element?.focus();
}

/// El título de cada pantallazo. Continuar y Reintentar reemplazan la pantalla entera, y el botón que tenía el foco se
/// va con ella: el foco caería en `<body>` y el lector de pantalla no diría nada del estado nuevo (ni la cuenta ni
/// "Este enlace ya no sirve" tienen región viva). Por eso, cuando el estado llega por algo que tocó la persona, el
/// título recibe el foco: se lee dónde quedó, y el Tab sigue desde ahí. Al abrir la página no se mueve nada.
function StateTitle({ takesFocus, className, children }: { takesFocus: boolean; className: string; children: ReactNode }) {
  return (
    <h1 ref={takesFocus ? focusOnMount : undefined} tabIndex={-1} className={cn("outline-none", className)}>
      {children}
    </h1>
  );
}

/// "Ir al ingreso": `/login` sin `returnUrl` arranca el OIDC de siempre.
function GoToLogin() {
  const { t } = useTranslation("auth");

  return (
    <Button asChild variant="outline" className={touchButtonClassName}>
      <Link to="/login">{t("link.goToLogin")}</Link>
    </Button>
  );
}

/// El ícono redondo arriba del título de los pantallazos que cortan el ingreso.
function StateIcon({ tone, children }: { tone: "muted" | "danger"; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 items-center justify-center self-center rounded-full",
        tone === "danger"
          ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
          : "bg-[var(--color-surface-muted)] text-[var(--color-content-muted)]",
      )}
    >
      {children}
    </span>
  );
}

/// "Vas a entrar como", con la tarjeta de la cuenta: se ve a qué cuenta se entra antes de entrar.
function AccountToEnter({ preview }: { preview: LoginLinkPreview }) {
  const { t } = useTranslation("auth");
  const labelId = useId();
  // Sin nombre (una cuenta creada desde WhatsApp), el número va en su lugar, una sola vez.
  const name = preview.displayName ?? preview.maskedPhone ?? "";
  const detail = preview.displayName === null ? null : preview.maskedPhone;

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-center text-[12.5px] text-[var(--color-content-muted)]">
        {t("link.signingInAs")}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-sm font-semibold text-white"
        >
          {initialOf(name)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          {/* Es lo que dice a qué cuenta se entra, y puede ser un correo largo (a una cuenta sin nombre el servidor le
              pone el correo): si no entra en un renglón, sigue en el otro, entero, dominio incluido. Cuando en su
              lugar va el número, entero en un renglón, como abajo. */}
          <span
            className={cn(
              "text-sm font-semibold text-[var(--color-content)]",
              preview.displayName === null ? "whitespace-nowrap" : "wrap-anywhere",
            )}
          >
            {name}
          </span>
          {/* Entero en un renglón: partido, "•••• 6789" no se lee como parte del mismo número. */}
          {detail === null ? null : (
            <span className="text-[13px] whitespace-nowrap text-[var(--color-content-muted)]">{detail}</span>
          )}
        </span>
      </div>
    </div>
  );
}

/// Pantallazo 2. Los mismos textos que `/auth/callback`, que es lo que viene después: el ingreso se ve como un solo
/// paso. La región entera es el estado, así que el aro no se anuncia aparte. Solo se llega tocando Continuar, así que
/// el título siempre recibe el foco: una región viva que entra al DOM ya llena no siempre se anuncia.
function SigningIn() {
  const { t } = useTranslation("auth");

  return (
    <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
      <Spinner decorative />
      <StateTitle takesFocus className="text-lg font-semibold text-[var(--color-content)]">
        {t("callback.title")}
      </StateTitle>
      <p className="text-[12.5px] text-[var(--color-content-muted)]">{t("callback.hint")}</p>
    </div>
  );
}

/// El número del bot, según `GET /account/login-methods`: `pending` mientras no respondió.
type ChatToGoBackTo = { status: "pending" } | { status: "settled"; whatsappNumber: string | null };

/// Pantallazo 3. Vencido, usado, invalidado, inventado, sin token o con uno roto: todos dicen lo mismo.
function LinkNoLongerValid({ chat, takesFocus }: { chat: ChatToGoBackTo; takesFocus: boolean }) {
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col gap-5">
      <StateIcon tone="muted">
        <ClockIcon className="size-5.5" />
      </StateIcon>
      <div className="flex flex-col gap-1.5 text-center">
        <StateTitle takesFocus={takesFocus} className="text-xl font-semibold text-[var(--color-content)]">
          {t("link.invalid.title")}
        </StateTitle>
        <p className="text-sm text-[var(--color-content-muted)]">{t("link.invalid.description")}</p>
      </div>
      {/* Los botones esperan a saber si hay chat al que volver. "Volver a WhatsApp" va arriba: si apareciera después,
          correría "Ir al ingreso" justo cuando la persona lo está por tocar. Mientras tanto, el aro ocupa el lugar
          de un botón, el que se muestra siempre. */}
      {chat.status === "pending" ? (
        <div className="flex h-11 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Sin el número del bot (WhatsApp apagado, o `login-methods` no respondió) no hay chat al que volver. */}
          {chat.whatsappNumber ? (
            <Button asChild className={touchButtonClassName}>
              <a href={`https://wa.me/${chat.whatsappNumber}`}>{t("link.invalid.backToWhatsApp")}</a>
            </Button>
          ) : null}
          <GoToLogin />
        </div>
      )}
    </div>
  );
}

/// Pantallazo 4. El enlace era bueno, pero la cuenta no puede entrar (deshabilitada o bloqueada). Solo se sabe
/// después de Continuar, así que el título siempre recibe el foco.
function CannotSignIn({ message }: { message: string }) {
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col gap-5">
      <StateIcon tone="danger">
        <BanIcon className="size-5.5" />
      </StateIcon>
      <div className="flex flex-col gap-1.5 text-center">
        <StateTitle takesFocus className="text-xl font-semibold text-[var(--color-content)]">
          {t("link.closed.title")}
        </StateTitle>
        <p role="alert" className="text-sm text-[var(--color-content-muted)]">
          {message}
        </p>
      </div>
      <GoToLogin />
    </div>
  );
}

/// El canje salió bien, pero el OIDC no pudo arrancar (por ejemplo, no se pudo leer el discovery). La cookie ya está:
/// desde `/login`, el ingreso entra sin pedir nada. No tiene título, así que el foco va al mensaje, que es lo que
/// reemplaza a "Iniciando sesión…".
function RedirectFailed() {
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col gap-5">
      <p
        ref={focusOnMount}
        role="alert"
        tabIndex={-1}
        className="text-center text-sm text-[var(--color-danger)] outline-none"
      >
        {t("callback.error")}
      </p>
      <GoToLogin />
    </div>
  );
}

/// El enlace con el que trabaja la pantalla, y cuántos llegaron antes a la misma pestaña.
type OpenedLink = { token: string | undefined; generation: number };

/// `/ingresar` (sección 11 del spec del ingreso con WhatsApp): la entrada con el enlace que manda el bot al chat.
///
/// Abrir el enlace no abre la sesión. La pantalla pide la vista previa (a qué cuenta se entra) y espera a que la
/// persona toque Continuar: WhatsApp y algunos antivirus abren los enlaces para armar la vista previa, y si eso los
/// gastara, a la persona le quedaría uno que ya no sirve. Continuar canjea el enlace (el servidor deja la cookie) y
/// sigue con el `signinRedirect` de siempre: `/connect/authorize` encuentra la cookie y emite el código.
export function LoginLinkPage() {
  // Se lee en el inicializador, durante el primer render, y no en el efecto que lo saca de la barra: en desarrollo,
  // StrictMode corre los efectos dos veces, y el segundo ya no lo encontraría. El inicializador corre antes que
  // cualquier efecto, y el estado sobrevive al segundo montaje. Desde acá, el token vive solo en memoria.
  const [link, setLink] = useState<OpenedLink>(() => ({ token: loginLinkTokenFromAddress(), generation: 0 }));

  useEffect(() => {
    removeFragmentFromAddress();

    // Otro enlace abierto en esta misma pestaña (pegado en la barra, o porque el navegador la reusa) cambia solo el
    // fragmento: el navegador no recarga la página, y la pantalla seguiría con el enlace de antes, que el nuevo
    // invalidó, y con el token nuevo a la vista en la barra. `hashchange` es el aviso: se lee el token, se saca de la
    // barra y la pantalla arranca de cero con él. Un fragmento sin token no es un enlace, y no se toca.
    function handleHashChange() {
      const token = loginLinkTokenFromAddress();

      if (token === undefined) {
        return;
      }

      removeFragmentFromAddress();
      setLink((current) => ({ token, generation: current.generation + 1 }));
    }

    globalThis.addEventListener("hashchange", handleHashChange);

    return () => globalThis.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Con cada enlace nuevo, otra `key`: nada del anterior (un canje a medias, un error, una espera) pasa al nuevo.
  return <LoginLinkFlow key={link.generation} token={link.token} />;
}

/// Lo que pasa con un enlace, desde la vista previa hasta el `signinRedirect`.
function LoginLinkFlow({ token }: { token: string | undefined }) {
  const { t } = useTranslation("auth");
  const auth = useAuth();

  // Un doble toque dispara el segundo clic antes de que la pantalla se entere de que el canje salió (TanStack Query
  // avisa en el tick siguiente), y el segundo canje encontraría el enlace ya gastado. Esta marca lo frena en el acto.
  const isRedeemingRef = useRef(false);
  // El canje salió: desde acá, el enlace ya está gastado.
  const hasRedeemedRef = useRef(false);
  // El `signinRedirect` terminó y la página sigue acá (ver `handleContinue`).
  const [hasRedirectFailed, setHasRedirectFailed] = useState(false);
  // El navegador trajo la página de vuelta de su caché (bfcache) con el enlace ya canjeado.
  const [wasRestoredAfterRedeem, setWasRestoredAfterRedeem] = useState(false);
  // La persona tocó Reintentar: lo que venga después llega por ella, como lo que llega por Continuar.
  const [hasRetriedPreview, setHasRetriedPreview] = useState(false);
  const { seconds: retrySeconds, isRunning: isRetryLimited, restart: restartRetry } = useCountdown(0);

  // Después de entrar, Atrás puede traer esta página de la caché del navegador tal como quedó: en "Iniciando
  // sesión…", con el enlace ya gastado. `pageshow` con `persisted` es el aviso de que volvió así. Solo cuenta después
  // del canje: si la persona se fue antes de tocar Continuar y volvió con Atrás, el enlace todavía sirve.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted && hasRedeemedRef.current) {
        setWasRestoredAfterRedeem(true);
      }
    }

    globalThis.addEventListener("pageshow", handlePageShow);

    return () => globalThis.removeEventListener("pageshow", handlePageShow);
  }, []);

  /// Con el límite de pedidos (el de la vista previa y el canje es el mismo), el servidor dice cuánto esperar: hasta
  /// entonces, reintentar solo trae otro 429.
  function waitIfLimited(error: unknown) {
    if (error instanceof ApiError && error.retryAfterSeconds !== undefined) {
      restartRetry(error.retryAfterSeconds);
    }
  }

  const preview = useQuery({
    queryKey: loginLinkPreviewQueryKey(token ?? ""),
    queryFn:
      token === undefined
        ? skipToken
        : () =>
            // Una consulta no tiene `onError`: la espera arranca acá, cuando llega la respuesta, y no en un efecto.
            previewLoginLink(token).catch((error: unknown) => {
              waitIfLimited(error);
              throw error;
            }),
    // Una vez, sin reintentos solos ni al volver a la pestaña: después del canje el enlace ya no sirve, y una vista
    // previa repetida diría eso mientras la persona está entrando. Volver a pedirla lo decide la persona.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Los errores los muestra la pantalla, no un aviso.
    meta: { silent: true },
  });

  // Solo hace falta si el enlace no sirve ("Volver a WhatsApp"), pero se pide de entrada, en paralelo con la vista
  // previa, para que la respuesta suela estar cuando hace falta. Si todavía no está, el pantallazo 3 espera a tenerla
  // antes de dibujar sus botones. Si falla, no hay botón, y queda "Ir al ingreso".
  const methods = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    meta: { silent: true },
  });
  const chat: ChatToGoBackTo = methods.isPending
    ? { status: "pending" }
    : { status: "settled", whatsappNumber: methods.data?.whatsappNumber ?? null };

  const redeem = useMutation({ mutationFn: redeemLoginLink });
  // Continuar o Reintentar ya se tocaron: el estado que se muestra llegó por la persona, no al abrir la página, y se
  // lleva el foco.
  const cameFromAnAction = !redeem.isIdle || hasRetriedPreview;

  function handleContinue(currentToken: string) {
    if (isRedeemingRef.current) {
      return;
    }

    isRedeemingRef.current = true;

    // En el `mutate` y no en `useMutation`: si la persona se fue de la pantalla mientras tanto, no se la trae de vuelta.
    redeem.mutate(currentToken, {
      onSuccess: () => {
        hasRedeemedRef.current = true;
        // Si el redirect sale, el navegador se va y esta promesa no termina nunca. Que termine quiere decir que la
        // página sigue acá: react-oidc-context no rechaza cuando el OIDC no puede arrancar (deja el error en su estado
        // y resuelve), y oidc-client-ts resuelve cuando el navegador trae la página de vuelta de su caché. En ninguno
        // de los dos casos "Iniciando sesión…" sigue siendo cierto.
        const stayedHere = () => setHasRedirectFailed(true);
        void auth.signinRedirect({ state: { returnTo: "/" } }).then(stayedHere, stayedHere);
      },
      onError: (error) => {
        isRedeemingRef.current = false;
        waitIfLimited(error);
      },
    });
  }

  if (token === undefined) {
    return <LinkNoLongerValid chat={chat} takesFocus={false} />;
  }

  // Atrás después de entrar: el enlace ya se canjeó. Es lo mismo que diría la página recargada, que ya no tiene el
  // token, y "Ir al ingreso" entra sin pedir nada porque la cookie ya está.
  if (redeem.isSuccess && wasRestoredAfterRedeem) {
    return <LinkNoLongerValid chat={chat} takesFocus />;
  }

  if (hasRedirectFailed) {
    return <RedirectFailed />;
  }

  // Desde que se tocó Continuar hasta que el navegador se va a `/connect/authorize`.
  if (redeem.isPending || redeem.isSuccess) {
    return <SigningIn />;
  }

  // El canje manda sobre la vista previa: es lo último que dijo el servidor.
  const failedWith = redeem.error ?? preview.error;
  const failure = failedWith === null ? undefined : failureOf(failedWith);

  if (failure === "invalid") {
    return <LinkNoLongerValid chat={chat} takesFocus={cameFromAnAction} />;
  }

  if (failure === "disabled" || failure === "lockedOut") {
    return <CannotSignIn message={failure === "disabled" ? t("login.errors.disabled") : t("login.errors.lockedOut")} />;
  }

  if (preview.isPending) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const title = t("link.title", { name: t("common:app.name") });

  // La vista previa no llegó (la red, el límite de pedidos, un error inesperado): no hay cuenta que mostrar, así que
  // se ofrece volver a pedirla; con el límite de pedidos, recién cuando termina la espera que dijo el servidor. Al
  // abrir la página el foco no se mueve; después de Reintentar, sí.
  //
  // Cada pantallazo va con su `key`, y la de este cambia con cada error: lo que llega después de Reintentar (la cuenta,
  // otro error) se monta de nuevo, así el título se lleva el foco y el aviso se vuelve a anunciar. Sin eso, dependería
  // de que entre medio se haya dibujado la carga.
  if (preview.isError) {
    return (
      <div key={`preview-failed-${preview.errorUpdatedAt}`} className="flex flex-col gap-5">
        <StateTitle
          takesFocus={cameFromAnAction}
          className="text-center text-xl font-semibold text-[var(--color-content)]"
        >
          {title}
        </StateTitle>
        <p role="alert" className="text-center text-sm text-[var(--color-danger)]">
          {retryMessageOf(preview.error, t)}
        </p>
        <Button
          type="button"
          className={touchButtonClassName}
          disabled={preview.isFetching || isRetryLimited}
          onClick={() => {
            setHasRetriedPreview(true);
            void preview.refetch();
          }}
        >
          {isRetryLimited ? t("login.submitRetry", { seconds: retrySeconds }) : t("common:actions.retry")}
        </Button>
      </div>
    );
  }

  // Pantallazo 1. Un canje que falló por algo que pasa deja la cuenta a la vista y Continuar para reintentar; con el
  // límite de pedidos, recién cuando termina la espera que dijo el servidor.
  return (
    <div key="account" className="flex flex-col gap-5">
      <StateTitle
        takesFocus={cameFromAnAction}
        className="text-center text-xl font-semibold text-[var(--color-content)]"
      >
        {title}
      </StateTitle>
      <AccountToEnter preview={preview.data} />
      {redeem.error === null ? null : (
        <p role="alert" className="text-center text-sm text-[var(--color-danger)]">
          {retryMessageOf(redeem.error, t)}
        </p>
      )}
      <Button
        type="button"
        className={touchButtonClassName}
        disabled={isRetryLimited}
        onClick={() => handleContinue(token)}
      >
        {isRetryLimited ? t("login.submitRetry", { seconds: retrySeconds }) : t("link.continue")}
      </Button>
      <p className="text-center text-[12.5px] text-[var(--color-content-muted)]">{t("link.notYou")}</p>
    </div>
  );
}
