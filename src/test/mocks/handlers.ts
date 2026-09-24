import { http, HttpResponse } from "msw";
import type { CurrentUser } from "@/auth/useCurrentUser";
import type { LoginMethods } from "@/shared/api/loginMethods";

/// Perfil que devuelve /api/me por defecto. Los tests que necesitan otro lo pisan con server.use(...).
///
/// Va tipado como `CurrentUser` a propósito: así un campo nuevo del perfil rompe acá y no en silencio, y los
/// tests que lo copian con `{ ...currentUser, … }` heredan los tipos de verdad (`displayName` puede ser null).
export const currentUser: CurrentUser = {
  id: "0199a0c0-0000-7000-8000-000000000000",
  email: "ana@example.com",
  emailConfirmed: true,
  displayName: "Ana",
  phoneNumber: null,
  formattedPhoneNumber: null,
  maskedPhoneNumber: null,
  phoneNumberConfirmed: false,
  hasGoogleLogin: false,
  culture: "es",
  timeZoneId: "America/Argentina/Buenos_Aires",
  lastLoginAtUtc: null,
  roles: ["User"],
  permissions: ["users.read"],
};

/// Una cuenta creada desde WhatsApp: sin correo, con el número verificado. `/api/me` manda el número tres veces: en
/// E.164, formateado para leer y enmascarado para confirmar algo sin repetirlo entero.
export const phoneOnlyUser: CurrentUser = {
  ...currentUser,
  email: null,
  emailConfirmed: false,
  displayName: "Ana Pérez",
  phoneNumber: "+5491123456789",
  formattedPhoneNumber: "+54 9 11 2345-6789",
  maskedPhoneNumber: "+54 9 11 •••• 6789",
  phoneNumberConfirmed: true,
};

/// Medios de ingreso por defecto: los de antes de WhatsApp (Google y el correo). Así la pantalla de ingreso se
/// ve como siempre en los tests que no hablan de WhatsApp.
export const loginMethods: LoginMethods = {
  google: true,
  whatsapp: false,
  whatsappCountries: [],
  whatsappNumber: null,
};

/// WhatsApp prendido, con dos países: el perfil ofrece vincular el número y el campo arranca en el primero.
export const whatsappLoginMethods: LoginMethods = {
  google: true,
  whatsapp: true,
  whatsappCountries: ["AR", "UY"],
  whatsappNumber: "15551632662",
};

/// Handlers por defecto. Cada test agrega los suyos con server.use(...).
export const handlers = [
  http.get("/api/me", () => HttpResponse.json(currentUser)),
  http.get("/account/login-methods", () => HttpResponse.json(loginMethods)),
];
