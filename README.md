# Kadesh Keystone Project

Run

```
pnpm dev
```

## Storage (R2)

Uploads van a **Cloudflare R2** vía el adapter S3 de Keystone (`kind: "s3"`). Los nombres de storage (`s3_pets`, `s3_profile`, …) no se cambian: Postgres guarda el filename, no la URL.

### Invariantes

- Bucket privado + URLs firmadas (`signed.expiry` 1h). No hay ACL `public-read`.
- Con `S3_ENDPOINT` se usa R2 (`forcePathStyle: true`, `S3_REGION=auto`). Sin endpoint, Keystone habla con AWS S3.
- Sin `S3_ACCESS_KEY_ID` / secret, el fallback es disco local (`public/images`).
- Prefixes: `ENVIROMENT=DEV` (case-insensitive) → `dev/<area>/`; si no, `<area>/`.
- Copiar objetos S3→R2 debe preservar esas keys. No hay migración Prisma.

### Decisiones

#### 2026-09-21 — S3 AWS → Cloudflare R2

Qué: mismo `kind: "s3"` con `S3_ENDPOINT` de la cuenta (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`) y `forcePathStyle`. Bucket R2 `kadesh-group` (ENAM). Credenciales = token R2 Object Read & Write, no keys de AWS.

Qué no hacer: no renombrar storages en los modelos; no exponer el bucket como público mientras haya `signed`; no meter el nombre del bucket en el endpoint.
