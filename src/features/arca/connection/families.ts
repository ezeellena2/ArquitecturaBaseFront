import type { ArcaConnection } from "./api";

/// Lo que la página le da a la zona de una familia en el alta. La familia avisa con `onReady` cómo completar su parte
/// cuando ya eligió lo suyo («Activar la conexión» la llama), o null mientras le falta algo.
export interface ArcaFamilySetupProps {
  step: number;
  connection: ArcaConnection;
  canManage: boolean;
  open: boolean;
  onReady: (complete: (() => Promise<void>) | null) => void;
}

/// Lo que la página le da a la zona de una familia con la conexión activa.
export interface ArcaFamilyActiveProps {
  connection: ArcaConnection;
  canManage: boolean;
  onConflict: () => void;
}
