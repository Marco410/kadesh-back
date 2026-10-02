# MetaDataDeletionRequest

Registro de cada callback de eliminación de datos que Meta manda a `POST /webhooks/meta/data-deletion`. El contrato HTTP está en [`docs/meta/data-deletion.md`](../../../docs/meta/data-deletion.md).

## Invariantes

- El Admin UI solo lo lee y edita un `ADMIN` (`hasRole`). Crear desde GraphQL está cerrado: el webhook inserta con `context.sudo()`.
- `confirmationCode` es único y es lo único que identifica la solicitud en el `GET` público. Ese JSON no incluye `metaUserId` ni `notes`.
- `metaUserId` es el `user_id` app-scoped del `signed_request`. Hoy no hay otra list que lo guarde.
- `deleteMetaUserData` en `webhooks/metaDataDeletion.ts` no borra filas: no existe Facebook Login. Al completar, el webhook marca `status = completed`.

## Decisiones

### 2026-10-02 — Callback de eliminación para App Review

Qué: lista nueva para el Data Deletion Request Callback de la app de Meta de Kadesh. Hace falta para pasar a Live.

Por qué: Meta exige una URL que reciba `signed_request`, confirme con un código y permita consultar el estado sin datos personales.

Qué no hacer: no abrir `query` al público vía GraphQL; el estado público es solo el GET del webhook. No guardar el `signed_request` crudo.
