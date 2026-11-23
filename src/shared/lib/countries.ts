/// El prefijo telefónico de los países a los que se puede mandar códigos por WhatsApp (Configuración › WhatsApp, RC3-A).
/// Es una lista chica a propósito: el servidor es el que interpreta el número, y acá solo hace falta para mostrar
/// "AR +54" y para elegir los países. Un país que no esté se muestra solo con su código.
const callingCodes: Readonly<Partial<Record<string, string>>> = {
  AR: "54",
  BO: "591",
  BR: "55",
  CL: "56",
  CO: "57",
  CR: "506",
  EC: "593",
  ES: "34",
  MX: "52",
  PE: "51",
  PY: "595",
  US: "1",
  UY: "598",
  VE: "58",
};

/// Los países que se ofrecen en Configuración › WhatsApp, por su código ISO.
export const whatsAppCountries: readonly string[] = Object.keys(callingCodes);

/// El prefijo de un país ("+54"), o null si no se conoce.
export function countryCallingCode(country: string): string | null {
  const callingCode = callingCodes[country];

  return callingCode === undefined ? null : `+${callingCode}`;
}

/// Lo que se ve en el desplegable: "AR +54", o "JP" si no se conoce el prefijo.
export function countryOptionLabel(country: string): string {
  const callingCode = callingCodes[country];

  return callingCode === undefined ? country : `${country} +${callingCode}`;
}

/// Lo que oye un lector de pantalla: "Argentina, +54", con el nombre en el idioma de la interfaz. Si el
/// navegador no conoce el código, queda el código.
export function countryDescription(country: string, language: string): string {
  const callingCode = callingCodes[country];
  const name = countryName(country, language);

  return callingCode === undefined ? name : `${name}, +${callingCode}`;
}

/// El nombre del país en el idioma de la interfaz ("Uruguay"), o el código si el navegador no lo conoce.
export function countryName(country: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(country) ?? country;
  } catch {
    // `of` rechaza lo que no tiene forma de código de región.
    return country;
  }
}
