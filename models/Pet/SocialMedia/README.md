# Redes de la clínica (SocialMedia)

Una clínica puede tener varias redes. No se duplican como columnas en `PetPlace`.

## Por qué

Facebook, Instagram, X, LinkedIn y TikTok viven aquí (`social_media` + `link` + `pet_place`). Teléfono, WhatsApp, sitio y correo siguen en la ficha (`PetPlace`).

## Qué no va aquí

No agregar `instagram` / `facebook` (ni equivalentes) a `PetPlace`. El dueño reemplaza estas filas juntas desde `updateMyPetPlace.socialMedia`.
