# Catálogo de servicios (PetPlaceService)

Lista global de lo que una clínica puede marcar en su ficha. No es un servicio “de esta clínica”: es el catálogo. La ficha publica los que el dueño marcó.

## Promesa

El dueño elige de una lista revisada. Si no está lo que ofrece, lo pide; un admin lo acepta y recién ahí aparece para marcarlo (y se le conecta a esa clínica).

## Estados

- **Aprobado** (`approved`) + `active`: sale en el buscador del dueño y puede ir a la ficha pública.
- **Pendiente** (`pending`): lo pidió un dueño verificado (`requestPetPlaceService`). `active` queda en falso. No sale en el catálogo ni en la ficha.
- **Rechazado** (`rejected`): tampoco sale.

Los servicios sembrados nacen aprobados. Si alguien que no es admin crea una fila por GraphQL, el hook la deja pendiente.

Al pasar de pendiente a aprobado, el hook marca `active` y conecta el servicio a la clínica `requestedFor`.

## Correo

Cada solicitud manda correo a `SMTP_ADMIN_NOTIFICATION_EMAILS`. Aprobar o rechazar es en Keystone, en esta lista.

## Qué no va aquí

Nombres libres escritos directo en la ficha. Horarios (`Schedule`). Citas (`PetPlaceAppointment`).
