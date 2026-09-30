# Unificación de mensajes del front

Fecha: **2026-09-30**. Estado: **adopción parcial: mecanismo común y configuración implementados; migración transversal pendiente**.
El usuario pidió establecer un criterio transversal como en el backend y mantener el orden
diseño → plan → desarrollo. El [contrato de mensajes y estados](../guides/mensajes-y-estados.md)
fija la interacción; este plan propone el mecanismo técnico, releva desvíos y define el cierre.
El diseño precedió al código. El avance implementado y las etapas todavía pendientes se
registran al final del documento.

## Problema y comportamiento buscado

Existe un Toaster global abajo a la derecha, pero su uso no es uniforme: algunos errores de
guardado se muestran dentro del editor, las cargas fallidas repiten el detalle dentro del
contenido y en el aviso, y cada feature resuelve por su cuenta los fallbacks. Las instrucciones
y ciertos tests también conservan decisiones anteriores. Por eso las pantallas pueden pasar
los checks actuales y seguir mostrando mensajes de manera distinta.

El resultado buscado es que el mismo hecho tenga el mismo canal y comportamiento en cualquier
pantalla: validación junto al campo; resultado operativo en el Toaster; decisión en ConfirmDialog;
carga imposible en un estado de recuperación; condición duradera junto al dato o en el flujo.
La feature conserva sus reglas funcionales y no decide una política de mensajes propia.

## Diseño del recorrido común

| Recorrido | Presentación y recuperación |
| --- | --- |
| Enviar → validación de dato | Campo/grupo marcado, corrección allí, sin notificación repetida |
| Enviar → rechazo general | Un toast.error; conservar valores y diálogo/página |
| Enviar → respuesta confirmada | Un toast.success; refrescar datos y navegar/cerrar según el caso de uso |
| Advertencia o información operativa | toast.warning o toast.info con el mismo Toaster y ciclo de vida común |
| Carga inicial → fallo | Estado de contenido con Reintentar; la causa se explica una vez en el toast |
| Refetch → fallo con datos previos | Conservar datos/borrador; toast que explica la actualización fallida |
| Escritura → resultado incierto | Toast persistente con Revisar; consultar antes de ofrecer repetir la escritura |
| Código agotado/cuenta bloqueada | Estado del flujo y próxima acción; no un cartel general improvisado |

