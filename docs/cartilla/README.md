# Cartilla digital de la mascota (Fase 1)

Cada persona registra a sus mascotas, comparte la cartilla con su familia, lleva el control de salud (vacunas, desparasitaciones, consultas…) y recibe recordatorios antes de cada fecha. Una mascota registrada se reporta como perdida en un paso, con sus datos y fotos ya llenos.

La pantalla web es la pestaña **Mascotas** del perfil en kadesh-landing (`src/components/pets/`). La app móvil la implementa desde el prompt de `kadesh-landing/docs/mobile-sync/`.

## Listas

| List | Qué es | Dónde |
| --- | --- | --- |
| `Pet` | La mascota. Ya existía sin uso y se extendió. | `models/Pet/Pet.ts` |
| `PetOwner` | Dueño de una mascota: `principal` (uno) o `family`. | `models/Pet/PetOwner/` |
| `PetMultimedia` | Fotos de la mascota (R2, `s3_pets`). Ya existía; se le agregó `order`. | `models/Pet/PetMultimedia/` |
| `PetHealthRecord` | Registro de la cartilla. | `models/Pet/HealthRecord/` |
| `PetHealthRecordAttachment` | Foto de la cartilla física o de la receta (R2, `s3_pets`). | `models/Pet/HealthRecord/PetHealthRecordAttachment/` |
| `PetReminder` | Recordatorio con fecha, días de aviso y canales. | `models/Pet/Reminder/` |

Se reusan las listas que ya existían, sin duplicarlas:

| Para | List existente |
| --- | --- |
| Especie y raza | `AnimalType` y `AnimalBreed`, los mismos que usa un reporte |
| Veterinaria | `PetPlace` (un `PetPlaceType` con valor `veterinary`) |
| Reporte de perdida | `Animal`, `AnimalLog` y `AnimalMultimedia` |
| Citas | `PetPlaceAppointment` |

Campos nuevos en listas existentes:
- `Animal.pet`: la mascota que originó el reporte.
- `PetPlaceAppointment.pet`: opcional, así que las citas que ya existen no cambian.

Valores de los select (`models/Pet/constants.ts`):
- `Pet.status`: `active`, `lost`, `deceased`, `transferred`.
- `Pet.sterilized`: `yes`, `no`, `unknown`.
- `Pet.sex`: `male`, `female`, `unknown`, igual que `Animal`.
- `PetHealthRecord.type`: `vaccine`, `internal_deworming`, `external_deworming`, `consultation`, `surgery`, `medication`, `other`.
- `PetReminder.status`: `pending`, `sent`, `completed`, `cancelled`.
- `PetReminder.channels`: `push`, `whatsapp`, `email`.

Algunos nombres no son los del pedido original porque los campos de `Pet` ya existían:

| Pedido original | Campo |
| --- | --- |
| species | `animal_type` |
| breed | `animal_breed` |
| birthDate | `birthday` |
| photos | `multimedia` |

## Permisos

- **Cartilla:** `Pet` y todo lo que cuelga de ella (fotos, registros, adjuntos, recordatorios y la lista de dueños) solo lo leen, crean y editan sus dueños. Un admin de plataforma ve todo. Las reglas están en `models/Pet/Pet.access.ts`.
- **Borrar la mascota:** solo el principal.
- **Agregar familiares:** solo el principal, con `addPetFamilyMember` (ya tiene cuenta) o `registerPetFamilyMember` (no tiene cuenta).
- **Quitar familiares:** el principal. Un familiar también puede borrar su propia fila para salirse.
- **Exactamente un principal:** se crea solo con la mascota. `role` no se edita por API, la fila principal no se borra por API, y `PetOwner.validateInput` rechaza un segundo principal o una persona repetida.
- **Datos protegidos para los dueños:** `owners`, `lostReport`, `verifiedByVet`, `createdBy` y `sentAt` solo los escribe un admin o el servidor. `Pet.status` no entra ni sale de `lost` por API; para eso están las mutaciones.
- **Nada de la cartilla es público.** `PetOwner.userName` solo da el nombre del otro dueño; el `User` (correo, teléfono) sigue bajo su propio acceso. El reporte de perdida es público como siempre: muestra el teléfono que la persona eligió para el cartel. `Animal.pet` se resuelve con el acceso de `Pet`, así que es `null` para quien no es dueño.
- **Citas:** la mascota debe ser del cliente de la cita (la reserve él o su veterinaria). Si vienen vacíos, `petName` y `petSpecies` se llenan desde `Pet`, porque la veterinaria no puede leer la cartilla.

