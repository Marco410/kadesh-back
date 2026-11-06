# Espacios de rescate (`RescueOrganization`)

Rescatistas independientes, refugios, hogares temporales, colectivos y asociaciones. Una persona activa su espacio desde el panel de pet.kadesh.com.mx (`/perfil?tab=rescate`). Ahí administra su equipo y los animales que publica a nombre de la organización.

## Lists

| List | Para qué |
|---|---|
| `RescueOrganization` | Perfil público, estado de verificación y campos de aliado. |
| `RescueOrganizationMember` | Equipo: `organization` + `user` + `role` (`admin`, `coordinator`, `volunteer`, `foster`). |
| `Animal.organization` | Animal publicado a nombre de la organización. `user` sigue siendo quien lo publicó. |

## Ciclo de vida

1. **Activar.** `activateRescueOrganization(input)` crea la organización en `pending` y deja a quien llama como `admin`. Avisa a los admins (`rescue.submitted`). El tope es de 3 espacios por persona. El logo y la portada se suben después con `updateRescueOrganization` (upload de Keystone).
2. **Verificar.** Un admin valida por WhatsApp y cambia `status` a `verified` en el admin de Keystone. El hook pone `verifiedAt` y avisa a los admins del espacio (`rescue.verified`). Con `rejected` o `suspended` también les avisa (`rescue.rejected`), con el motivo de `statusNote`.
3. **Aliado.** Un admin marca `isAlly` (y opcionalmente `allyOrder`). Solo se permite en organizaciones verificadas. Al dejar de estar verificada, deja de ser aliada sola. La consulta pública es `rescueAllies(take)`.

## Acceso

| Quién | `RescueOrganization` | Animales con `organization` | Fichas (`Pet.organization`) |
|---|---|---|---|
| Público | Solo las `verified` | Leer (como todos los animales) | — |
| `admin` | Leer y editar el perfil; equipo | Publicar, editar, borrar | Todo: crear, editar, borrar, hogar temporal, publicar, completar adopción |
| `coordinator` | Leer y editar el perfil | Publicar, editar, borrar | Igual que `admin` |
| `volunteer` | Leer | Publicar y editar (no borrar) | Crear, editar (etapa, cartilla) y publicar; no borra ni adopta |
| `foster` | Leer | — | Solo las que tiene asignadas (`fosterMember`): ver y actualizar la cartilla |
| Admin de plataforma | Todo, incluidos `status`, `isAlly`, `allyOrder`, `slug`, `adminNotes` | Todo | Todo |

- El equipo se escribe con `addRescueOrganizationMember`, `setRescueOrganizationMemberRole` y `removeRescueOrganizationMember`, siempre con sudo y validando el rol.
- Por API, la list de miembros solo la escribe un admin de plataforma.

## Decisiones

- **Mientras está en revisión, lo privado funciona y lo público no.** El acceso de lectura solo deja ver al público las organizaciones `verified`. Por eso `animal.organization` llega en `null` al público mientras siga `pending`, y la ficha muestra al autor como siempre. Al verificarse, todos sus animales anteriores ganan la tarjeta de la organización sin tocar nada. Esto evita organizaciones falsas pidiendo donativos con nuestro respaldo.
- **No reutilizamos `PetPlace` ni `SaasCompany`.**
  - `PetPlace` es un lugar del directorio, con un solo dueño. Muchos rescatistas no tienen instalación.
  - `SaasCompany` es el tenant de Negocios: una persona solo puede tener una, y la sesión depende de ella.
- **Se agrega gente solo por correo de una cuenta existente.** A diferencia de la familia de la cartilla, no se crean cuentas con contraseña elegida por otra persona. Buscar por correo dice si la cuenta existe, así que tiene un límite de 30 por hora (`rescue_member_user`).
- **Nunca se queda sin admin.** No se puede quitar ni degradar al último admin, y el último admin no se puede salir.
- **Reclamos.** Si alguien demuestra que un animal publicado por una organización es su mascota (`resolveAnimalClaim`), el reporte pasa a su nombre y deja de estar a nombre de la organización. El equipo (admin, coordinador, voluntario) puede responder los reclamos de sus animales.
- **Avisos.** Los comentarios y reclamos de un animal de la organización llegan también a sus admins y coordinadores (`reportAudienceWithTeam`).
- **Impacto.** `publishedCount`, `adoptedCount` e `inAdoptionCount` (y `rescueAllies`) usan el estado más reciente de la bitácora de cada animal, sin contar los reportes unidos a otro.

## Fichas internas (Fase 2)

Cada animal del espacio puede tener una **ficha**: una `Pet` con `organization`. Es la misma cartilla de las familias (fotos, registros de salud, recordatorios), sin dueños mientras está en el espacio.