El tablero de Configuración permitió revisar éxito, error, warning, info y recuperación con
el Toaster; fue retirado al implementar esa pantalla. Su [evidencia versionada](../design/visual-baseline.md#configuración-general-2026-09-30)
conserva la revisión. Para las próximas migraciones, completar la revisión de campo/grupo, carga sin datos, datos previos, estados
terminales y avisos dentro de Dialog. Usar las piezas de la biblioteca, escritorio y 320 px;
no crear otra familia de avisos ni implementar primero para diseñar después.

## Inventario auditado

Relevamiento sobre el árbol de trabajo del 2026-09-30. Los archivos tienen otros cambios en
curso: al comenzar cada etapa hay que confirmar la situación actual sin sobrescribirlos.
Las filas describen el código existente, no una migración ya realizada.

| Superficie o mecanismo | Situación encontrada | Trabajo de unificación |
| --- | --- | --- |
| AppProviders / sonner.tsx | Un Toaster global con bottom-right; admite props que pueden sobrescribir defaults; sin cierre y duración comunes por severidad | Sellar configuración y usar el emisor común |
| QueryCache | Avisa errores de consultas no silent; sin id estable ni ciclo común; red ofrece reintento con duración por defecto | Emisor común, deduplicación y acciones con contexto |
| httpClient / ApiError | Transporte común; convierte ProblemDetails y coordina sesión | Conservar el límite; no agregar avisos al transporte |
| FormField / CheckboxField / RadioGroupField / PhoneField | Piezas para errores de campo | Conservar asociación accesible y comprobar que no se notifica dos veces |
| OtpInput | Permite invalid y descripción accesible; los consumidores dibujan distintos errores y estados fuera del grupo | Unificar error de grupo y ayuda/estado de código con los mismos consumidores |
| `/usuarios`: activar/eliminar | Éxito/error ya usan toast directo | Migrar emisor, fallback y tests del canal; conservar permisos e invalidaciones |
| Alta y edición de usuario | `userFormErrors` devuelve fields y form; form se muestra encima de los botones | Mantener campos visibles; resto al aviso común; conservar borrador y diálogo |
| Lectura del detalle de usuario | Consulta silent con error dentro del diálogo | Estado de contenido más una causa notificada por dueño local |
| Última invitación / reenvío | Combina campos, error panel, toast y cuenta regresiva | Mantener canal/consentimiento/espera; error del nombre guardado que no puede corregirse en ese envío al aviso general |
| `/roles`: listado y eliminación | Toast directo en acciones; DataTable repite la causa de lectura mientras QueryCache también avisa | Emisor común; estado de tabla sin duplicar la causa |
| Alta/edición de rol | Error general en `formError`; si ya se salió del editor usa toast; campos ya se mapean | Un dueño del resultado esté abierto o cerrado; conservar campos, guarda y borrador |
| `/perfil`: datos | Éxito por toast; error general inline; si falla la primera carga puede quedar solo la cabecera | Unificar fallo general y recuperación sin formulario; no borrar valores tras refetch |
| Perfil: desvincular | Toast directo y nueva lectura ante último medio de ingreso | Conservar regla del último medio; usar emisor/fallback comunes |
| VerifyDestinationDialog | Pedido/reenvío/verificación mezclan error general inline, Banner y estados del código | Compartir política con acceso; conservar campos, destino ocupado, intentos y bloqueos |
| `/configuracion` existente | Toast directo en mutación; lectura repite causa en EmptyState y QueryCache | Adoptar mecanismo común antes de extender ajustes; no implementar el diseño nuevo en esta etapa |
| `/login`, `/registro`: correo/WhatsApp/Google | `formError` y notice dentro del formulario; algunos fallos de carga se manejan silent | Campo donde corresponde; fallo operativo/redirect una sola notificación; registro cerrado como estado |
| `/login/codigo`, `/registro/codigo` | Una superficie inline mezcla código incorrecto, rechazo general, espera y cuenta bloqueada | Separar campo/grupo, estado terminal y aviso, conservando intención ingreso/registro |
| `/ingresar`, callback | Fallos recuperables y estados terminales propios, consultas silent | Conservar los estados terminales; aplicar el canal común solo al fallo operativo |
| Inicio autenticado | Banner por ausencia de correo | Representar condición y acción vigentes; no generar popup en cada visita/render |
| Guard de permisos / lectura de `/api/me` | Recuperación y QueryCache pueden repetir causa | Estado de acceso/carga más dueño único; mantener renovación y 401/403 |
| Cambiar idioma / cerrar sesión | Toast directo con fallo propio | Emisor común sin modificar restauración de idioma ni revocación de sesión |
| `/sin-permiso`, ruta inexistente, bienvenida pública | Son estados de navegación/oferta, no resultados de una mutación | Mantener estados; revisar carga de medios y no agregar avisos repetidos |
| Arnés `renderWithProviders` | QueryClient aislado anidado sin los callbacks del QueryCache productivo | Usar la misma fábrica de cliente; aislar caché/desactivar retries sin quitar la política |
| Tests actuales | Cubren muchos textos y reglas; no hay límite de imports de Sonner ni prueba transversal de todos los canales | Pruebas de arquitectura y recorridos; revisar assertions del criterio anterior |

## Mecanismo técnico propuesto

No introduce otro transporte, librería de notificaciones o framework de formularios.

- **`shared/api/errorFeedback.ts`**: funciones puras que clasifican ApiError/error desconocido,
  red, 5xx, validación, espera y resultado incierto según el contexto. Devuelven campos y/o
  descripción del aviso/estado. No importan features, React ni Sonner. Cada feature aporta
  mapeo de códigos/campos visibles y traducciones de negocio; comparte el fallback técnico.
- **`shared/ui/notifications.ts`**: emisor mínimo success/error/warning/info y cierre por id.
  Único consumidor de la API toast de Sonner en producto; aplica duración, cierre, id y acción.
  La acción la aporta el caso de uso, con su contexto y condiciones de reintento.
- **`shared/ui/sonner.tsx`**: único adaptador visual. No permitir que consumidores cambien
  posición/tema/duración por pantalla. Conservar traducción, tokens, íconos y accesibilidad.
- **Fábrica de QueryClient en `shared/api/queryClient.ts`**: app y tests usan el mismo manejador.
  El test obtiene caché propia y desactiva retries, sin eliminar el dueño global de los avisos.
  No agregar un manejador global de mutaciones que duplique los callbacks locales.
- **Piezas de campo, grupo y estado existentes**: cubrir el grupo OTP y la recuperación con
  las piezas comunes. No promover un FormError genérico ni copiar un nuevo párrafo por feature.

Los nombres son una propuesta de implementación; se confirma su API mínima con los primeros
consumidores en TDD. La ubicación, canales y obligaciones del contrato no dependen de esos nombres.

## Etapas y verificación

### 1. Cerrar el diseño de interacción

- [ ] Revisar los recorridos de la tabla y completar los escenarios visuales que faltan.
- [ ] Verificar aviso con Dialog abierto: anuncio, foco, cierre y recuperación por teclado.
- [ ] Confirmar inventario, dueños de consultas compartidas y casos de resultado incierto.

### 2. Crear el mecanismo y los controles con tests en rojo primero

- [ ] Clasificador puro: campos visibles/desconocidos, red, 5xx con traceId, negocio, cancelación
  y códigos del ingreso público sin confundirlos con la sesión autenticada.
- [ ] Emisor común: cuatro tipos, duraciones, cierre, persistencia con acción, id estable y
  retiro de una acción que dejó de ser válida. Probar con reloj controlado.
- [ ] Fábrica QueryClient: un aviso con dos observadores, retries, silent local y montaje doble;
  mismo comportamiento en el arnés y en la app.
- [ ] Pruebas de arquitectura dentro de `src/test/architecture/`: un Toaster en providers,
  import de Toaster/uso de toast de Sonner solo en los adaptadores y consumidor del emisor común.
  Analizar imports/JSX con TypeScript, no prohibir indiscriminadamente todo role=alert.
- [ ] Mientras se migra, registrar excepciones temporales **por archivo auditado** en el test,
  con la etapa que las elimina; una ruta nueva no entra en esa lista. No excluir features enteras
  ni dar por concluida la unificación mientras haya excepciones.

### 3. Migrar administración y perfil

- [ ] Listados/acciones de usuarios y roles, configuración existente, idioma y cierre de sesión.
- [ ] Alta/edición de usuarios y roles: general al toast; fields al control; un dueño ante navegación
  o cierre mientras llega la respuesta; borrar su excepción temporal.
- [ ] Perfil, detalle de usuario y fallos de carga/refetch: distinguir datos previos y carga inicial.
- [ ] Última invitación y desvínculos: preservar consentimiento, límites, recuperación e invalidaciones.

### 4. Migrar el acceso y la verificación compartida

- [ ] Correo/WhatsApp en ingreso y registro, error de Google comunicado una vez.
- [ ] Código y VerifyDestinationDialog: prueba de contrato compartida, errores del grupo, destino
  ocupado, código agotado, cuenta bloqueada, intentos y espera, sin perder la intención del flujo.
- [ ] Enlace, callback, guard de permisos y condiciones duraderas del inicio; conservar decisiones
  funcionales y separar estado terminal de fallo operativo.

### 5. Comprobar y cerrar la adopción completa

- [ ] Cada fila del inventario tiene evidencia de adopción o justificación de que es un estado
  de negocio/navegación conforme al contrato, sin una política alternativa de mensajes.
- [ ] No quedan imports directos de toast en consumidores ni excepciones temporales.
- [ ] Pruebas de comportamiento con MSW verifican canal y cantidad, además del texto, borrador,
  foco, recuperación, ambos idiomas, navegación durante la petición y ausencia de duplicados.
- [ ] Navegador real: escritorio/320 px, teclado, avisos sobre Dialog y lectura de estados.
- [ ] `npm run build`, `npm run lint` y `npm run test` limpios. Los nuevos controles corren con
  `npm run test`; si se incorpora CI, debe ejecutar esos mismos checks sin omitir arquitectura.
- [ ] Actualizar instrucciones, contrato visual, biblioteca y estado de este plan con evidencia.
  Retirar el laboratorio cuando cierre su elección, conservando las decisiones en la documentación.

La ampliación de Configuración debe consumir este mecanismo, no agregar una quinta manera de
mostrar errores. Este trabajo no necesita cambios de contrato ni desarrollo en el backend.

## Evidencia de esta etapa

Se revisaron rutas, providers, transporte, QueryCache, Sonner, campos y grupos comunes,
formularios/estados de las áreas del inventario, sus instrucciones y ejemplos de tests.
La documentación deja de recomendar errores generales encima de la botonera o un nuevo
FormError compartido. El inventario muestra por qué la aplicación todavía no cumple de manera
uniforme; escribir el contrato no se registra como una migración de esas pantallas.

Los checks de este turno validan documentación y el estado actual del front. Ningún resultado
de esos checks acredita controles de mensajes que aún no se implementaron.

- Enlaces: 98 referencias locales comprobadas en 14 documentos, sin destinos inexistentes.
- `git diff --check` para los archivos editados y revisión de espacios en los dos documentos nuevos: limpios.
- `npm run build` y `npm run lint`: correctos; `npm run test`: 68 archivos y 700 tests correctos.

Estos resultados corresponden a la etapa de diseño y plan. Las casillas de implementación
siguen pendientes; los tests actuales en verde no prueban la nueva política transversal.


## Avance de configuración (2026-09-30)

La extensión de Settings ya usa shared/ui/notifications.ts (cuatro severidades, duración,
cierre, id y acción), errorFeedback.ts (clasificación pura con campos/códigos aportados por
el consumidor) y createQueryClient. El arnés conserva los callbacks del QueryCache real.
Los tests de Settings cubren canal único, campos, borrador, conflicto, 500 después de commit,
permisos revocados, navegación y resultado tardío. Las capturas están en visual-baseline.md.

El inventario anterior describe el punto de partida: Configuración ya migró. Continúan
pendientes los otros consumidores, 429 centralizado, recuperación de cada flujo, sellado del
adaptador y controles de arquitectura para impedir imports directos de Sonner. meta.silent
se conserva solo por compatibilidad con consumidores auditados pendientes de migración.
