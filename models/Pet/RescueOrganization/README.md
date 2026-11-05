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

| Quién | `RescueOrganization` | Animales con `organization` |
|---|---|---|
| Público | Solo las `verified` | Leer (como todos los animales) |
| `admin` | Leer y editar el perfil; equipo | Publicar, editar, borrar |
| `coordinator` | Leer y editar el perfil | Publicar, editar, borrar |
| `volunteer` | Leer | Publicar y editar (no borrar) |
| `foster` | Leer | — |
| Admin de plataforma | Todo, incluidos `status`, `isAlly`, `allyOrder`, `slug`, `adminNotes` | Todo |

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

## Pendiente (siguientes fases)

- Ficha interna con cartilla (`Pet.organization`, etapas, hogar temporal).
- Convertir un reporte en mascota.
- Transferir la cartilla al adoptante.
- Solicitudes de adopción.
