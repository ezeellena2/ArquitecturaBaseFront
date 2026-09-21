import { api } from "./httpClient";

/// Un rol con sus permisos y cuánta gente lo tiene (`GET /api/roles`, sección 10 del spec de la Fase 4).
export interface RoleListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystemRole: boolean;
  readonly userCount: number;
  readonly permissions: readonly string[];
}

/// Vive acá y no en `features/roles` porque lo piden dos módulos: la pantalla de roles y el diálogo de
/// usuarios que asigna roles. Una feature nunca importa de otra: lo común sube a `shared`.
export const rolesQueryKey = ["roles"] as const;

export function fetchRoles(): Promise<readonly RoleListItem[]> {
  return api.get<readonly RoleListItem[]>("/api/roles");
}