## Hooks

- **`Pet`:**
  - Al crearla, quien la registra queda como `PetOwner` principal.
  - Al borrarla se borran sus dueños, fotos, registros, adjuntos y recordatorios. Se hace con `db`, así que también se van las imágenes de R2.
  - Los reportes y las citas no se borran: la base deja `pet` en null (`ON DELETE SET NULL`).
- **`PetHealthRecord`**, sobre su recordatorio automático (1:1):
  - Con `nextDueDate` se crea el recordatorio: título `"<Tipo>: <nombre>"`, 3 días antes, canales push y correo.
  - Si cambian la fecha, el tipo o el nombre, se actualiza. Una fecha nueva lo regresa a `pending`.
  - Si quitan la fecha, se cancela si seguía pendiente.
  - Si se borra el registro, se borra el recordatorio.
- **`PetReminder`:** si cambia `dueDate`, vuelve a `pending`. Valida que tenga al menos un canal, que los días de aviso estén entre 0 y 60 y que el registro sea de la misma mascota.

## Mutaciones (`graphql/customs/mutations/pet/card/`)

- **`markPetAsLost(petId, lastSeenLocation, lastSeenDate, notes, contactPhone)`**
  - Llama al `createAnimalReport` de siempre, así que el reporte sale con el mismo slug, ciudad, validaciones, alerta de zona y aviso a Operaciones.
  - Copia hasta 3 fotos de la mascota al reporte (`s3_pets` → `s3_animals`). Las copia una por una y, si alguna falla, el reporte sigue.
  - Liga `Animal.pet` y `Pet.lostReport` y deja la mascota en `lost`.
  - `contactPhone` es opcional. Sin él se usa el teléfono del perfil; si tampoco hay, falla.
- **`markPetAsFound(petId)`**
  - Cierra el reporte como ya se hacía: agrega una bitácora `in_family` ("En familia") en el mismo lugar que la última.
  - Regresa la mascota a `active`. `Animal.pet` se queda como historial.
- **`addPetFamilyMember(petId, email)`:** solo el principal. Busca la cuenta por correo y la agrega como `family`. Si el correo no tiene cuenta, el error trae `extensions.code = "PET_FAMILY_USER_NOT_FOUND"` y el front ofrece registrarla.
- **`registerPetFamilyMember(petId, input: { name, lastName, email, phone, password })`:** solo el principal. Crea la cuenta de Pet con la contraseña que **él elige** (mínimo 8), la agrega como `family` y le manda `sendPetFamilyAccountEmail`: "<principal> te agregó a la cartilla de <mascota>; tu contraseña la eligió él, pídesela". El correo nunca lleva la contraseña. Si el correo ya tenía cuenta, solo la agrega y no toca su contraseña (`createdAccount: false`). Además del nuestro, le llega el correo de bienvenida genérico que manda `User` al crearse.
- **`sendDuePetReminders(secret)`:** la llama el cron. Ver abajo.

## Recordatorios

El workflow `.github/workflows/send-pet-reminders.yml` corre diario a las 15:00 UTC (09:00 en CDMX) y llama a `sendDuePetReminders` con `CRON_SECRET`. Usa los mismos secrets que los otros crons.

1. Busca los `PetReminder` en `pending` cuya fecha de aviso (`dueDate - notifyDaysBefore`) sea hoy en CDMX o antes, de mascotas `active` o `lost`. Toma hasta 500 por corrida.
2. Marca cada uno como `sent` **antes** de mandarlo, para que dos corridas no lo manden dos veces.
3. Lo manda con `sendReminderNotification` (`utils/pet/petReminders.ts`) a todos los dueños que no estén suspendidos ni anonimizados.
4. Si nada llegó y algún canal falló al mandar, lo regresa a `pending` para reintentarlo mañana.

