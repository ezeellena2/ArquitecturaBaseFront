import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { beginSignOut, cancelSignOut } from "@/auth/signOutStatus";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { changeLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";
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

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/// Menú del usuario, en el avatar de la barra superior (sección 7.2): datos de la sesión, idioma y cerrar
/// sesión. El idioma se cambia en la sesión actual, no se guarda en el perfil (falta el endpoint: Fase 4).
export function UserMenu() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const { data: user } = useCurrentUser();

  if (!user) {
    return null;
  }

  const displayName = user.displayName ?? user.email;

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
          <p className="truncate text-xs font-normal text-[var(--color-content-muted)]">{user.email}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>{t("layout.userMenu.profile")}</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-normal tracking-wide text-[var(--color-content-muted)] uppercase">
          {t("language.label")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={i18n.language}
          onValueChange={(value) => void changeLanguage(value as SupportedLanguage)}
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
