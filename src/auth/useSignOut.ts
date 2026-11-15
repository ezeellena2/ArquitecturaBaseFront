import { useEffect, useEffectEvent, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router";
import { waitForSessionRenewal } from "@/shared/api/httpClient";
import { endServerSession } from "./accessRequests";
import { announceSignOut, listenForSignOutElsewhere } from "./signOutChannel";
import { beginSignOut, cancelSignOut, isSignOutInProgress } from "./signOutStatus";

/// Otra pestaña avisó que cerró la sesión mientras esta cerraba la suya. Lo anota quien escucha y lo lee el cierre en
/// curso: si el suyo falla, esta pestaña cierra igual, de forma local.
let signedOutElsewhere = false;

/// Lo que sigue a la revocación, igual en las dos formas de cerrar: cancela y borra las consultas, deja los tokens
/// y confirma `/login` antes de soltar la transición, así los guards no guardan la pantalla de la cuenta anterior
/// como destino del próximo ingreso.
function useCloseLocally(): () => Promise<void> {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    // Una renovación en vuelo volvería a guardar el usuario después de borrarlo.
    await waitForSessionRenewal();
    await auth.removeUser();
    await navigate("/login", { replace: true, flushSync: true });
    cancelSignOut();
  };
}

/// «Cerrar sesión»: espera a que el servidor revoque la autorización de esta pestaña y borre la cookie, avisa a las
/// demás y cierra la sesión local. Si el servidor no la cerró, lanza, no avisa y la pestaña sigue adentro; salvo que
/// mientras tanto otra pestaña haya avisado su cierre: la cookie ya no está, y esta cierra igual, sin avisar.
export function useSignOut(): () => Promise<void> {
  const auth = useAuth();
  const closeLocally = useCloseLocally();

  return async () => {
    beginSignOut();
    signedOutElsewhere = false;

    try {
      await endServerSession(auth.user?.id_token);
      announceSignOut();
    } catch (error) {
      if (!signedOutElsewhere) {
        cancelSignOut();
        throw error;
      }
    }

    try {
      await closeLocally();
    } catch (error) {
      cancelSignOut();
      throw error;
    }
  };
}

/// Cierra esta pestaña cuando otra del mismo navegador cerró la sesión. La monta `SignOutFromOtherTabs`, la raíz de
/// todas las rutas, y el canal se cierra al desmontar.
///
/// Revoca su propia autorización con su `id_token_hint`, como el cierre explícito: la cookie ya la borró la otra
/// pestaña, pero su refresh token seguiría valiendo, y la revocación alcanza a todos los tokens de la autorización,
/// no sólo al que tiene en memoria. Si la revocación falla, igual cierra. No vuelve a avisar.
///
/// Sin sesión en memoria no hay nada que cerrar, salvo la que traiga una recuperación silenciosa en curso: esa se
/// cierra apenas llega el usuario, con su `id_token`. Si la recuperación termina sin sesión, no queda nada pendiente
/// para un ingreso posterior. Si esta pestaña ya estaba cerrando, sigue la suya y lo anota por si falla.
export function useSignOutFromOtherTabs(): void {
  const auth = useAuth();
  const closeLocally = useCloseLocally();
  const isRecovering = !auth.user && (auth.isLoading || auth.activeNavigator === "signinSilent");
  const closeWhenRecovered = useRef(false);

  const close = useEffectEvent(async () => {
    const user = auth.user;
    closeWhenRecovered.current = !user && isRecovering;

    if (isSignOutInProgress()) {
      signedOutElsewhere = true;
      return;
    }

    if (!user) {
      return;
    }

    beginSignOut();
    await endServerSession(user.id_token).catch(() => undefined);

    try {
      await closeLocally();
    } catch {
      cancelSignOut();
    }
  });

  useEffect(() => listenForSignOutElsewhere(() => void close()), []);

  useEffect(() => {
    if (closeWhenRecovered.current && !isRecovering) {
      void close();
    }
  }, [isRecovering]);
}
