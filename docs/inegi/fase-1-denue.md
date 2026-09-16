# Fase 1 — DENUE

Directorio de establecimientos. Dedupe por `CLEE`. Pasos de descarga CSV, import y llamadas del front: [uso.md](./uso.md).

## Vivo

`syncEstablishmentsFromInegi`: lat/lng/radio (metros, máx. 5000) o `stateCode` + municipio/SCIAN. Cap 250 por request.

`promoteInegiEstablishmentToLead`: 1 crédito si la company no tenía ese lead.

## Masivo

CSV desde [descarga masiva DENUE](https://www.inegi.org.mx/app/descarga/?ti=6). Probar primero un recorte:

```
head -n 5001 denue_inegi_09.csv > recorte.csv
pnpm inegi:import:denue -- --latin1 ./recorte.csv
```
