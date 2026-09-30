/// El largo máximo del nombre de una cuenta que acepta el backend (`AccountRules.DisplayNameMaxLength`): el campo no
/// deja pasarse, en vez de dejar escribir de más y que lo rechace el servidor.
///
/// Vive en `shared/api` y no en una feature porque lo piden dos: el perfil propio (`/perfil`) y el alta y la edición de
/// un usuario (`/usuarios`).
export const displayNameMaxLength = 100;
