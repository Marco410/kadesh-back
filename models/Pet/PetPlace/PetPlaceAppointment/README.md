# Agenda (PetPlaceAppointment)

Citas/reservas de clientes hacia un `PetPlace` (veterinaria, refugio, hotel/guardería, groomer). Un solo modelo cubre tanto una cita puntual (una hora) como una estancia multi-día (check-in/check-out), usando un rango `startsAt`/`endsAt` en vez de un slot fijo.

No confundir con `models/Schedule/Schedule.ts` (`PetPlace.pet_place_schedules`), que es el **horario semanal de apertura** del negocio, no citas.

## Invariantes

- `access.ts`: el cliente solo ve/edita las citas donde `customer` es él mismo; el dueño solo ve/edita las de un `pet_place` donde `pet_place.user.id === session.userId` y `pet_place.verified === true`; platform admin ve/edita todo. `delete` es solo-admin (cancelar se hace con `status: cancelled`, no borrando la fila).
- `hooks.ts` `validateInput`: `endsAt` debe ser posterior a `startsAt`; en `create`, `startsAt` no puede ser pasado; el `customer` se auto-asigna al usuario en sesión y se rechaza si alguien intenta reservar a nombre de otro (excepto admin).
- No hay control de capacidad/disponibilidad ni prevención de doble-booking (v1 es solo CRUD + status). Queda como mejora futura.
- No hay mutations custom: `createOnePetPlaceAppointment`/`updateOnePetPlaceAppointment` generadas por Keystone alcanzan; `access.ts` + `validateInput` + el hook de correo cubren todo el flujo.
- `petName`/`petSpecies` son texto libre, no relación: no existe un modelo de "mascota propia del cliente" en este codebase (`models/Animal/` es para mascotas en adopción de refugios, no mascotas de clientes).

## Correo

`afterOperation` (fire-and-forget, nunca lanza error — try/catch que solo hace `console.error`) usa `sendPetPlaceAppointmentEmail` en `utils/helpers/sendgrid.ts`:
- `create` → notifica al dueño del `pet_place` (email del owner via `pet_place.user.email`).
- `update` con `status` cambiado a `confirmed`/`cancelled` (detectado vía `inputData`, no `originalItem` — Keystone no expone eso en `afterOperation`) → notifica al `customer`.
- Se salta silenciosamente si `isSmtpConfigured()` es falso (sin `MAILTRAP_API_TOKEN`/`SMTP_FROM`) o si falta el email destino.

## Decisiones

### 2026-09-17 — Nombre `PetPlaceAppointment`, no `PetPlaceSchedule`

Qué: el modelo se llama `PetPlaceAppointment`.

Por qué: ya existe `Schedule` (horario semanal de apertura, `PetPlace.pet_place_schedules`). Llamar `PetPlaceSchedule` a las citas habría colisionado conceptualmente con ese nombre.

Qué no hacer: no reusar `pet_place_schedules` como nombre de relación para citas; la relación de citas en `PetPlace` es `pet_place_appointments`.
