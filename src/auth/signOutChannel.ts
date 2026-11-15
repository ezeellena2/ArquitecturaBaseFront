/// Cerrar sesión cierra también las demás pestañas del mismo navegador (N12). Cada pestaña tiene su propia
/// autorización de OpenIddict y renueva con su propio refresh token, así que el cierre de una no saca a las otras:
/// la que cierra avisa por un BroadcastChannel y las que escuchan cierran la suya (`useSignOutFromOtherTabs`).
///
/// El canal no guarda nada: una pestaña que entra después no recibe un cierre viejo. Sin BroadcastChannel (un
/// navegador viejo, jsdom) no se avisa ni se escucha, y cada pestaña sigue con su sesión como antes.
const channelName = "arquitecturabase.sign-out";
const signedOut = "signed-out";

/// El canal que escucha esta pestaña. El aviso sale por este mismo porque un BroadcastChannel no se entrega a sí
/// mismo: la pestaña que cierra no se escucha.
let listening: BroadcastChannel | undefined;

/// Escucha el aviso hasta que se llama a lo que devuelve, que cierra el canal.
export function listenForSignOutElsewhere(onSignOut: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }

  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent) => {
    if (event.data === signedOut) {
      onSignOut();
    }
  };
  listening = channel;

  return () => {
    channel.close();

    if (listening === channel) {
      listening = undefined;
    }
  };
}

/// Avisa a las demás pestañas. Lo llama sólo el cierre explícito, después de que el servidor cerró la sesión;
/// la pestaña que recibe el aviso no lo repite.
export function announceSignOut(): void {
  listening?.postMessage(signedOut);
}