| Canal | Cómo |
| --- | --- |
| `push` | `notify()` con el tipo `pet.reminder_due`: campana y push de la app (Expo). |
| `email` | `sendPetReminderEmail` (`utils/helpers/sendgrid.ts`), con la marca de Kadesh Pet. |

Los dos enlazan a la cartilla en la web: `{PET_FRONTEND_URL}/perfil?tab=pets&pet=<id>` (`petCardUrl` en `utils/pet/petCard.ts`), la pestaña Mascotas de kadesh-landing.
| `whatsapp` | **Pendiente de implementar.** Solo deja un log. Ver abajo. |

### Activar WhatsApp

El número de Kadesh ya manda WhatsApp, pero Meta exige una plantilla UTILITY aprobada por tipo de aviso. Para recordatorios:

1. Aprobar `kadesh_pet_recordatorio` (es_MX) en WhatsApp Manager, con 3 variables: mascota, recordatorio y fecha.
2. Agregarla a `WHATSAPP_TEMPLATES` (`utils/notifications/whatsapp.ts`) bajo `pet.reminder_due`.
3. En `sendWhatsappChannel` (`utils/pet/petReminders.ts`), llamar a `sendNotificationWhatsapp` con los dueños que tengan `whatsappNotifications` y `phone`.
4. Con la plantilla registrada, `notify` también la mandaría desde el canal `push`. Antes hay que darle a `notify` una opción para no mandar WhatsApp en esa llamada; si no, el aviso llega doble o por un canal que la persona no eligió.

## Migración (la corre una persona, no el agente)

1. `pnpm migrate --create-only`. Genera `migrations/<fecha>_<nombre>/migration.sql` sin aplicarlo.
2. En ese archivo, dentro del `-- AlterTable` de `"Pet"`, quita la línea `DROP COLUMN "user",`. Prisma la pone antes de crear `PetOwner`, y sin ella se perderían los dueños actuales.
3. Pega esto **al final** del archivo:

```sql
-- Backfill: el usuario actual de cada mascota pasa a ser su dueño principal.
INSERT INTO "PetOwner" ("id", "pet", "user", "role", "createdAt")
SELECT 'po_' || p."id", p."id", p."user", 'principal', COALESCE(p."createdAt", now())
FROM "Pet" p
WHERE p."user" IS NOT NULL;

ALTER TABLE "Pet" DROP COLUMN "user";
```

4. `pnpm migrate` para aplicarla.

Las mascotas que no tenían `user` quedan sin dueño y solo un admin las ve. El resto de la migración solo agrega columnas, tablas, índices y llaves (`ON DELETE SET NULL`), y vuelve opcional `Pet.birthday`.

## Ejemplos GraphQL

### Registrar una mascota

```graphql
mutation RegistrarMascota($data: PetCreateInput!) {
  createPet(data: $data) {
    id
    name
    status
    owners { role userName }
  }
}
```

```json
{
  "data": {
    "name": "Firulais",
    "animal_type": { "connect": { "id": "<id de AnimalType 'dog'>" } },
    "animal_breed": { "connect": { "id": "<id de AnimalBreed>" } },
    "sex": "male",
    "birthday": "2022-03-15",
    "color": "Café con blanco",
    "distinctiveMarks": "Mancha blanca en el pecho, oreja izquierda caída",
    "weightKg": "12.50",
    "sterilized": "yes",
    "microchipNumber": "985112003456789"
  }
}
```

Fotos: van multipart con `apollo-upload-client`, igual que las de un reporte.

```graphql
mutation SubirFotos($data: [PetMultimediaCreateInput!]!) {
  createPetMultimedias(data: $data) { id order image { url } }
}
```

```json
{ "data": [{ "pet": { "connect": { "id": "<petId>" } }, "order": 1, "image": { "upload": "<File>" } }] }
```

### Agregar una vacuna con próxima fecha

El recordatorio se crea solo y ya viene en la respuesta.

```graphql
mutation AgregarVacuna($data: PetHealthRecordCreateInput!) {
  createPetHealthRecord(data: $data) {
    id
    type
    name
    appliedDate
    nextDueDate
    reminder { id title dueDate notifyDaysBefore channels status }
  }
}
```

