import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/// What a screen does with a 403 when saving or trying something (SP1-B, 2026-11-24): it reads again what is in sight,
/// the permissions too. With reading left, it stays read only; without it, its own read gets the 403 and shows «No tenés
/// permiso» in place. It neither navigates nor adds a notice: a 403 follows the access state (mensajes-y-estados.md).
export function useRereadAfterForbidden(): () => void {
  const client = useQueryClient();

  return useCallback(() => { void client.invalidateQueries(); }, [client]);
}
