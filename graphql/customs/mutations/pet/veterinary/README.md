# Reclamo de veterinarias

Un dueño reclama la ficha pública, KADESH valida por WhatsApp y un admin marca **verificada**. Hasta entonces no puede editar datos públicos.

## Promesa

Que la clínica del directorio tenga horarios, teléfono y servicios reales, escritos por quien la opera. No prometemos fotos, anuncios ni ranking.

## Flujo

1. En `/veterinarias/{slug}`, **¿Es tu clínica?** Solo con sesión.
2. Deja rol (propietario / encargado / veterinario), teléfono y cómo comprobarlo.
3. `claimPetPlace` deja la ficha en `pending` y la vincula al usuario. No se verifica sola.
4. El front abre WhatsApp con los mismos datos para que el equipo los cruce.
5. Un admin marca `verified` en Keystone o llama `verifyPetPlace(approved: true)`. Recién ahí el dueño edita desde `/perfil?tab=clinics` (`updateMyPetPlace`).
6. `verifyPetPlace(approved: false)` rechaza, suelta al usuario y la ficha vuelve a poder reclamarse.

## Acceso

- `claimPetPlace` / `updateMyPetPlace`: sesión. Editar solo si `user` es el de la sesión **y** `verified`.
- `verifyPetPlace`: rol `admin` de plataforma.
- Copy público: nunca decimos Keystone, GraphQL ni el número interno del proceso. Sí “WhatsApp” porque es el canal que usa la persona.

## Campos en PetPlace

`claimStatus` (`unclaimed` | `pending` | `verified` | `rejected`), `verified`, `claimRole`, `claimPhone`, `claimNotes`, `claimedAt`. En la ficha pública: `phone`, `whatsapp`, `website`, `email`, `emergencies`, `parking`, `appointmentRequired`. Las redes van por `SocialMedia` (`pet_place_social_media`); `updateMyPetPlace` recibe `socialMedia` y reemplaza esas filas. El `user` es el solicitante/dueño (`User.pet_places`).
