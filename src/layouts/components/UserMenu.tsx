import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { endServerSession } from "@/auth/accessRequests";
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
import { ActionTooltip } from "@/shared/ui/ActionTooltip";

/// Menú del usuario, en el avatar de la barra superior (sección 7.2): datos de la sesión, el acceso a su
/// perfil, el idioma y cerrar sesión.
///
/// El idioma se cambia acá porque es un atajo que se usa seguido, y desde la Fase 4 **también se guarda en la
/// cuenta**: lo hace `useLanguagePreference`, que lo aplica en el acto y lo devuelve atrás si el guardado
/// falla. El mismo idioma se puede cambiar desde `/perfil`, junto con el resto del perfil.
export function UserMenu() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isPending } = useCurrentUser();
  const { change: changeLanguage } = useLanguagePreference();

  if (!user) {
    // El menú necesita el nombre para poder nombrarse, así que hasta que llega no hay menú: queda el bloque
    // de carga del avatar, del mismo tamaño, para que después no aparezca de golpe.
    return isPending ? <Skeleton aria-hidden="true" className="size-6 shrink-0 rounded-[var(--radius-control)]" /> : null;
  }

  const displayName = accountNameOf(user);
  // Sin nombre no hay renglón de abajo: el del nombre ya muestra el correo o el número.
  const detail = accountDetailOf(user);

  async function handleSignOut() {
    // Conserva una transición mientras el servidor cierra la sesión; después limpia el estado y navega en el SPA.
    beginSignOut();

    try {
      await endServerSession(auth.user?.id_token);
      await queryClient.cancelQueries();
      queryClient.clear();
      await auth.removeUser();
      navigate("/login", { replace: true });
      cancelSignOut();
    } catch {
      // Si no se pudo ni empezar el cierre de sesión, seguimos en esta pantalla: no puede quedar trabada
      // mostrando la transición.
      cancelSignOut();
      toast.error(t("layout.signOutError"));
    }
  }

  return (
    <DropdownMenu>
      <ActionTooltip label={t("layout.userMenu.trigger", { name: displayName })}>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand-600)] text-xs font-bold text-[var(--color-brand-ink)]"
        >
          {initialOf(displayName)}
        </span>
        <span className="sr-only">{t("layout.userMenu.trigger", { name: displayName })}</span>
        <ChevronDownIcon className="size-4 text-[var(--color-content-muted)]" />
      </DropdownMenuTrigger>
      </ActionTooltip>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-[var(--color-content)]">{displayName}</p>
          {detail === undefined ? null : (
            <p className="truncate text-xs font-normal text-[var(--color-content-muted)]">{detail}</p>
          )}
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
