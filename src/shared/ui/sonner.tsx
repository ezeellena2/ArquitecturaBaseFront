"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Toaster as Sonner } from "sonner"
import { useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { notificationHost, subscribeNotificationHost } from "./notificationHost"

// Ediciones nuestras sobre el archivo generado; son las únicas diferencias con lo que genera shadcn:
// - El tema. La CLI lo ata al del sistema con `useTheme` de next-themes, pero la app tiene un solo tema, el claro,
//   y ningún ThemeProvider. Con el sistema en oscuro, sonner tomaba su tema oscuro sobre el fondo blanco de
//   `--popover` y la descripción quedaba en un gris casi blanco. `sonner.theme.test.tsx` se pone en rojo si vuelve.
// - Los textos que sonner trae en inglés y lee un lector de pantalla: el nombre de la región de los avisos
//   ("Notifications alt+T"; el atajo lo agrega él) y el del botón de cerrar un aviso ("Close toast").
//   El adaptador no recibe props de apariencia: sus consumidores no cambian posición, tema ni traducciones.
//   `sonner.i18n.test.tsx` se pone en rojo si vuelven.
// - La ubicación aprobada es abajo a la derecha, definida acá para toda la plantilla.
const Toaster = () => {
  const { t } = useTranslation()
  const host = useSyncExternalStore(subscribeNotificationHost, notificationHost, () => null)

  const toaster = (
    <Sonner
      theme="light"
      position="bottom-right"
      containerAriaLabel={t("notifications.label")}
      toastOptions={{ closeButtonAriaLabel: t("notifications.close") }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
    />
  )
  return host ? createPortal(toaster, host) : toaster
}

export { Toaster }
