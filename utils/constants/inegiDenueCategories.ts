import { GOOGLE_PLACE_CATEGORIES } from "./googlePlaceCategories";

/**
 * Dropdown INEGI. `label` = UI. `value` = palabra del título de clase SCIAN México 2023
 * (Clase_actividad en DENUE). Sin acentos. No es el catálogo completo (~1086 clases).
 */
export const INEGI_DENUE_CATEGORIES = [
  // ── SALUD (62) ─────────────────────────────────────────
  { value: "medicina", label: "Médicos" }, // 621111 medicina general, 621113 especializada
  { value: "dentales", label: "Dentistas" }, // 621211 Consultorios dentales
  { value: "clinicas", label: "Clínicas" }, // 621115 Clínicas de consultorios médicos
  { value: "laboratorios", label: "Laboratorios" }, // 621511 Laboratorios médicos y de diagnóstico
  { value: "farmacias", label: "Farmacias" }, // 464111/464112 Farmacias
  { value: "optometria", label: "Ópticas" }, // 621320 Consultorios de optometría
  { value: "veterinarios", label: "Veterinarias" }, // 541941 Servicios veterinarios para mascotas
  { value: "psicologia", label: "Psicólogos" }, // 621331 Consultorios de psicología
  { value: "terapia", label: "Fisioterapeutas" }, // 621341 terapia ocupacional, física y del lenguaje
  { value: "nutriologos", label: "Nutriólogos" }, // 621391 Consultorios de nutriólogos y dietistas
  { value: "quiropractica", label: "Quiroprácticos" }, // 621311 Consultorios de quiropráctica
  { value: "rehabilitacion", label: "Centros de rehabilitación" }, // 623111 residencias… rehabilitación
  { value: "hospitales", label: "Hospitales" }, // 622111
  { value: "laboratorios", label: "Centros de diagnóstico" }, // 621511 (misma clase; “diagnostico” no pega en DENUE)
  { value: "ambulancias", label: "Ambulancias" }, // 621910
  { value: "enfermeria", label: "Enfermería a domicilio" }, // 621610
  { value: "ortopedicos", label: "Ortopédicos" }, // 464122
  { value: "naturistas", label: "Productos naturistas" }, // 464113
  { value: "belleza", label: "Medicina estética" }, // 812110
  { value: "especializada", label: "Cirujanos plásticos" }, // 621113 medicina especializada
  { value: "especializada", label: "Pediatras" },
  { value: "especializada", label: "Ginecólogos" },
  { value: "especializada", label: "Dermatólogos" },
  { value: "especializada", label: "Oftalmólogos" },

  // ── LEGAL Y FINANCIERO ─────────────────────────────────
  { value: "bufetes", label: "Abogados" }, // 541110 Bufetes jurídicos
  { value: "notarias", label: "Notarías" }, // 541120 Notarías públicas
  { value: "contabilidad", label: "Contadores" }, // 541211 Servicios de contabilidad y auditoría
  { value: "banca", label: "Bancos" }, // 522110 Banca múltiple
  { value: "seguros", label: "Seguros" }, // 524110 Compañías de seguros / 524210 agentes
  { value: "cambio", label: "Casas de cambio" }, // 523121 Casas de cambio
  { value: "contabilidad", label: "Despachos contables" }, // 541211
  { value: "consultoria", label: "Consultoras empresariales" }, // 541610
  { value: "tramites", label: "Gestorías" }, // 541190
  { value: "ingenieria", label: "Ingenieros" }, // 541330
  { value: "computo", label: "Software y sistemas" }, // 541510 diseño de sistemas de cómputo
  { value: "relaciones", label: "Relaciones públicas" }, // 541820
  { value: "encuestas", label: "Investigación de mercados" }, // 541910
  { value: "traduccion", label: "Traducción" }, // 541930
  { value: "empeno", label: "Casas de empeño" }, // 522452

  // ── EDUCACIÓN (61) ─────────────────────────────────────
  { value: "escuelas", label: "Escuelas" }, // 6111
  { value: "preescolar", label: "Preescolar" }, // 611111 preescolar y estimulación temprana
  { value: "guarderias", label: "Guarderías" }, // 624411
  { value: "oficios", label: "Autoescuelas" }, // 611511
  { value: "superior", label: "Universidades" }, // 611311
  { value: "idiomas", label: "Academias de idiomas" }, // 611631
  { value: "arte", label: "Academias de música" }, // 611611
  { value: "arte", label: "Academias de baile" },
  { value: "computacion", label: "Escuelas de computación" }, // 611421
  { value: "profesores", label: "Tutorías" }, // 611691
  { value: "capacitacion", label: "Centros de capacitación" }, // 611431
  { value: "escuelas", label: "Colegios privados" },

  // ── ALIMENTACIÓN (72 / 46 / 31) ────────────────────────
  { value: "restaurantes", label: "Restaurantes" }, // 722511
  { value: "cafeterias", label: "Cafeterías" }, // 722515 Cafeterías, fuentes de sodas, neverías…
  { value: "bares", label: "Bares" }, // 722412 Bares, cantinas y similares
  { value: "panificacion", label: "Panaderías" }, // 311812 Panificación tradicional
  { value: "panificacion", label: "Pastelerías" },
  { value: "tacos", label: "Taquerías" }, // 722514 tacos y tortas
  { value: "antojitos", label: "Fondas" }, // 722513 antojitos
  { value: "pizzas", label: "Pizzerías" }, // 722517 pizzas, hamburguesas…
  { value: "mariscos", label: "Marisquerías" }, // 722512 pescados y mariscos
  { value: "corrida", label: "Cocinas económicas" }, // 722511 comida corrida
  { value: "neverias", label: "Heladerías" }, // 722515 neverías / 461170 paletas de hielo y helados
  { value: "refresquerias", label: "Juguerías" }, // 722515
  { value: "supermercados", label: "Supermercados" }, // 462111
  { value: "minisupers", label: "Minisupers" }, // 462112
  { value: "carnes", label: "Carnicerías" }, // 461121
  { value: "frutas", label: "Fruterías y verdulerías" }, // 461130
  { value: "licores", label: "Vinos y licores" }, // 461211
  { value: "tortillas", label: "Tortillerías" }, // 311830
  { value: "ocasiones", label: "Banquetes y catering" }, // 722320 alimentos para ocasiones especiales
  { value: "moviles", label: "Comida para llevar / food trucks" }, // 722330 unidades móviles
  { value: "discotecas", label: "Discotecas" }, // 722411

  // ── BELLEZA Y BIENESTAR ────────────────────────────────
  { value: "belleza", label: "Salones de belleza" }, // 812110 Salones y clínicas de belleza y peluquerías
  { value: "peluquerias", label: "Peluquerías" }, // 812110
  { value: "belleza", label: "Spa" },
  { value: "acondicionamiento", label: "Gimnasios" }, // 713943 Centros de acondicionamiento físico
  { value: "acondicionamiento", label: "Gimnasios de box" },
  { value: "acondicionamiento", label: "Estudios de yoga" },
  { value: "acondicionamiento", label: "Estudios de pilates" },
  { value: "personales", label: "Centros de tatuajes" }, // 812990 Otros servicios personales
  { value: "belleza", label: "Centros de depilación" },
  { value: "peluquerias", label: "Barberías" },
  { value: "belleza", label: "Uñas y estética" },

  // ── COMERCIO (46) ──────────────────────────────────────
  { value: "ropa", label: "Tiendas de ropa" }, // 463211
  { value: "calzado", label: "Zapaterías" }, // 463310
  { value: "departamentales", label: "Tiendas departamentales" }, // 462210
  { value: "mascotas", label: "Tiendas de mascotas" }, // 465911 mascotas y sus accesorios
  { value: "joyeria", label: "Joyerías" }, // 465112
  { value: "muebles", label: "Mueblerías" }, // 466111
  { value: "libros", label: "Librerías" }, // 465312
  { value: "flores", label: "Florerías" }, // 466312
  { value: "ferreterias", label: "Ferreterías" }, // 467111
  { value: "electrodomesticos", label: "Electrónica" }, // 466112
  { value: "computo", label: "Tiendas de cómputo" }, // 466211
  { value: "lentes", label: "Ópticas" }, // 464121
  { value: "deportivos", label: "Tiendas de deportes" }, // 465215
  { value: "telefonos", label: "Tiendas de celulares" }, // 466212
  { value: "papeleria", label: "Papelerías" }, // 465311
  { value: "juguetes", label: "Jugueterías" }, // 465212
  { value: "bicicletas", label: "Bicicleterías" }, // 465213
  { value: "novia", label: "Tiendas de novias" }, // 463214
  { value: "cosmeticos", label: "Perfumerías" }, // 465111
  { value: "artesanias", label: "Artesanías" }, // 465915
  { value: "abarrotes", label: "Tiendas de abarrotes" }, // 461110
  { value: "construccion", label: "Tiendas de materiales" }, // 467116
  { value: "vidrios", label: "Vidrios y espejos" }, // 467114
  { value: "motocicletas", label: "Agencias de motos" }, // 468311
  { value: "abarrotes", label: "Distribuidoras" },

  // ── INDUSTRIA ──────────────────────────────────────────
  { value: "fabricacion", label: "Fábricas" },
  { value: "fabricacion", label: "Procesadoras" },
  { value: "transporte", label: "Servicio de distribución" }, // 48-49 transportes

  // ── SERVICIOS AL HOGAR ─────────────────────────────────
  { value: "hidrosanitarias", label: "Plomeros" }, // 238221
  { value: "electricas", label: "Electricistas" }, // 238210
  { value: "calefaccion", label: "Aire acondicionado" }, // 238222
  { value: "carpinteria", label: "Carpinterías" }, // 238350
  { value: "lavanderias", label: "Lavanderías" }, // 812210
  { value: "mudanzas", label: "Mudanzas" }, // 484210
  { value: "herreria", label: "Herrería" }, // 332320
  { value: "pintura", label: "Pintura y construcción" }, // 238320
  { value: "pintura", label: "Impermeabilizantes" },
  { value: "albanileria", label: "Albanilería" }, // 238130
  { value: "plagas", label: "Fumigación" }, // 561710
  { value: "limpieza", label: "Limpieza de hogares" }, // 561720
  { value: "verdes", label: "Jardinería" }, // 561730 áreas verdes
  { value: "seguridad", label: "Instalación de alarmas" }, // 561620
  { value: "cerrajerias", label: "Cerrajeros" }, // 811491
  { value: "mensajeria", label: "Mensajería y paquetería" }, // 492210
  { value: "aduanales", label: "Agencias aduanales" }, // 488511
  { value: "colocacion", label: "Agencias de empleo" }, // 561310
  { value: "fotocopiado", label: "Fotocopiado" }, // 561431
  { value: "cobranza", label: "Despachos de cobranza" }, // 561440

  // ── AUTOMOTRIZ ─────────────────────────────────────────
  { value: "mecanica", label: "Talleres mecánicos" }, // 811111 Reparación mecánica en general
  { value: "gasolina", label: "Gasolineras" }, // 468411 gasolina y diésel
  { value: "automoviles", label: "Agencias de autos" }, // 468111 automóviles y camionetas nuevos
  { value: "refacciones", label: "Refaccionarias" }, // 468211 partes y refacciones
  { value: "llantas", label: "Llanterías" }, // 468213 llantas y cámaras
  { value: "hojalateria", label: "Hojalatería y pintura" }, // 811121
  { value: "alineacion", label: "Verificaciones" }, // 811116
  { value: "alquiler", label: "Renta de autos" }, // 532110
  { value: "estacionamientos", label: "Estacionamientos" }, // 812410
  { value: "lubricado", label: "Autolavado" }, // 811192 Lavado y lubricado
  { value: "grua", label: "Grúas" }, // 488410

  // ── INMOBILIARIO Y CONSTRUCCIÓN ────────────────────────
  { value: "inmobiliarias", label: "Inmobiliarias" }, // 531210 Inmobiliarias y corredores de bienes raíces
  { value: "edificacion", label: "Constructoras" }, // 236111 Edificación de vivienda
  { value: "arquitectura", label: "Arquitectos" }, // 541310 Servicios de arquitectura
  { value: "interiores", label: "Diseñadores de interiores" }, // 541410 Diseño y decoración de interiores
  { value: "inmobiliarias", label: "Valuadores" }, // sin clase propia; cae en servicios inmobiliarios
  { value: "edificacion", label: "Desarrolladoras" },

  // ── TURISMO Y ENTRETENIMIENTO ──────────────────────────
  { value: "hoteles", label: "Hoteles" }, // 721111/721112
  { value: "moteles", label: "Moteles" }, // 721113
  { value: "viajes", label: "Agencias de viajes" }, // 561510
  { value: "salones", label: "Salones de eventos" }, // 531113
  { value: "fotografia", label: "Fotografía y video" }, // 541920 fotografía y videograbación
  { value: "musicales", label: "Grupos de música" }, // 711131
  { value: "diversiones", label: "Recreación infantil" }, // 713111
  { value: "peliculas", label: "Cines" }, // 512130
  { value: "juegos", label: "Escape rooms" }, // 713120
  { value: "diversiones", label: "Parques de diversiones" }, // 713111
  { value: "balnearios", label: "Balnearios" }, // 713113 parques acuáticos y balnearios
  { value: "boliches", label: "Boliches" }, // 713950
  { value: "deportivos", label: "Canchas deportivas" }, // 713941

  // ── SERVICIOS DIGITALES Y CREATIVOS ───────────────────
  { value: "publicidad", label: "Agencias de marketing" }, // 541810 Agencias de publicidad
  { value: "grafico", label: "Agencias de diseño" }, // 541430 Diseño gráfico
  { value: "impresion", label: "Imprentas" }, // 323111 Impresión de libros…
  { value: "fotografia", label: "Fotografía" }, // 541920
  { value: "grabacion", label: "Estudio de grabación" }, // 512240 (si aplica) / 711510 independientes
  { value: "publicidad", label: "Agencias de publicidad" }, // 541810

  // ── RELIGIOSO Y SOCIAL ─────────────────────────────────
  { value: "religiosas", label: "Iglesias" }, // 813210 Asociaciones y organizaciones religiosas
  { value: "funerarios", label: "Funerarias" }, // 812310 Servicios funerarios
  { value: "asilos", label: "Asilos y casas de reposo" }, // 623311 Asilos… cuidado de ancianos
  { value: "orfanatos", label: "Orfanatos" }, // 623991 Orfanatos y otras residencias
  { value: "civiles", label: "ONG / Sin fines de lucro" }, // 813230 Asociaciones y organizaciones civiles

  // ── OTROS ──────────────────────────────────────────────
  { value: "todos", label: "Negocios locales" },
  { value: "todos", label: "Otra" },
] as const;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const CATCH_ALL = new Set([
  "",
  "todos",
  "todo",
  "otra",
  "otro",
  "all",
  "negocios locales",
  "negocioslocales",
]);

