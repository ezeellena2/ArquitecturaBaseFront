import { ApiError } from "@/shared/api/ApiError";
import { phoneFieldError } from "@/shared/api/codeErrors";
import { applyApiErrorToForm } from "@/shared/api/formErrors";

/// Firma mínima que necesitamos de `t`, la misma que usa `columns.tsx`: alcanza con la del namespace "users",
/// sin acoplar el tipo exacto de react-i18next, que cambia de versión en versión.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, que es estable, nunca por el texto. Las dos reglas que protegen al sistema
/// (sección 8 del spec de la Fase 4) se explican con lo que hay que hacer para destrabarlas, que es algo que
/// el backend no puede saber. El resto de los errores ya vienen traducidos del servidor.
export function userActionErrorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t("common:states.error");
  }

  if (error.isNetworkError) {
    return t("common:errors.network");
  }

  switch (error.code) {
    case "Users.User.AlreadyExists":
      return t("errors.alreadyExists");
    case "Users.Phone.AlreadyExists":
      return t("errors.phoneAlreadyExists");
    case "Users.User.LastAdmin":
      return t("errors.lastAdmin");
    case "Users.User.CannotModifySelf":
      return t("errors.cannotModifySelf");
    default:
      return error.detail ?? t("common:states.error");
  }
}

/// Los lugares del alta y de la edición donde puede ir un error: debajo de un campo, o arriba de los botones.
export type UserFormField = "email" | "phone" | "displayName" | "channel" | "consent";

export interface UserFormErrors {
  readonly fields: Partial<Record<UserFormField, string>>;
  /// Lo que no es de un campo que esté a la vista, arriba de los botones.
  readonly form?: string;
}

/// Los errores de negocio que son de un campo. Unos llegan sin `errors` (el correo o el número de otra cuenta, un
/// número que no es un celular): se atan al campo por el código. Otros llegan también en `errors`, pero el código
/// alcanza para ubicarlos aunque el servidor dejara de mandarlos.
const fieldOfCode: Readonly<Partial<Record<string, UserFormField>>> = {
  "Users.User.AlreadyExists": "email",
  "Users.Phone.AlreadyExists": "phone",
  "Users.Phone.Invalid": "phone",
  "Auth.WhatsApp.CountryNotSupported": "phone",
  "Users.Invitation.ConsentRequired": "consent",
  "Users.Invitation.NameRequired": "displayName",
};

/// Los nombres de los campos del backend (camelCase, con el punto de los objetos anidados) y su lugar en el formulario.
const fieldOfServerField: Readonly<Partial<Record<string, UserFormField>>> = {
  email: "email",
  phone: "phone",
  "phone.number": "phone",
  "phone.country": "phone",
  displayName: "displayName",
  "invitation.channel": "channel",
  "invitation.consent": "consent",
};

function codeMessage(error: ApiError, field: UserFormField, t: Translate): string {
  if (field === "phone") {
    // El número de otra cuenta tiene su texto; el que no es un celular, o es de un país sin WhatsApp, el del ingreso.
    return error.code === "Users.Phone.AlreadyExists"
      ? userActionErrorMessage(error, t)
      : (phoneFieldError(error, t) ?? userActionErrorMessage(error, t));
  }

  return userActionErrorMessage(error, t);
}

/// Dónde va cada error del alta y de la edición (tablero "WhatsApp · Usuarios: alta con teléfono", "Errores del
/// alta"): debajo del campo que lo arregla, o arriba de los botones. Se decide por el `code` y por los campos que
/// nombra el servidor (`applyApiErrorToForm`), nunca por el texto.
///
/// `visible` son los campos que están en pantalla: en la edición, el correo y el número solo están si se los está
/// agregando. Un error de un campo que no está, o que el formulario no conoce, va arriba de los botones: si no, el
/// diálogo quedaría abierto sin decir por qué.
export function userFormErrors(error: unknown, t: Translate, visible: readonly UserFormField[]): UserFormErrors {
  if (!(error instanceof ApiError) || error.isNetworkError) {
    return { fields: {}, form: userActionErrorMessage(error, t) };
  }

  const fields: Partial<Record<UserFormField, string>> = {};
  let form: string | undefined;

  function place(field: UserFormField | undefined, message: string) {
    if (field !== undefined && visible.includes(field)) {
      fields[field] ??= message;
    } else {
      form ??= message;
    }
  }

  const codeField = error.code === undefined ? undefined : fieldOfCode[error.code];

  if (codeField !== undefined) {
    place(codeField, codeMessage(error, codeField, t));
  }

  applyApiErrorToForm(error, (field, { message }) => place(fieldOfServerField[field], message));

  if (Object.keys(fields).length === 0 && form === undefined) {
    form = userActionErrorMessage(error, t);
  }

  return form === undefined ? { fields } : { fields, form };
}
