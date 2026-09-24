/// El prefijo telefónico de los países a los que se podría configurar el envío de códigos por WhatsApp
/// (`WhatsApp:AllowedCountries` del backend). Es una lista chica a propósito: el servidor es el que interpreta
/// el número, y acá solo hace falta para mostrar "AR +54". Un país que no esté se muestra solo con su código.
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

function countryName(country: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(country) ?? country;
  } catch {
    // `of` rechaza lo que no tiene forma de código de región.
    return country;
  }
}
