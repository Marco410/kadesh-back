# Fase 3 — Marco geoestadístico

Sin PostGIS. Descarga + `ogr2ogr` + import: [uso.md](./uso.md).

El humano convierte el shapefile del MGN a GeoJSON y corre:

```
pnpm inegi:import:geo -- --level=municipio ./municipios.geojson
```

`--level` = `estado` | `municipio` | `localidad`. Se guarda `geometry` JSON. Point-in-polygon en Node queda fuera de esta fase.
