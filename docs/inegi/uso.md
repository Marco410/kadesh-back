# Cómo usar INEGI en Kadesh

Guía para humanos (ops) y para `kadesh-business` (front). El catálogo es **compartido** (no es de un tenant). La empresa solo entra al **promover** un establecimiento a lead.

Endpoint GraphQL: `POST /api/graphql` del Keystone (`pnpm dev`). Misma cookie de sesión que el resto del CRM.

No hay cron. El catálogo se llena con mutación puntual o con scripts que corre un humano.

```text
Ubicación del usuario
    → syncLeadsFromInegi (mapa, igual que syncLeadsFront)
    → TechBusinessLead de la company

INEGI (CSV / API)
    → catálogo TechInegi*  →  listar / promote uno a uno
                           →  generateMarketInsight
```

## 1. Una vez (humano)

1. Registra **dos** tokens (son independientes) en el sitio de INEGI:
   - DENUE: [api_denue](https://www.inegi.org.mx/servicios/api_denue.html)
   - Indicadores: [api_indicadores](https://www.inegi.org.mx/servicios/api_indicadores.html)
2. Cópialos a `config/.env.dev`:

```
INEGI_DENUE_TOKEN=...
INEGI_INDICADORES_TOKEN=...
```

3. Corre `yarn migrate` si aún no aplicaste las lists INEGI.
4. `pnpm dev`.

Sin token, Keystone **sí** arranca. Fallan las mutaciones/scripts que pegan a INEGI.

## 2. Cómo sacar el CSV del DENUE

Los dumps nacionales no salen por GraphQL. INEGI los publica como datos abiertos.

1. Entra a [Descarga masiva INEGI](https://www.inegi.org.mx/app/descarga/?ti=6) (tema DENUE).
2. Elige la edición más reciente (p. ej. DENUE 05/2025) y formato **CSV**.
3. Descarga **por entidad** (recomendado) o el nacional. El nacional son varios GB.
4. El zip trae uno o más `.csv`. Diccionario oficial: [denue_diccionario_de_datos.pdf](https://www.inegi.org.mx/contenidos/masiva/denue/denue_diccionario_de_datos.pdf).
5. Términos de uso: [inegi.org.mx/inegi/terminos.html](https://www.inegi.org.mx/inegi/terminos.html). Hay que citar fuente INEGI.

Columnas que el importador lee (nombres del CSV masivo, **no** los de la API):

| CSV                                                                    | Campo en Kadesh                       |
| ---------------------------------------------------------------------- | ------------------------------------- |
| `CLEE`                                                                 | `clee` (unique, obligatorio)          |
| `Nom_Estab`                                                            | `name`                                |
| `Raz_Social`                                                           | `legalName`                           |
| `Codigo_Act` / `Nombre_Act`                                            | giro SCIAN                            |
| `Per_Ocu`                                                              | `employeeStratum`                     |
| `Nom_Vial` / `Numero_ext` / `Numero_int` / `Nomb_asent` / `Cod_Postal` | dirección                             |
| `Entidad` / `Municipio` / `Localidad`                                  | `state` / `municipality` / `locality` |
| `Telefono` / `Correo_e` / `WWW`                                        | contacto                              |
| `Latitud` / `Longitud`                                                 | `lat` / `lng`                         |

Fila sin `CLEE` o sin `Nom_Estab` se omite.

Los CSV de INEGI suelen ir en **latin1**. Si ves mojibake (`Ã±`), usa `--latin1`.

### Recorte de prueba (no el nacional)

```bash
# primeras 5000 filas + header
head -n 5001 denue_inegi_09.csv > recorte_09.csv
pnpm inegi:import:denue -- --latin1 ./recorte_09.csv
```

Correr dos veces el mismo archivo: la segunda solo actualiza (dedupe por `clee`).

## 3. Importar (scripts, solo humano)

No están expuestos como mutación (volumen + GraphQL síncrono).

```bash
# DENUE
pnpm inegi:import:denue -- ./recorte_09.csv
pnpm inegi:import:denue -- --latin1 ./denue_inegi_09.csv

# Indicadores BIE cacheados (catálogo de IDs + estados 01–32, o uno)
pnpm inegi:import:indicadores
pnpm inegi:import:indicadores -- 09

# Marco geoestadístico (GeoJSON, no shapefile)
pnpm inegi:import:geo -- --level=estado ./estados.geojson
pnpm inegi:import:geo -- --level=municipio ./municipios.geojson
pnpm inegi:import:geo -- --level=localidad ./localidades.geojson
```

Shapefile del [Marco Geoestadístico](https://www.inegi.org.mx/temas/mg/) → GeoJSON (el repo no lee `.shp`):

```bash
ogr2ogr -f GeoJSON municipios.geojson conjunto_de_datos/00mun.shp
```

Cada corrida DENUE deja un `TechInegiSyncLog` (`sourceMethod: bulk_import`).

## 4. “Exportar”

No hay script de dump CSV. El catálogo se **lee** así:

| Canal    | Qué                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Front    | queries Keystone `techInegiEstablishments` / `techInegiIndicators` / `techInegiGeoBoundaries` (abajo) |
| Admin UI | lists `TechInegi*`                                                                                    |
| Ops      | SQL/`pg_dump` de esas tablas si hace falta un archivo                                                 |

Create/update/delete de las lists por GraphQL CRUD están **cerrados**. Escribir solo vía mutaciones custom o scripts.

## 5. Flujos de producto (front)

### A. Mapa: mismos leads que Google, fuente INEGI

El toggle del front: `syncLeadsFront` (Google) o `syncLeadsFromInegi` (DENUE). Mismo input (`lat`, `lng`, `radius` en **km**, `category`, `maxResults`). Mismas reglas de créditos.

`category` no es un código SCIAN. El dropdown INEGI usa [`utils/constants/inegiDenueCategories.ts`](../../utils/constants/inegiDenueCategories.ts): mismos `label` que Google, `value` ASCII que **aparece en el título SCIAN** (`laboratorios`, no `diagnostico`; `medicina`, no `médicos`). DENUE `Buscar` no quita tildes: `diagnostico` no pega con “diagnóstico”. Si el front manda el value de Google (`negocios locales`, `médicos`, `laboratorios`) o el value viejo `diagnostico`, el backend lo traduce. Catch-all no filtra por giro y pega a DENUE con `todos`.

```graphql
mutation SyncLeadsInegi {
  syncLeadsFromInegi(
    input: {
      lat: 19.4326
      lng: -99.1332
      radius: 2
      category: "veterinaria"
      maxResults: 20
    }
  ) {
    success
    message
    created
    alreadyInDb
    syncedLeadsCount
    syncedCount
    leadLimit
  }
}
```

Radio del mapa puede ser > 5 km (filtra el catálogo en BD). La API DENUE en vivo no pasa de **5 km**.

### B. Buscar en el catálogo y promover uno a uno

1. Listar/filtrar establecimientos (query de list, sin créditos).
2. Si la zona está vacía: `syncEstablishmentsFromInegi` (sesión; **no** cobra créditos; tope 250).
3. `promoteInegiEstablishmentToLead` (1 crédito si esa company aún no tenía el lead).

Códigos DENUE: entidad `01`–`32` (`09` = CDMX). Municipio suele ser 3 dígitos.

### C. Contexto de mercado + Cerebro

1. `fetchInegiIndicator` para cachear BIE (`00` nacional, `09` estado, `09015` municipio).
2. Query `marketInsight` (caché del mes). Si no hay: `generateMarketInsight` (créditos de **IA** managed, no de sync).

IDs de arranque (`utils/inegi/indicatorCatalog.ts`): `1002000001` población total, `6207019034` unidades económicas, `6207061840` PIB, etc.

## 6. GraphQL — queries de catálogo (Keystone)

Lectura abierta. Paginar siempre (`take`). No pedir `rawPayload` ni `geometry` en listados.

```graphql
query BuscarDenue($municipio: String!, $estado: String!) {
  techInegiEstablishments(
    where: {
      AND: [
        { municipality: { contains: $municipio } }
        { state: { contains: $estado } }
      ]
    }
    take: 50
    skip: 0
    orderBy: [{ name: asc }]
  ) {
    id
    clee
    name
    legalName
    phone
    email
    website
    street
    exteriorNumber
    neighborhood
    postalCode
    locality
    municipality
    state
    lat
    lng
    employeeStratum
    lastSyncedAt
    economicActivity {
      id
      scianCode
      name
    }
  }
  techInegiEstablishmentsCount(
    where: {
      AND: [
        { municipality: { contains: $municipio } }
        { state: { contains: $estado } }
      ]
    }
  )
}

query Establecimiento($id: ID!) {
  techInegiEstablishment(where: { id: $id }) {
    id
    clee
    name
    lat
    lng
    economicActivity {
      scianCode
      name
    }
  }
}

query IndicadoresZona($geo: String!) {
  techInegiIndicators(
    where: { geographicCode: { equals: $geo } }
    take: 40
    orderBy: [{ fetchedAt: desc }]
  ) {
    id
    indicatorId
    indicatorName
    geographicLevel
    geographicCode
    period
    value
    unit
  }
}
```

Unique: `techInegiEstablishment(where: { clee: "..." })`.

## 7. GraphQL — mutaciones custom

Todas menos el listado: **usuario autenticado**. Promover y mercado: además tenant / `canUseCompanyAi`.

### Poblar catálogo (sin créditos)

Una de las dos formas: **lat+lng** o **stateCode**.

```graphql
mutation SyncDenueMapa {
  syncEstablishmentsFromInegi(
    input: {
      lat: 19.4326
      lng: -99.1332
      radiusMeters: 1000
      keyword: "veterinaria"
      maxResults: 50
    }
  ) {
    success
    message
    created
    updated
    alreadyInDb
    totalFetched
  }
}

mutation SyncDenueArea {
  syncEstablishmentsFromInegi(
    input: {
      stateCode: "09"
      municipalityCode: "015"
      scianCode: "541940"
      maxResults: 100
    }
  ) {
    success
    message
    created
    updated
    totalFetched
  }
}
```

### Promover a CRM (1 crédito si es asignación nueva)

```graphql
mutation PromoverDenue($establishmentId: ID!, $sellerId: ID) {
  promoteInegiEstablishmentToLead(
    input: { establishmentId: $establishmentId, assignedSellerId: $sellerId }
  ) {
    success
    message
    businessLeadId
    creditsCharged
  }
}
```

- `creditsCharged: 1` → lead nuevo o recién conectado a la company.
- `creditsCharged: 0` → ya era lead de esa company.
- `companyId` solo lo usa el admin de plataforma; el resto va con la company de sesión.
- Lead queda `source: "INEGI"`, `sourceEstablishment`, pipeline `01 - Detectado`.

Si `success: false`, mostrar `message` (sesión, cuota, token, establecimiento inexistente).

### Indicador BIE (sin créditos de sync)

```graphql
mutation TraerPoblacionCdmx {
  fetchInegiIndicator(
    input: { indicatorId: "1002000001", geographicCode: "09", recent: true }
  ) {
    success
    message
    created
    updated
    indicators {
      cacheKey
      indicatorName
      period
      value
      unit
      geographicLevel
    }
  }
}
```

### Análisis de mercado (créditos IA si managed y no hay caché)

```graphql
query VerMercado($companyId: ID!) {
  marketInsight(
    companyId: $companyId
    state: "Ciudad de México"
    municipality: "Benito Juárez"
    activity: "veterinaria"
    geographicCode: "09014"
  ) {
    success
    message
    cached
    creditsCharged
    insight {
      id
      referenceKey
      summary
      content
      generatedAt
      actions {
        title
        detail
      }
    }
  }
}

mutation GenerarMercado($companyId: ID!, $force: Boolean) {
  generateMarketInsight(
    companyId: $companyId
    state: "Ciudad de México"
    municipality: "Benito Juárez"
    activity: "veterinaria"
    geographicCode: "09014"
    force: $force
  ) {
    success
    message
    cached
    creditsCharged
    insight {
      id
      referenceKey
      summary
      generatedAt
      actions {
        title
        detail
      }
    }
  }
}
```

Caché: `company + kind:market_analysis + estado:municipio:actividad:YYYY-MM` (zona `America/Mexico_City`). Segundo call el mismo mes → `cached: true`, `creditsCharged: 0`. `force: true` regenera y vuelve a cobrar IA.

`state` / `municipality` / `activity` filtran la **muestra DENUE** por texto. `geographicCode` es para cruzar indicadores BIE ya cacheados.

## 8. Qué no hacer desde el front

- No llamar `createTechInegiEstablishment` / `update` / `delete` de lists: access lo niega.
- No mandar el CSV por GraphQL.
- No sync nacional por `syncEstablishmentsFromInegi` (cap 250). Eso es el script.
- El mapa usa `syncLeadsFromInegi`, no un loop de `promoteInegiEstablishmentToLead`.
- No asumir que `importBusinessLeadFromGoogle` y promover DENUE cobran igual: Google import **no** cobra; promover DENUE **sí**, si asigna.
