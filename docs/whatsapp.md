# WhatsApp: puesta en marcha

Guía para que el sistema envíe por WhatsApp los avisos de las reservas (sección 11.3 de la spec).
Mientras esto no esté listo, el sistema funciona igual con `WHATSAPP_MODE=disabled`: los avisos
quedan registrados y los emails incluyen un botón para escribir por WhatsApp.

## Qué hace falta

1. El número de Thalia (+54 9 11 5847-0009) en la app **WhatsApp Business** (no en WhatsApp común).
2. Una cuenta de **Meta Business** (business.facebook.com), idealmente verificada.
3. Una app en **Meta for Developers** (developers.facebook.com) con el producto WhatsApp.
4. El número conectado a la plataforma en modo **coexistencia** (Thalia sigue usando la app normalmente).
5. Las 11 plantillas de abajo, aprobadas por Meta.
6. Un token de acceso permanente (usuario del sistema) y el ID del número.

## Variables de entorno

```env
WHATSAPP_MODE=cloud_api
WHATSAPP_PHONE_NUMBER_ID=<ID del número, desde WhatsApp Manager / API Setup>
WHATSAPP_ACCESS_TOKEN=<token permanente del usuario del sistema>
```

Si falta alguna, el sistema sigue en modo `disabled` sin romper nada.

## Plantillas

Todas con **categoría: Utilidad (Utility)** e **idioma: Español (Argentina) – es_AR**.
El nombre tiene que ser exactamente el indicado. Meta pide valores de ejemplo para cada variable.
El texto de cada una también está en `src/config/whatsapp-templates.ts`: si se cambia ahí, hay que
volver a aprobarla en Meta con el mismo texto.

### `turno_link_pago`

**Texto (cuerpo):**

```
Hola {{1}}! Reservaste {{2}} para el {{3}}. Para confirmar, transferí la seña de {{4}} y subí el comprobante acá: {{5}} ¡Gracias!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: miércoles 18 de noviembre, 09:00 hs
- {{4}}: $20.000
- {{5}}: https://turnos.ejemplo.com/turnos/pago/abc123

### `turno_mismo_dia_recibido`

**Texto (cuerpo):**

```
Hola {{1}}! Recibimos tu solicitud de {{2}} para hoy, {{3}}. Está pendiente de confirmación: no transfieras nada todavía. Te avisamos por acá.
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: lunes 9 de noviembre, 16:00 hs

### `turno_aprobado_link_pago`

**Texto (cuerpo):**

```
Hola {{1}}! Thalia confirmó {{2}} para el {{3}}. Para reservar, transferí la seña de {{4}} y subí el comprobante acá: {{5}} ¡Gracias!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Combo maquillaje + peinado
- {{3}}: sábado 5 de diciembre
- {{4}}: $120.000
- {{5}}: https://turnos.ejemplo.com/turnos/pago/abc123

### `turno_reenviar_comprobante`

**Texto (cuerpo):**

```
Hola {{1}}! Necesitamos que vuelvas a enviar el comprobante de la seña. Motivo: {{2}}. Subilo acá: {{3}} ¡Gracias!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: no se ve el monto
- {{3}}: https://turnos.ejemplo.com/turnos/pago/abc123

### `turno_confirmado`

**Texto (cuerpo):**

```
Listo {{1}}! Tu reserva de {{2}} para el {{3}} está confirmada. {{4}} Saldo: {{5}}. Ver o gestionar tu reserva: {{6}} ¡Te esperamos!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: miércoles 18 de noviembre, 09:00 hs
- {{4}}: Dirección: Talcahuano 123, 4° B, CABA.
- {{5}}: $30.000
- {{6}}: https://turnos.ejemplo.com/turnos/gestionar/abc123

### `turno_rechazado`

**Texto (cuerpo):**

```
Hola {{1}}. Lamentablemente tu reserva de {{2}} para el {{3}} no pudo confirmarse. {{4}} Gracias por tu comprensión.
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: miércoles 18 de noviembre, 09:00 hs
- {{4}}: Motivo: el dinero no ingresó

### `turno_vencido`

**Texto (cuerpo):**

```
Hola {{1}}. Tu reserva de {{2}} para el {{3}} venció y el lugar se liberó. Podés volver a reservar cuando quieras.
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: miércoles 18 de noviembre, 09:00 hs

### `turno_recordatorio`

**Texto (cuerpo):**

```
Hola {{1}}! Te recordamos {{2}}: {{3}}. {{4}} Ver tu reserva: {{5}} ¡Te esperamos!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: miércoles 18 de noviembre, 09:00 hs
- {{4}}: Dirección: Talcahuano 123, 4° B, CABA. Saldo: $30.000. Los turnos empiezan puntuales.
- {{5}}: https://turnos.ejemplo.com/turnos/gestionar/abc123

### `turno_reprogramado`

**Texto (cuerpo):**

```
Listo {{1}}! Tu turno de {{2}} quedó para el {{3}}. Ver tu reserva: {{4}} ¡Te esperamos!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: viernes 20 de noviembre, 11:00 hs
- {{4}}: https://turnos.ejemplo.com/turnos/gestionar/abc123

### `turno_cancelado`

**Texto (cuerpo):**

```
Hola {{1}}. Tu reserva de {{2}} para el {{3}} quedó cancelada. {{4}} Gracias por avisar.
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: Limpieza profunda Clásica
- {{3}}: miércoles 18 de noviembre, 09:00 hs
- {{4}}: La seña no se reintegra.

### `turno_reintegro_realizado`

**Texto (cuerpo):**

```
Hola {{1}}! Te transferimos el reintegro de la seña de {{2}}. ¡Gracias!
```

**Valores de ejemplo:**

- {{1}}: Lucía
- {{2}}: $20.000

