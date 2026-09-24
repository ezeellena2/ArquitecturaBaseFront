import { describe, expect, it } from "vitest";
import { userFormErrors, type UserFormField } from "./errors";
import { ApiError } from "@/shared/api/ApiError";
import i18n from "@/shared/i18n";

const t = i18n.getFixedT("es", "users");

const allFields: readonly UserFormField[] = ["email", "phone", "displayName", "channel", "consent"];

function problem(status: number, body: Record<string, unknown>): ApiError {
  return new ApiError(status, body);
}

describe("userFormErrors", () => {
  it("puts a missing email and number above the buttons, with the server's text", () => {
    const error = problem(400, { code: "Users.Identity.Required", detail: "Cargá un correo o un número de WhatsApp." });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: {},
      form: "Cargá un correo o un número de WhatsApp.",
    });
  });

  it("puts a repeated email under the email, by its code", () => {
    const error = problem(409, { code: "Users.User.AlreadyExists", detail: "Otro texto del servidor." });

    expect(userFormErrors(error, t, allFields)).toEqual({ fields: { email: "Ya existe una cuenta con ese correo." } });
  });

  it("puts a repeated number under the number, by its code", () => {
    const error = problem(409, { code: "Users.Phone.AlreadyExists", detail: "Otro texto del servidor." });

    expect(userFormErrors(error, t, allFields)).toEqual({ fields: { phone: "Ya existe una cuenta con ese número." } });
  });

  it("puts a number that is not a mobile under the number", () => {
    const error = problem(400, { code: "Users.Phone.Invalid", detail: "El número no es válido." });

    expect(userFormErrors(error, t, allFields)).toEqual({ fields: { phone: "Ingresá un número de celular válido." } });
  });

  it("puts a number of a country without WhatsApp under the number", () => {
    const error = problem(400, {
      code: "Auth.WhatsApp.CountryNotSupported",
      detail: "Todavía no mandamos códigos a números de ese país.",
    });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: { phone: "Todavía no mandamos códigos a números de ese país." },
    });
  });

  it("puts the missing consent under the checkbox, from the field the server names", () => {
    const error = problem(400, {
      code: "Users.Invitation.ConsentRequired",
      detail: "Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
      errors: { "invitation.consent": ["Confirmá que la persona aceptó recibir mensajes por WhatsApp."] },
    });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: { consent: "Confirmá que la persona aceptó recibir mensajes por WhatsApp." },
    });
  });

  it("puts the missing name for a WhatsApp invitation under the name", () => {
    const error = problem(400, {
      code: "Users.Invitation.NameRequired",
      detail: "Para invitar por WhatsApp, cargá el nombre de la persona.",
      errors: { displayName: ["Para invitar por WhatsApp, cargá el nombre de la persona."] },
    });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: { displayName: "Para invitar por WhatsApp, cargá el nombre de la persona." },
    });
  });

  it("still finds the field by the code when the server sends no field errors", () => {
    const error = problem(400, {
      code: "Users.Invitation.ConsentRequired",
      detail: "Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
    });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: { consent: "Confirmá que la persona aceptó recibir mensajes por WhatsApp." },
    });
  });

  it("maps the nested fields of the number and the invitation", () => {
    const error = problem(400, {
      code: "Validation.Failed",
      detail: "Revisá los datos ingresados.",
      errors: {
        "phone.number": ["El número no puede tener más de 32 caracteres."],
        "invitation.channel": ["Para invitar por correo, cargá un correo."],
      },
    });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: {
        phone: "El número no puede tener más de 32 caracteres.",
        channel: "Para invitar por correo, cargá un correo.",
      },
    });
  });

  it("moves an error of a field that is not on screen above the buttons", () => {
    // En la edición, el correo solo está en pantalla si se lo está agregando. Un error que no tiene dónde
    // mostrarse dejaría el diálogo abierto sin decir nada.
    const error = problem(409, { code: "Users.User.AlreadyExists", detail: "Ya existe una cuenta con ese correo." });

    expect(userFormErrors(error, t, ["displayName"])).toEqual({
      fields: {},
      form: "Ya existe una cuenta con ese correo.",
    });
  });

  it("moves an error of a field the form does not know above the buttons", () => {
    const error = problem(400, {
      code: "Validation.Failed",
      detail: "Revisá los datos ingresados.",
      errors: { roles: ["El rol no existe."] },
    });

    expect(userFormErrors(error, t, allFields)).toEqual({ fields: {}, form: "El rol no existe." });
  });

  it("explains the protection rules above the buttons, as before", () => {
    const error = problem(409, { code: "Users.User.LastAdmin", detail: "Tiene que quedar un administrador." });

    expect(userFormErrors(error, t, allFields)).toEqual({
      fields: {},
      form: "No podés dejar al sistema sin administradores. Asigná el rol Admin a otra cuenta activa y volvé a intentar.",
    });
  });

  it("says there was no connection above the buttons", () => {
    expect(userFormErrors(ApiError.network(), t, allFields)).toEqual({
      fields: {},
      form: "No pudimos conectarnos. Revisá tu conexión.",
    });
  });
});
