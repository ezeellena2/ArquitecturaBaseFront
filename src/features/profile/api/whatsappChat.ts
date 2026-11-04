import { api } from "@/shared/api/httpClient";

/// Cómo está el chat de WhatsApp del número de la cuenta (`GET /api/me/whatsapp`, tablero PF2 de Mi perfil). «Verificado»
/// dice que se puede entrar con el número; esto dice si el chat con el negocio está vinculado a la cuenta, que es lo que
/// hace falta para que le lleguen los avisos.
///
/// - `Linked`: vinculado. `noticesUntilUtc` es hasta cuándo pueden salir los avisos (24 horas después del último mensaje
///   de la persona), o null si hoy no salen.
/// - `NotLinked`: el número ya escribió, pero el chat quedó suelto. Se vincula confirmando el número otra vez con un código;
///   un mensaje nunca vincula.
/// - `NoChat`: el número nunca le escribió al negocio.
///
/// La ruta existe sólo con WhatsApp prendido (`login-methods`).
export interface WhatsAppChat {
  readonly state: "Linked" | "NotLinked" | "NoChat";
  readonly noticesUntilUtc: string | null;
}

export const whatsAppChatQueryKey = ["profile", "whatsapp-chat"] as const;

export function getWhatsAppChat(): Promise<WhatsAppChat> {
  return api.get<WhatsAppChat>("/api/me/whatsapp");
}
