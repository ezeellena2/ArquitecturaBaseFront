import i18n from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

export const supportedLanguages = ["es", "en"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageStorageKey = "arquitecturabase.language";

/// Un valor cualquiera (lo guardado en el navegador, lo que trae el perfil, lo que eligió un `<select>`) es
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

// Cada módulo tiene su archivo por idioma y se carga cuando alguien lo pide con useTranslation("modulo").
await i18n
  .use(resourcesToBackend((language: string, namespace: string) => import(`../../locales/${language}/${namespace}.json`)))
  .use(initReactI18next)
  .init({
    lng: initialLanguage(),
    fallbackLng: "es",
    supportedLngs: [...supportedLanguages],
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
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

export default i18n;