/** Values viejos / Google que no coinciden con el título SCIAN ASCII. */
const KEYWORD_ALIASES: Record<string, string> = {
  diagnostico: "laboratorios",
  laboratorio: "laboratorios",
};

type ContainsMode = { contains: string; mode: "insensitive" };

/**
 * Palabra + singular/plural corto para `contains` (Laboratorio vs Laboratorios).
 */
export function denueKeywordVariants(keyword: string): string[] {
  const folded = fold(keyword);
  if (!folded) return [];
  const variants = new Set<string>([folded]);
  if (folded.endsWith("es") && folded.length > 5) {
    variants.add(folded.slice(0, -2));
  } else if (folded.endsWith("s") && folded.length > 4) {
    variants.add(folded.slice(0, -1));
  } else {
    variants.add(`${folded}s`);
  }
  return [...variants];
}

export function denueContains(keyword: string): ContainsMode[] {
  return denueKeywordVariants(keyword).map((word) => ({
    contains: word,
    mode: "insensitive" as const,
  }));
}

export type DenueSearch = {
  keyword: string;
  isCatchAll: boolean;
  label: string | null;
};

/**
 * Acepta value INEGI, value Google o label. Catch-all → todos.
 */
export function resolveDenueSearch(raw: string): DenueSearch {
  const folded = fold(raw);
  const compact = KEYWORD_ALIASES[folded] ?? folded;
  if (
    !compact ||
    CATCH_ALL.has(compact) ||
    CATCH_ALL.has(compact.replace(/\s/g, ""))
  ) {
    return { keyword: "todos", isCatchAll: true, label: "Negocios locales" };
  }

  const inegiByValue = INEGI_DENUE_CATEGORIES.find(
    (item) => fold(item.value) === compact,
  );
  if (inegiByValue) {
    return {
      keyword: inegiByValue.value,
      isCatchAll: inegiByValue.value === "todos",
      label: inegiByValue.label,
    };
  }

  const google = GOOGLE_PLACE_CATEGORIES.find(
    (item) => fold(item.value) === compact,
  );
  if (google) {
    const mapped = INEGI_DENUE_CATEGORIES.find(
      (item) => item.label === google.label,
    );
    if (mapped) {
      return {
        keyword: mapped.value,
        isCatchAll: mapped.value === "todos",
        label: mapped.label,
      };
    }
  }

  const byLabel = [...INEGI_DENUE_CATEGORIES, ...GOOGLE_PLACE_CATEGORIES].find(
    (item) => fold(item.label) === compact,
  );
  if (byLabel) {
    const mapped =
      INEGI_DENUE_CATEGORIES.find((item) => item.label === byLabel.label) ??
      INEGI_DENUE_CATEGORIES.find(
        (item) => fold(item.value) === fold(byLabel.value),
      );
    if (mapped) {
      return {
        keyword: mapped.value,
        isCatchAll: mapped.value === "todos",
        label: mapped.label,
      };
    }
  }

  return { keyword: compact, isCatchAll: false, label: null };
}