- **Campos de `Pet`**: `organization` (se elige al crear; después solo cambia por mutación), `stage` (`PET_RESCUE_STAGE`: recién llegado, en tratamiento, en hogar temporal, listo para adopción, apartado, se queda), `intakeDate`, `fosterMember` (alguien del equipo), `publicReport` (su reporte público), `adoptedFromOrganization` y `adoptedAt` (historial de la familia), y el virtual `viewerRole`.
- **Acceso** (`Pet.access.ts` → `editablePetFilter`): dueños, o admin/coordinación/voluntariado del espacio, o el hogar temporal asignado. Aplica igual a fotos, registros, adjuntos y recordatorios.
- **Reglas** (`Pet.hooks.ts`): crear con `organization` exige ser del equipo (sin `foster`) y un espacio activo; etapa y fecha de llegada solo en fichas y solo las cambia ese equipo; el hogar temporal lo asignan admin y coordinación. Una ficha no crea dueño principal.
- **Mutaciones** (`graphql/customs/mutations/pet/rescue/rescuePets.ts`):
  - `convertAnimalToPet(animalId, organizationId?)`: de reporte a ficha (copia datos y fotos, liga `Animal.pet` y `Pet.publicReport`; si el reporte no era del espacio, queda a su nombre). Sin `organizationId` es «Se quedó conmigo»: la cartilla es de quien publicó el reporte y el reporte se cierra «En familia». Solo para reportes sin espacio.
  - `publishRescuePet(petId, status, location?, notes?)`: `in_adoption` o `rescued`. Si la ficha ya tiene reporte, le agrega la bitácora; si no, crea el reporte con `createAnimalReport` (WhatsApp del espacio, alerta de zona, sus fotos) a nombre del espacio. «En adopción» pone la etapa en «Listo para adopción».
  - `completeRescueAdoption(petId, email)`: admin y coordinación. El adoptante (cuenta existente, si no `RESCUE_ADOPTER_NOT_FOUND`) queda como principal; la ficha deja el espacio (`organization`, etapa y hogar temporal en null; `adoptedFromOrganization` y `adoptedAt` quedan); el reporte recibe la bitácora «Adoptado». Le llega `pet.adoption_completed`.
- **Recordatorios**: los de una ficha le llegan a admin y coordinación del espacio y al hogar temporal asignado, con enlace a la ficha en el panel (`rescuePetCardUrl`). Al adoptarse, los pendientes pasan al adoptante.

Decisiones de la Fase 2:

- **Sin dueños mientras está en el espacio.** Si quien la creó fuera principal, al salirse del equipo se llevaría la ficha. El acceso por rol se corta solo al quitar a alguien del equipo (y quitar al miembro deja `fosterMember` en null).
- **Al adoptarse, el espacio deja de verla.** La cartilla es privada de la familia; el seguimiento después de la adopción será otra fase, con su permiso.
- **Adoptante con cuenta existente.** Igual que el equipo: no se crean cuentas a nombre de otros.
- **«Perdido» sigue siendo de la cartilla familiar** (`markPetAsLost`); una ficha se publica en adopción o como rescatado.

## Solicitudes de adopción y traspasos (Fase 3)

**Solicitudes** (`models/Pet/Animal/AdoptionApplication/`, mutaciones en `graphql/customs/mutations/pet/adoptionApplications.ts`). Sirven para cualquier animal «En adopción», sea de un espacio o de una persona.

- **Enviar** (`submitAdoptionApplication`), con sesión:
  - El último estado del animal debe ser `in_adoption`, y quien lo publicó (o su equipo) no puede solicitarlo.
  - Una solicitud abierta por persona y animal; tope de 10 al día (`adoption_application_user`).
  - Pide teléfono, por qué quiere adoptarlo y un cuestionario (`answers`): vivienda, si es propia o rentada (y si permiten mascotas), patio, niños, otros animales, horas solo y experiencia. También dos compromisos obligatorios: esterilizar y aceptar seguimiento.
  - Se copian el nombre y el correo de quien la envía: quien revisa no puede leer su `User`.
  - Avisa a quien publicó al animal y a admin/coordinación del espacio (`adoption.application_received`).
- **Revisar** (`reviewAdoptionApplication`): «En revisión», «Aprobada» o «No aprobada», con un mensaje opcional que le llega a quien la envió (`adoption.application_updated`). Lo hace quien puede editar al animal.
- **Retirar** (`withdrawAdoptionApplication`): quien la envió.
- **Completar** (`completeAdoptionApplication`): solo desde «Aprobada». En un espacio lo hacen admin y coordinación; si no, el autor del reporte.
  - Si el animal ya tiene cartilla, pasa al adoptante: la ficha del espacio, o la cartilla del autor si él es el principal.
  - Si no tiene, se crea una en la cuenta del adoptante con los datos y fotos del reporte.
  - El reporte queda «Adoptado», la solicitud «Adoptó» y las demás abiertas «Cerrada», con un aviso amable a cada quien.
- **Estados**: `submitted`, `in_review`, `approved`, `rejected`, `withdrawn`, `completed` y `closed`. Abiertas: las tres primeras.
- **Acceso**: la ven quien la envió, quien puede editar al animal y un admin de plataforma. Por API solo la escribe un admin.

**Traspaso con código** (`PetTransfer`): ver `docs/cartilla/README.md` («Traspasos»). Para un espacio es otra forma de entregar al animal: admin o coordinación generan el código desde la ficha y quien adopta lo escribe en su cuenta. Funciona igual que `completeRescueAdoption`, sin que el espacio tenga que conocer su correo.

Cuando el animal encuentra familia por cualquier vía (solicitud, código o correo), las solicitudes abiertas se cierran (`settleApplicationsAfterAdoption`) y los códigos sin usar de esa mascota se cancelan.

## Pendiente (siguientes fases)

- Seguimiento después de la adopción (con permiso del adoptante).
- Reportar como perdido un animal de una ficha (hoy solo la cartilla familiar).
