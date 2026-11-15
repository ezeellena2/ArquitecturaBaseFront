import { useSyncExternalStore } from "react";

/// `useSignOut` holds this transition through server revocation, local cleanup and the committed /login route, also
/// when the sign-out comes from another tab.
/// HomeLayout keeps AppLayout mounted without the OIDC user, so guards cannot carry the previous account's URL.
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

/// Release after /login has committed, or after a failure to allow recovery.
export function cancelSignOut(): void {
  isSigningOut = false;
  notify();
}

/// Outside React: a notice from another tab must not start a second sign-out over one in progress.
export function isSignOutInProgress(): boolean {
  return isSigningOut;
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
