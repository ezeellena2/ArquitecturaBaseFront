/// FORMATO ÚNICO DE NÚMEROS (2026-11-12): el estándar CLDR de la región de cada idioma de la app, el mismo de Intl y de
/// `CultureInfo`: español de Argentina (es-AR, por el voseo: «1.210», «1.234,5») e inglés de Estados Unidos (en-US, como las
/// fechas MM/dd/yyyy: «1,210», «1,234.5»). El `es` pelado sigue la norma de España, que no agrupa los números de cuatro
/// cifras («$ 1210» al lado de «$ 750.280»): por eso ningún número se escribe con el idioma de la interfaz directo.
///
/// Es el único formateador de números del front: lo cuida un test de arquitectura, y los números de un texto pasan por acá
/// solos (shared/i18n). Los identificadores (códigos, CUIT, número de comprobante o de documento, teléfonos) no son números:
/// van como se escriben, como texto. La moneda sigue en `common:money`; acá sólo se escribe el número.
export type NumberLocale = "es-AR" | "en-US";

/// La región de los números de un idioma de la app; el español, que es el idioma por defecto, para cualquier otro.
export function numberLocale(language: string): NumberLocale {
  return language.toLowerCase().startsWith("en") ? "en-US" : "es-AR";
}

// Building an Intl formatter costs about a hundred times more than using one: each region and set of options keeps one.
const formats = new Map<string, Intl.NumberFormat>();

export function numberFormat(language: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = numberLocale(language);
  const key = options ? locale + JSON.stringify(options) : locale;
  let format = formats.get(key);
  if (!format) formats.set(key, format = new Intl.NumberFormat(locale, options));
  return format;
}

export function formatNumber(value: number | bigint, language: string, options?: Intl.NumberFormatOptions): string {
  return numberFormat(language, options).format(value);
}

/// Una parte como porcentaje (0,45 es «45%»), con el signo donde lo pone la región: pegado en es-AR y en en-US. Un texto
/// recibe el porcentaje ya escrito y nunca pega el signo a mano, que ponía un espacio en un idioma y no en el otro.
export function formatPercent(share: number, language: string, options?: Intl.NumberFormatOptions): string {
  return formatNumber(share, language, { style: "percent", maximumFractionDigits: 0, ...options });
}
