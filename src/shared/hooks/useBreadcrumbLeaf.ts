import { useEffect, useSyncExternalStore } from "react";

/// El último nivel de las migas en una ruta hija, como el nombre de un rol en `/roles/abc`. Lo sabe solo la
/// pantalla, que es la que pide el rol, y las migas viven en la barra superior, afuera de ella. Un store
/// module-level con useSyncExternalStore, como el de `signOutStatus`, en vez de un contexto: no suma un
/// provider, y la pantalla que la escribe se sincroniza con algo externo, que es para lo que está un efecto.
let leaf: string | undefined;
const listeners = new Set<() => void>();

function setLeaf(next: string | undefined): void {
  leaf = next;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot(): string | undefined {
  return leaf;
}

/// La pantalla hija pone su hoja y la borra al desmontarse: si quedara, la próxima pantalla hija mostraría
/// la de la anterior hasta poner la suya. Sin `label`, las migas terminan en el enlace de la sección.
export function useBreadcrumbLeaf(label?: string): void {
  useEffect(() => {
    setLeaf(label);

    return () => setLeaf(undefined);
  }, [label]);
}

/// La hoja que puso la pantalla, para las migas.
export function useCurrentBreadcrumbLeaf(): string | undefined {
  return useSyncExternalStore(subscribe, getSnapshot);
}
