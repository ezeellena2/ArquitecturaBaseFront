import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { Link } from "react-router";
import { accountDetailOf, accountNameOf, initialOf } from "@/auth/accountName";
import { beginSignOut, cancelSignOut } from "@/auth/signOutStatus";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useLanguagePreference } from "@/auth/useLanguagePreference";
import { isSupportedLanguage, supportedLanguages } from "@/shared/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { ChevronDownIcon, LogOutIcon } from "@/shared/ui/icons";
import { Skeleton } from "@/shared/ui/skeleton";

/// Menú del usuario, en el avatar de la barra superior (sección 7.2): datos de la sesión, el acceso a su
/// perfil, el idioma y cerrar sesión.
///
/// El idioma se cambia acá porque es un atajo que se usa seguido, y desde la Fase 4 **también se guarda en la
/// cuenta**: lo hace `useLanguagePreference`, que lo aplica en el acto y lo devuelve atrás si el guardado
/// falla. El mismo idioma se puede cambiar desde `/perfil`, junto con el resto del perfil.
export function UserMenu() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const { data: user, isPending } = useCurrentUser();
  const { change: changeLanguage } = useLanguagePreference();

  if (!user) {
    // El menú necesita el nombre para poder nombrarse, así que hasta que llega no hay menú: queda el bloque
    // de carga del avatar, del mismo tamaño, para que después no aparezca de golpe.
    return isPending ? <Skeleton aria-hidden="true" className="size-8 shrink-0 rounded-full" /> : null;
  }

  const displayName = accountNameOf(user);

  async function handleSignOut() {
    // AppLayout se entera por acá y muestra una transición en vez del layout con los datos ya vacíos
    // (entre que esto limpia la sesión en memoria y auth.signoutRedirect navega a /connect/logout).
    beginSignOut();

    try {
      await auth.signoutRedirect();
    } catch {
      // Si no se pudo ni empezar el cierre de sesión, seguimos en esta pantalla: no puede quedar trabada
      // mostrando la transición.
      cancelSignOut();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-sm font-semibold text-white"
        >
          {initialOf(displayName)}
        </span>
        <span className="sr-only">{t("layout.userMenu.trigger", { name: displayName })}</span>
        <ChevronDownIcon className="size-4 text-[var(--color-content-muted)]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-[var(--color-content)]">{displayName}</p>
          <p className="truncate text-xs font-normal text-[var(--color-content-muted)]">{accountDetailOf(user)}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* asChild: el ítem del menú es el propio enlace, así navega con un clic o con Enter y conserva su
            rol de menuitem. */}
        <DropdownMenuItem asChild>
          <Link to="/perfil">{t("layout.userMenu.profile")}</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-normal tracking-wide text-[var(--color-content-muted)] uppercase">
          {t("language.label")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={i18n.language}
          onValueChange={(value) => {
            // El grupo informa un string cualquiera; acá solo hay idiomas de los que existen.
            if (isSupportedLanguage(value)) {
              void changeLanguage(value);
            }
          }}
        >
          {supportedLanguages.map((language) => (
            <DropdownMenuRadioItem key={language} value={language}>
              {t(`language.${language}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOutIcon className="size-4" />
          {t("layout.userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
