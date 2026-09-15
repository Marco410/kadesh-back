# Fase 0 — Infraestructura

Cinco lists en `models/Tech/Inegi/`, cliente HTTP en `utils/inegi/`, tokens en `config/.env.template`.

El humano registra tokens en inegi.org.mx (DENUE e Indicadores son **independientes**) y corre `yarn migrate`. El agente no genera ni aplica migraciones.

Env (no fallan el boot de Keystone):

```
INEGI_DENUE_TOKEN=
INEGI_INDICADORES_TOKEN=
```

Access: query de catálogo abierta; create/update/delete `false`. Logs: query autenticada.