```json
{
  "data": {
    "pet": { "connect": { "id": "<petId>" } },
    "type": "vaccine",
    "name": "Rabia",
    "appliedDate": "2026-10-23",
    "nextDueDate": "2027-10-23",
    "veterinary": { "connect": { "id": "<PetPlace id>" } },
    "notes": "Lote 4471"
  }
}
```

Adjuntar la foto de la cartilla:

```graphql
mutation Adjuntar($data: PetHealthRecordAttachmentCreateInput!) {
  createPetHealthRecordAttachment(data: $data) { id image { url } }
}
```

### Listar mis mascotas con sus próximos recordatorios

Para alguien que no es admin, `pets` ya trae solo las suyas. El `where` sirve para que un admin vea solo las propias. `$me` es `authenticatedItem.id`.

```graphql
query MisMascotas($me: ID!) {
  pets(
    where: { owners: { some: { user: { id: { equals: $me } } } } }
    orderBy: { name: asc }
  ) {
    id
    name
    status
    animal_type { name }
    multimedia(orderBy: { order: asc }, take: 1) { image { url } }
    owners { role userName }
    reminders(
      where: { status: { equals: "pending" } }
      orderBy: { dueDate: asc }
      take: 3
    ) {
      id
      title
      dueDate
      notifyDaysBefore
      channels
    }
  }
}
```

### Marcar una mascota como perdida

```graphql
mutation MarcarPerdida(
  $petId: ID!
  $location: PetLastSeenLocationInput!
  $date: String!
  $notes: String
  $phone: String
) {
  markPetAsLost(
    petId: $petId
    lastSeenLocation: $location
    lastSeenDate: $date
    notes: $notes
    contactPhone: $phone
  ) {
    petId
    reportId
    slug
    url
  }
}
```

```json
{
  "petId": "<petId>",
  "location": { "lat": "19.4326", "lng": "-99.1332", "address": "Av. Juárez 10, Centro, Cuauhtémoc, CDMX" },
  "date": "2026-10-22",
  "notes": "Llevaba collar rojo. Se asusta con los coches.",
  "phone": "5512345678"
}
```

### Otras

```graphql
mutation YaRegreso($petId: ID!) { markPetAsFound(petId: $petId) { petId reportId } }

mutation AgregarFamiliar($petId: ID!, $email: String!) {
  addPetFamilyMember(petId: $petId, email: $email) { id role userName }
}

# Si addPetFamilyMember respondió PET_FAMILY_USER_NOT_FOUND
mutation RegistrarFamiliar($petId: ID!, $input: RegisterPetFamilyMemberInput!) {
  registerPetFamilyMember(petId: $petId, input: $input) { id role userName createdAccount }
}

# Salirse de una mascota (familiar) o quitar a un familiar (principal)
mutation QuitarDueno($id: ID!) { deletePetOwner(where: { id: $id }) { id } }
```

Probar el cron a mano:

```bash
curl -sS -X POST "$KADESH_API_URL" -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation(\$s:String!){sendDuePetReminders(secret:\$s){success message processed sent failed}}\",\"variables\":{\"s\":\"$CRON_SECRET\"}}"
```

## Pendiente y límites conocidos

- WhatsApp de recordatorios: ver "Activar WhatsApp".
- La campana de la web muestra `pet.reminder_due` como cualquier aviso (título, texto y enlace). Si se quiere un ícono propio, va en `kadesh/components/notifications`.
- Si alguien cierra el reporte desde la ficha del animal ("Agregar registro" → En familia) en vez de usar `markPetAsFound`, la mascota se queda en `lost`. El front de la cartilla debe usar la mutación.
- Las veterinarias todavía no leen la cartilla ni validan registros (`verifiedByVet`). Eso es la Fase 3.
- `PetOwner.validateInput` evita duplicados, pero la base no tiene un índice único `(pet, user)`. Keystone no maneja índices compuestos.
- **Pendiente: cambiar contraseña y "olvidé mi contraseña".** Un familiar registrado con `registerPetFamilyMember` entra con la contraseña que eligió el principal, y hoy no hay forma de cambiarla ni de recuperarla (no hay `passwordResetLink` en `auth/auth.ts`). Cuando exista, `sendPetFamilyAccountEmail` debe invitar a cambiarla. Detalle en `kadesh-landing/src/components/auth/README.md`.
