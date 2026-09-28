## Release: `develop` → `main`

Este PR se genera automáticamente cuando hay commits en `develop` que aún no están en `main`.

### Antes de mergear
- [ ] El CI de este PR está en verde
- [ ] Probaste lo crítico en el entorno de `develop` / staging
- [ ] Si hay migraciones Prisma nuevas, confirmais que ya corrieron (o van a correr) en prod

### Flujo
1. Features → PR a **`develop`**
2. CI pasa en `develop`
3. Este PR promueve a **`main`** (producción)
4. Despliegue de Railway / hosting ligado a `main`
