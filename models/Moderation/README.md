# Moderación (Kadesh Pet)

App Store (1.2) y Google Play piden que el contenido de usuarios se pueda reportar y que se pueda bloquear a quien abusa. Aquí viven las dos piezas.

- `ContentReport`: reporte de un comentario de animal (`AnimalComment`), de blog (`PostComment`), de un reporte de animal (`Animal`) o de una persona (`User`). La app lo crea con `reportContent(entityType, entityId, reason, details)`. Se guarda el autor y una copia del texto (`excerpt`), por si después lo borran. Avisa a los admins de plataforma en la campana (`content.reported`). Por la API generada solo lo ven y cambian los admins. Repetir un reporte abierto no crea otro.
- `UserBlock`: con `blockUser(userId)` / `unblockUser(userId)` alguien deja de ver los comentarios de otra persona. La app filtra con la lista de sus bloqueos (`userBlocks`, cada quien ve solo los suyos).

Operaciones debe revisar los reportes abiertos en menos de 24 h: quitar el contenido (estado `resolved`, con nota) o descartarlo (`dismissed`).

Borrar cuenta: `deleteMyAccount(confirm: "ELIMINAR")` usa la misma anonimización que el ARCO de Operaciones (`utils/account/anonymizeUser.ts`). No aplica al equipo de Kadesh ni a cuentas de una empresa de Kadesh Negocios.
