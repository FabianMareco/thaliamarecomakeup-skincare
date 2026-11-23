# Informe de auditoría de seguridad — Turnos Thalia Mareco

- **Fecha:** 23/11/2026
- **Alcance:** primera pasada (seguridad): fases 0 a 6 y 10 del prompt de auditoría v2. Legal, SEO y rendimiento (fases 7 a 9) quedan para una segunda pasada.
- **Rama:** `claude/new-session-psw1is` · PR [#5](https://github.com/FabianMareco/thaliamarecomakeup-skincare/pull/5)
- **Entorno de pruebas:** build de producción local contra los emuladores de Firebase, con datos de prueba. No se hizo ninguna prueba contra producción.

## Resumen del riesgo

| | Antes | Después |
|---|---|---|
| Nivel general | **Alto** | **Bajo** |
| Motivo | Datos de pacientes (nombre, teléfono, email) legibles sin iniciar sesión en dos páginas del panel. Next.js con avisos de seguridad que además cortaban el build. Sin cabeceras de seguridad. | Hallazgo crítico corregido y cubierto por un test. Next.js actualizado. Cabeceras activas. Quedan 8 avisos moderados de `firebase-admin` 13, aceptados hasta que exista una 14 compatible con Vercel. |

La base ya era sólida en casi todo lo demás: reglas de Firestore cerradas, sesión segura, montos calculados en el servidor, validación con zod, tokens HMAC y límites de intentos.

## Hallazgos críticos

1. **Datos de pacientes expuestos sin sesión (corregido).**
   - **Qué pasaba:** solo el layout del panel verificaba la sesión. Next.js renderiza las páginas en paralelo con el layout, así que un pedido sin sesión a `/panel/pacientes` o `/panel/reservas/[id]` recibía un 307 al login con los datos de la página en el cuerpo.
   - **Corrección:** cada página del panel llama a `requireAdmin()` antes de leer datos, y el test `src/app/panel/panel-guard.test.ts` lo exige para toda página futura.
   - **Verificado:** sin sesión no viaja ningún dato, tanto en pedido directo como en navegación RSC.
   - **Probablemente presente en producción hasta el deploy de este PR.**

## Detalle por punto

Estados: ✅ Ya estaba bien · 🔧 Arreglado · ⚠️ Pendiente manual · ➖ No aplica.

| # | Punto | Estado | Qué encontré | Qué hice | Archivos |
|---|---|---|---|---|---|
| 1 | Secretos en el frontend | ✅ / 🔧 | Build con valores marcadores en los 8 secretos: ninguno aparece en `.next/static` ni en `public`. Solo viaja la config pública de Firebase. | `import "server-only"` en los módulos que leen claves, para que una fuga futura frene el build (probado con una fuga simulada). | `src/server/env.ts`, `src/server/firebase.ts`, `vitest*.mts`, `package.json` |
| 2 | Variables de entorno | ✅ | `.env*` ignorado, `.env.example` sin valores reales, nada sensible con `NEXT_PUBLIC_`. | — | — |
| 3 | Secretos en el historial de Git | ✅ | gitleaks 8.24.3 (verificado por checksum) sobre 26 commits de todas las ramas: 0 hallazgos. | — | — |
| 4 | Archivos expuestos | ✅ | `public/` solo tiene las dos imágenes de las cards. Sin source maps, backups ni logs públicos. | — | — |
| 5 | Debug y logs | 🔧 | Errores genéricos para el usuario. Con WhatsApp en modo manual, cada aviso escribía el teléfono completo de la paciente en los logs. | `maskEmail` / `maskPhone` en los logs, con test. | `src/server/notify/providers.ts`, `providers.test.ts` |
| 6 | Autenticación | ✅ | Firebase Auth, sin contraseñas propias. El login exige inicio reciente y UID autorizado. | — | — |
| 7 | Cookies de sesión | ✅ | HttpOnly, Secure en producción, SameSite=Lax, 5 días, revocación comprobada en cada pedido y al cerrar sesión. | — | — |
| 8 | CSRF | ✅ | Server Actions con la protección de Next.js. Las APIs con cookie solo leen; la subida de comprobantes no usa cookie. | — | — |
| 9 | Recuperación de contraseña | ➖ | No hay recuperación propia. Cambiar la contraseña revoca las sesiones anteriores (Firebase). | — | — |
| 10 | Admin protegido en el servidor | 🔧 | Las 28 acciones y las 3 APIs del panel ya verificaban la sesión; las páginas no (hallazgo crítico). | `requireAdmin()` en las 8 páginas y test de regresión. | `src/app/panel/(app)/**/page.tsx`, `src/app/panel/panel-guard.test.ts` |
| 11 | Datos ajenos (IDOR) | ✅ | Un solo rol administrador. Cada token público da acceso solo a su reserva. | — | — |
| 12 | Links con token | ✅ | HMAC de 256 bits, búsqueda por hash, límite de intentos; un token inventado devuelve 404. | — | — |
| 13 | Endpoints internos (cron) | ✅ | `CRON_SECRET` comparado en tiempo constante; sin él o con uno falso, 401. | — | — |
| 14 | Base de datos | ✅ | Reglas de Firestore y Storage cerradas, probadas contra el emulador (lectura y escritura sin credenciales: 403). Con Admin SDK, la autorización está en el código (puntos 10 a 13). | — | — |
| 15 | Consultas seguras | ➖ | Sin SQL ni MongoDB. | — | — |
| 16 | Validación | ✅ | zod en el servidor para todas las entradas públicas y del panel. | — | — |
| 17 | XSS | ✅ | Sin HTML crudo; los emails y el `.ics` escapan los datos. Probado: un nombre con `<img src=x onerror=alert(1)>` se muestra como texto en el panel y en las páginas públicas, sin ejecutarse. | — | — |
| 18 | Subida de archivos | ✅ | Tipo real por magic bytes, 5 MB como máximo, límites por IP y por reserva, servido con `nosniff` y solo con sesión. Probado: texto disfrazado de `.jpg` y PDF de 6 MB rechazados. | — | — |
| 19 | Spam y abuso de formularios | 🔧 | Ya había honeypot, límite por IP y una sola reserva pendiente por persona en faciales. Maquillaje no tenía tope por destinatario. | Tope diario por email y teléfono (4 reservas, 3 solicitudes). Probado: la cuarta solicitud al mismo email se bloquea. | `src/app/turnos/actions.ts` |
| 20 | Pagos (transferencia) | ✅ | Montos desde la base. Probado: precio, seña y estado inyectados se ignoran. Solo el panel verifica señas. | — | — |
| 21 | HTTPS y HSTS | 🔧 | Vercel fuerza HTTPS. | HSTS explícito de 2 años. | `next.config.ts` |
| 22 | Cabeceras de seguridad | 🔧 / ⚠️ | No había ninguna. | nosniff, anti-iframe, Referrer-Policy, Permissions-Policy, COOP, sin X-Powered-By. CSP básica obligatoria y CSP completa en report-only (0 avisos en local con login real). | `next.config.ts` |
| 23 | CORS | ✅ | Sin cabeceras CORS: ningún otro sitio puede llamar la API desde el navegador. | — | — |
| 24 | Límite de peticiones | ✅ / 🔧 | En Firestore, válido entre instancias. | La subida de comprobantes responde 429 al superar el límite. | `src/app/api/turnos/comprobante/route.ts` |
| 25 | Registro y vigilancia | 🔧 / ⚠️ | No se registraban accesos rechazados. | Logs sin datos personales para acciones del panel sin sesión, cuentas sin acceso y límites superados. Alertas: pendiente manual. | `src/server/auth.ts`, `src/server/rateLimit.ts` |
| 26 | Dependencias vulnerables | 🔧 / ⚠️ | Había 33 avisos (4 altos) y Next.js cortaba el build. | Next.js 16.4.6, `npm audit fix` sin cambios de versión mayor, override de `@grpc/grpc-js`: 0 altos. Quedan 8 moderados en producción (cadena de `firebase-admin` 13, riesgo aceptado) y 11 en herramientas de desarrollo. | `package.json`, `package-lock.json` |
| 27 | Paquetes sin uso | ✅ / 🔧 | Ninguno sobrante. `@next/env` se usaba sin declarar. | Declarado como devDependency. | `package.json` |

### Pruebas de la fase 10 (local con emuladores)

| Prueba | Resultado esperado | Resultado |
|---|---|---|
| 7 páginas del panel sin sesión (pedido directo y navegación RSC) | Ningún dato de pacientes | ✅ Sin datos |
| APIs del panel y del cron sin sesión o sin secreto | 401 | ✅ 401 en las 4 |
| Token inventado en pago y gestión | 404 | ✅ 404 |
| Texto disfrazado de JPG | Rechazo | ✅ "tiene que ser una imagen o un PDF" |
| PDF de 6 MB | Rechazo | ✅ "supera los 5 MB" |
| Más de 10 subidas por hora desde una IP | 429 | ✅ 429 |
| Precio, seña y estado manipulados | Se ignoran | ✅ Valores reales |
| Payload XSS en el nombre | Se muestra como texto | ✅ Sin ejecución |
| 4 solicitudes de maquillaje al mismo email | La 4.ª bloqueada | ✅ 3 aceptadas, 4.ª bloqueada |
| Cabeceras de seguridad (`curl`) | Presentes | ✅ Las 8, sin X-Powered-By |
| Login real del panel con la CSP de prueba | Sin avisos | ✅ 0 avisos |

Verificación final: lint y tipos sin errores, 54 tests unitarios, 41 de integración y build de producción en verde.

## Pendientes manuales

1. **Publicar el PR #5.** Fusionarlo en `main`; Vercel despliega solo. Corrige el hallazgo crítico.
2. **Revisar si alguien aprovechó el error.** En Vercel → proyecto → Logs, filtrar por `/panel/pacientes` y `/panel/reservas` con respuesta 307 en fechas anteriores al deploy. Si aparecen IPs desconocidas, consultarlo con un profesional por la Ley 25.326.
3. **Activar la CSP completa.** Después del deploy, entrar al panel en la web real con la consola del navegador abierta (F12) e iniciar sesión. Si no aparece ningún aviso "Content Security Policy" / "Report Only", pasar la política completa de `Content-Security-Policy-Report-Only` a `Content-Security-Policy` en `next.config.ts`.
4. **Alertas (opcional).** Para avisos de errores 5xx o accesos rechazados, integrar Sentry (plan gratuito), porque el plan Hobby de Vercel guarda pocos logs.
5. **Volver a revisar `firebase-admin`.** Cuando salga una versión 14 compatible con Vercel, actualizar y correr `npm audit --omit=dev`.

## Claves a rotar

Ninguna: no se encontraron secretos en el código, el bundle ni el historial de Git.

## Riesgos aceptados

- 8 avisos moderados de la cadena de `firebase-admin` 13 (uuid, gaxios, retry-request y otros), en código que la app no usa. La corrección exige `firebase-admin` 14, que falla en Vercel con `ERR_REQUIRE_ESM`. Aceptado por Fabián el 23/11/2026, hasta que exista una 14 compatible.

## Notas fuera de seguridad

- Un PDF de entre 4,5 y 5 MB supera el límite de pedido de Vercel y muestra "El archivo es demasiado grande", aunque la pantalla dice "hasta 5 MB". Con fotos no pasa, porque se achican antes de subirse.
