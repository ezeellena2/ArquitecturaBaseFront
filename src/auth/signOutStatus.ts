import { useSyncExternalStore } from "react";

/// Si se está cerrando la sesión: lo dispara UserMenu, pero lo necesita AppLayout para no dibujar el layout
/// con los datos ya vacíos entre que signoutRedirect limpia la sesión en memoria y navega a /connect/logout.
/// Un store module-level con useSyncExternalStore, en vez de un contexto, para no sumar un provider nuevo a
/// providers.tsx: es el mismo patrón que ya usa AuthProvider para publicar la sesión al cliente HTTP.
let isSigningOut = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function beginSignOut(): void {
  isSigningOut = true;
  notify();
}

/// Si signoutRedirect falla, hay que volver atrás: si no, la pantalla queda trabada en el spinner.
export function cancelSignOut(): void {
  isSigningOut = false;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return isSigningOut;
}

export function useIsSigningOut(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
