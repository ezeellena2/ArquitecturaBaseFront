import i18n, { type FormatterModule } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";
import { formatNumber } from "@/shared/lib/numberFormat";

export const supportedLanguages = ["es", "en"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageStorageKey = "arquitecturabase.language";
export const publicLanguageStorageKey = "arquitecturabase.public-language";

/// Un valor cualquiera (lo guardado en el navegador, lo que trae el perfil, lo que se eligió en pantalla) es
/// uno de los idiomas que hay.
export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return supportedLanguages.includes(value as SupportedLanguage);
}

function initialLanguage(): SupportedLanguage {
  const stored = globalThis.localStorage?.getItem(languageStorageKey);

  return isSupportedLanguage(stored) ? stored : "es";
}

// El `lang` del documento sigue al idioma de la interfaz: de ahí saca un lector de pantalla la voz y la
// pronunciación, y con el "en" que deja la plantilla de Vite leía el español con voz inglesa. Se escucha el evento
// en vez de tocarlo en cada lugar que cambia el idioma (la pantalla de ingreso, el menú del usuario, la
// sincronización con el perfil), así ninguno se lo olvida. Va antes del `init`, que lo emite con el idioma inicial.
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

// FORMATO ÚNICO DE NÚMEROS (2026-11-12): todo número que entra en un texto, también el de un plural, pasa por el formateador
// de shared/lib con la región de su idioma: «1.210 respuestas», «1,210 responses». Por eso los textos no llevan formatos
// (un `number` entre las llaves) y un identificador se pasa como texto, que queda como está. Reemplaza al formateador de
// i18next, que escribe con el idioma pelado y en español no agrupa los números de cuatro cifras.
const numbers: FormatterModule = {
  type: "formatter",
  init: () => {},
  add: () => {},
  addCached: () => {},
  format: (value, _format, language) => typeof value === "number" || typeof value === "bigint" ? formatNumber(value, language ?? i18n.language) : value,
};

// Cada módulo tiene su archivo por idioma y se carga cuando alguien lo pide con useTranslation("modulo").
await i18n
  .use(resourcesToBackend((language: string, namespace: string) => import(`../../locales/${language}/${namespace}.json`)))
  .use(initReactI18next)
  .use(numbers)
  .init({
    lng: initialLanguage(),
    fallbackLng: "es",
    supportedLngs: [...supportedLanguages],
    ns: ["common", "auth", "profile", "users", "roles", "settings"],
    defaultNS: "common",
    interpolation: { escapeValue: false, alwaysFormat: true },
    react: { useSuspense: true },
  });

/// Cambia el idioma de la interfaz y lo recuerda en este navegador. Es el nivel de abajo, y lo llaman dos: la
/// pantalla de ingreso (donde todavía no hay cuenta a la que guardárselo) y `useLanguagePreference`, que
/// además lo persiste en el perfil. **Desde una pantalla con sesión no se llama a esto directo:** el idioma
/// tiene que quedar guardado en la cuenta, no solo en esta máquina.
export function changeLanguage(language: SupportedLanguage): Promise<unknown> {
  globalThis.localStorage?.setItem(languageStorageKey, language);

  return i18n.changeLanguage(language);
}

export function changePublicLanguage(language: SupportedLanguage): Promise<unknown> {
  globalThis.localStorage?.setItem(publicLanguageStorageKey, language);
  return changeLanguage(language);
}

export default i18n;
