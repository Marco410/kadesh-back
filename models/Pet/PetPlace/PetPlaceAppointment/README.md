# Agenda (PetPlaceAppointment)

Citas/reservas de clientes hacia un `PetPlace` (veterinaria, refugio, hotel/guardería, groomer). Un solo modelo cubre tanto una cita puntual (una hora) como una estancia multi-día (check-in/check-out), usando un rango `startsAt`/`endsAt` en vez de un slot fijo.

No confundir con `models/Pet/Schedule/Schedule.ts` (`PetPlace.pet_place_schedules`), que es el **horario semanal de apertura** del negocio, no citas.

## Invariantes

- `access.ts`: el cliente solo ve/edita las citas donde `customer` es él mismo; el dueño solo ve/edita las de un `pet_place` donde `pet_place.user.id === session.userId` y `pet_place.verified === true`; platform admin ve/edita todo. `delete` es solo-admin (cancelar se hace con `status: cancelled`, no borrando la fila).
- `hooks.ts` `validateInput`: `endsAt` debe ser posterior a `startsAt`; en `create`, `startsAt` no puede ser pasado (el dueño sí puede agendar hoy aunque la hora ya haya pasado, no un día anterior); el `customer` se auto-asigna al usuario en sesión. Reservar a nombre de otro solo: admin, o dueño verificado eligiendo a alguien de `pet_place.patients`.
- No hay control de capacidad/disponibilidad ni prevención de doble-booking (v1 es solo CRUD + status). Queda como mejora futura.
- Mutations: el cliente usa `createPetPlaceAppointment` de Keystone; el dueño usa `createClinicAppointment` (paciente obligatorio, nace **confirmada**). `access.ts` + `validateInput` + el hook de correo cubren el resto.
- `petName`/`petSpecies` son texto libre, no relación: no existe un modelo de "mascota propia del cliente" en este codebase (`models/Pet/Animal/` es para mascotas en adopción de refugios, no mascotas de clientes).

## Correo

`afterOperation` (fire-and-forget, nunca lanza error — try/catch que solo hace `console.error`) usa `sendPetPlaceAppointmentEmail` en `utils/helpers/sendgrid.ts`:
- `create` por un cliente → notifica al dueño del `pet_place`.
- `create` por el dueño → notifica al paciente (si tiene correo); no se auto-notifica el dueño.
- `update` con `status` cambiado a `confirmed`/`cancelled` → notifica al `customer`.
- Se salta silenciosamente si `isSmtpConfigured()` es falso (sin `MAILTRAP_API_TOKEN`/`SMTP_FROM`) o si falta el email destino.

## Decisiones

### 2026-09-17 — Nombre `PetPlaceAppointment`, no `PetPlaceSchedule`

Qué: el modelo se llama `PetPlaceAppointment`.

Por qué: ya existe `Schedule` (horario semanal de apertura, `PetPlace.pet_place_schedules`). Llamar `PetPlaceSchedule` a las citas habría colisionado conceptualmente con ese nombre.

Qué no hacer: no reusar `pet_place_schedules` como nombre de relación para citas; la relación de citas en `PetPlace` es `pet_place_appointments`.
