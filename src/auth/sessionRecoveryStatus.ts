import { createContext, useContext } from "react";

/// Si la recuperación de la sesión todavía está en curso (la arranca `SessionRecovery`).
///
/// Es un contexto y no un store module-level como `signOutStatus`: el estado dura exactamente lo que dura el
/// montaje de `SessionRecovery`, así que se apaga solo y no hay que acordarse de limpiarlo entre un test y el
/// siguiente. Lo provee la propia ruta, así que tampoco suma un provider a `providers.tsx`.
export const SessionRecoveryContext = createContext(false);

/// Afuera de `SessionRecovery` (las pantallas de ingreso, los tests de componentes sueltos) no hay nada que
/// recuperar: el valor por defecto es `false` y todo se comporta como si esto no existiera.
export function useIsRecoveringSession(): boolean {
  return useContext(SessionRecoveryContext);
}
