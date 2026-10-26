# Turnos Thalia Mareco (Skincare + Makeup)

Sistema de reservas: las clientas reservan tratamientos faciales o solicitan fecha de maquillaje, transfieren la seña y suben el comprobante; Thalia verifica y gestiona todo desde un panel pensado para el celular.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Firebase (Firestore, Storage, Auth) con Admin SDK · Resend · WhatsApp Cloud API · date-fns + @date-fns/tz.

## Rutas

| Ruta | Para qué |
|---|---|
| `/turnos` | Entrada: tratamientos faciales o maquillaje |
| `/turnos/estetica` | Reserva skincare (servicio → día y horario → datos → confirmar) |
| `/turnos/maquillaje` | Catálogo y solicitud de maquillaje |
| `/turnos/pago/[token]` | Datos de transferencia y carga del comprobante |
| `/turnos/gestionar/[token]` | Estado, reprogramación y cancelación por la clienta |
| `/panel` | Panel de Thalia (pendientes, agenda, horarios, clientas, servicios, configuración) |
| `/api/cron/tick` | Tarea programada (cada 15 min, `Authorization: Bearer $CRON_SECRET`) |

## Estructura

```
src/lib/domain/     Reglas de negocio puras y testeadas (estados, 48 hs, seña, agenda, recordatorios)
src/server/flows/   Flujos transaccionales (reserva, comprobantes, panel, gestión, maquillaje, cron, horarios)
src/server/notify/  Contenido y envío de notificaciones (email + WhatsApp) con log en Firestore
src/server/payments PaymentMethod (hoy solo transferencia con verificación manual)
src/config/         Plantillas de WhatsApp (nombres y variables)
scripts/            seed y alta de administradoras
```

Todo acceso a datos es del lado del servidor (Admin SDK). Las reglas de Firestore y Storage niegan todo acceso directo.

## Desarrollo local (con emuladores)

Requiere Node 20+ y Java (para los emuladores de Firebase).

```bash
npm install
cp .env.example .env.local      # completar; ver bloque "emuladores" al final
npm run emulators               # en otra terminal
npm run seed                    # configuración + catálogo
npm run create-admin -- thalia@ejemplo.com 'contraseña'   # muestra el UID → ADMIN_UIDS
npm run dev
```

## Tests

```bash
npm test            # lógica de negocio (rápido, sin Firebase)
npm run test:int    # flujos completos contra los emuladores (concurrencia, vencimientos, 48 hs, maquillaje, cron…)
npm run lint && npm run typecheck
```

## Producción

1. Proyecto de Firebase con Firestore, Storage y Auth (proveedor email/contraseña). Publicar reglas: `npx firebase deploy --only firestore:rules,storage`.
2. Cuenta de servicio → `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`.
3. Variables de `.env.example` en Vercel, más **`LINK_SECRET`** (cadena aleatoria larga; ver abajo).
4. Resend con el dominio `thaliamarecomakeup.com.ar` verificado → `RESEND_API_KEY`.
5. `npm run seed` apuntando a producción (con `SEED_PRIVATE_ADDRESS` y `SEED_NOTIFICATION_EMAIL`) y `npm run create-admin`.
6. **Cron cada 15 minutos.** Vercel Hobby solo permite crons diarios. Opciones:
   - Vercel Pro: agregar `vercel.json` con `{"crons":[{"path":"/api/cron/tick","schedule":"*/15 * * * *"}]}` (Vercel manda `CRON_SECRET` solo).
   - Programador externo (ej. cron-job.org): `GET https://<dominio>/api/cron/tick` con header `Authorization: Bearer <CRON_SECRET>`.
7. WhatsApp: mientras Meta no apruebe el número y las plantillas, dejar `WHATSAPP_MODE=disabled` (solo se registra en el log; los emails incluyen botón de WhatsApp). Las plantillas a dar de alta (Utility, `es_AR`) están en `src/config/whatsapp-templates.ts` con su texto de referencia.

### Notas técnicas

- **Links de pago/gestión:** el token es un valor de 32 bytes base64url derivado con HMAC (`LINK_SECRET`) del id de la reserva. En la base solo se guarda su hash SHA-256, y el servidor puede volver a armar el link en cada recordatorio. Cambiar `LINK_SECRET` invalida los links ya enviados.
- **Comprobantes:** el archivo pasa por el servidor, que valida el tipo real (JPG/PNG/WEBP/PDF) y el tamaño (5 MB). Vercel limita el cuerpo de una request a ~4,5 MB, por eso el navegador achica antes las fotos grandes. Thalia los ve con una URL firmada de 5 minutos.
- **Recordatorios:** el cron "reclama" cada recordatorio en una transacción antes de enviarlo, así ejecuciones solapadas no duplican. Si fallan todos los canales, libera el reclamo para reintentar.
