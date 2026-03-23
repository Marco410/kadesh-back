/**
 * Tipos de negocio para búsqueda en Google Places (Text Search).
 * label: para el dropdown en UI. value: término de búsqueda en español para la API.
 * Basado en tipos soportados por Google Maps / Places.
 */
export const GOOGLE_PLACE_CATEGORIES = [
  // ── SALUD ──────────────────────────────────────────────
  { value: "médicos", label: "Médicos" },
  { value: "dentistas", label: "Dentistas" },
  { value: "clínicas", label: "Clínicas" },
  { value: "laboratorios", label: "Laboratorios" },
  { value: "farmacias", label: "Farmacias" },
  { value: "ópticas", label: "Ópticas" },
  { value: "veterinarias", label: "Veterinarias" },
  { value: "psicólogos", label: "Psicólogos" },
  { value: "fisioterapeutas", label: "Fisioterapeutas" },
  { value: "nutriólogos", label: "Nutriólogos" },
  { value: "quiroprácticos", label: "Quiroprácticos" },
  { value: "centros de rehabilitación", label: "Centros de rehabilitación" },
  { value: "hospitales", label: "Hospitales" },
  { value: "centros de diagnóstico", label: "Centros de diagnóstico" },
  { value: "medicina estética", label: "Medicina estética" },
  { value: "cirujanos plásticos", label: "Cirujanos plásticos" },
  { value: "pediatras", label: "Pediatras" },
  { value: "ginecólogos", label: "Ginecólogos" },
  { value: "dermatólogos", label: "Dermatólogos" },
  { value: "oftalmólogos", label: "Oftalmólogos" },

  // ── LEGAL Y FINANCIERO ─────────────────────────────────
  { value: "abogados", label: "Abogados" },
  { value: "notarías", label: "Notarías" },
  { value: "contadores", label: "Contadores" },
  { value: "bancos", label: "Bancos" },
  { value: "seguros", label: "Seguros" },
  { value: "casas de cambio", label: "Casas de cambio" },
  { value: "despachos contables", label: "Despachos contables" },
  { value: "consultoras empresariales", label: "Consultoras empresariales" },
  { value: "gestorías", label: "Gestorías" },

  // ── EDUCACIÓN ──────────────────────────────────────────
  { value: "escuelas", label: "Escuelas" },
  { value: "guarderías", label: "Guarderías" },
  { value: "autoescuelas", label: "Autoescuelas" },
  { value: "universidades", label: "Universidades" },
  { value: "academias de idiomas", label: "Academias de idiomas" },
  { value: "academias de música", label: "Academias de música" },
  { value: "academias de baile", label: "Academias de baile" },
  { value: "tutorías", label: "Tutorías" },
  { value: "centros de capacitación", label: "Centros de capacitación" },
  { value: "colegios privados", label: "Colegios privados" },

  // ── ALIMENTACIÓN ───────────────────────────────────────
  { value: "restaurantes", label: "Restaurantes" },
  { value: "cafeterías", label: "Cafeterías" },
  { value: "bares", label: "Bares" },
  { value: "panaderías", label: "Panaderías" },
  { value: "pastelerías", label: "Pastelerías" },
  { value: "taquerías", label: "Taquerías" },
  { value: "fondas", label: "Fondas" },
  { value: "pizzerías", label: "Pizzerías" },
  { value: "marisquerías", label: "Marisquerías" },
  { value: "cocinas económicas", label: "Cocinas económicas" },
  { value: "heladerías", label: "Heladerías" },
  { value: "juguerías", label: "Juguerías" },
  { value: "supermercados", label: "Supermercados" },
  { value: "carnicerías", label: "Carnicerías" },
  { value: "tortillerías", label: "Tortillerías" },

  // ── BELLEZA Y BIENESTAR ────────────────────────────────
  { value: "salones de belleza", label: "Salones de belleza" },
  { value: "peluquerías", label: "Peluquerías" },
  { value: "spa", label: "Spa" },
  { value: "gimnasios", label: "Gimnasios" },
  { value: "gimnasios de box", label: "Gimnasios de box" },
  { value: "estudios de yoga", label: "Estudios de yoga" },
  { value: "estudios de pilates", label: "Estudios de pilates" },
  { value: "centros de tatuajes", label: "Centros de tatuajes" },
  { value: "centros de depilación", label: "Centros de depilación" },
  { value: "barberías", label: "Barberías" },
  { value: "uñas y estética", label: "Uñas y estética" },

  // ── COMERCIO ───────────────────────────────────────────
  { value: "tiendas de ropa", label: "Tiendas de ropa" },
  { value: "tiendas de mascotas", label: "Tiendas de mascotas" },
  { value: "joyerías", label: "Joyerías" },
  { value: "mueblerías", label: "Mueblerías" },
  { value: "librerías", label: "Librerías" },
  { value: "florerías", label: "Florerías" },
  { value: "ferreterías", label: "Ferreterías" },
  { value: "electrónica", label: "Electrónica" },
  { value: "ópticas", label: "Ópticas" },
  { value: "tiendas de deportes", label: "Tiendas de deportes" },
  { value: "tiendas de celulares", label: "Tiendas de celulares" },
  { value: "papelerías", label: "Papelerías" },
  { value: "jugueterías", label: "Jugueterías" },
  { value: "tiendas de novias", label: "Tiendas de novias" },
  { value: "tiendas de abarrotes", label: "Tiendas de abarrotes" },
  { value: "tiendas de materiales", label: "Tiendas de materiales" },
  { value: "distribuidoras", label: "Distribuidoras" },

  // ── INDUSTRIA Y PRODUCCIÓN ─────────────────────────────
  { value: "fábricas", label: "Fábricas" },
  { value: "procesadoras", label: "Procesadoras" },
  { value: "servicio de distribución", label: "Servicio de distribución" },

  // ── SERVICIOS AL HOGAR ─────────────────────────────────
  { value: "plomeros", label: "Plomeros" },
  { value: "electricistas", label: "Electricistas" },
  { value: "carpinterías", label: "Carpinterías" },
  { value: "lavanderías", label: "Lavanderías" },
  { value: "mudanzas", label: "Mudanzas" },
  { value: "herrería", label: "Herrería" },
  { value: "pintura y construcción", label: "Pintura y construcción" },
  { value: "impermeabilizantes", label: "Impermeabilizantes" },
  { value: "albanilería", label: "Albanilería" },
  { value: "fumigación", label: "Fumigación" },
  { value: "limpieza de hogares", label: "Limpieza de hogares" },
  { value: "instalación de alarmas", label: "Instalación de alarmas" },
  { value: "cerrajeros", label: "Cerrajeros" },

  // ── AUTOMOTRIZ ─────────────────────────────────────────
  { value: "talleres mecánicos", label: "Talleres mecánicos" },
  { value: "gasolineras", label: "Gasolineras" },
  { value: "agencias de autos", label: "Agencias de autos" },
  { value: "refaccionarias", label: "Refaccionarias" },
  { value: "llanterías", label: "Llanterías" },
  { value: "hojalatería y pintura", label: "Hojalatería y pintura" },
  { value: "verificaciones", label: "Verificaciones" },
  { value: "renta de autos", label: "Renta de autos" },
  { value: "estacionamientos", label: "Estacionamientos" },

  // ── INMOBILIARIO Y CONSTRUCCIÓN ────────────────────────
  { value: "inmobiliarias", label: "Inmobiliarias" },
  { value: "constructoras", label: "Constructoras" },
  { value: "arquitectos", label: "Arquitectos" },
  { value: "diseñadores de interiores", label: "Diseñadores de interiores" },
  { value: "valuadores", label: "Valuadores" },
  { value: "desarrolladoras", label: "Desarrolladoras" },

  // ── TURISMO Y ENTRETENIMIENTO ──────────────────────────
  { value: "hoteles", label: "Hoteles" },
  { value: "agencias de viajes", label: "Agencias de viajes" },
  { value: "salones de eventos", label: "Salones de eventos" },
  { value: "fotografía y video", label: "Fotografía y video" },
  { value: "grupos de música", label: "Grupos de música" },
  { value: "recreación infantil", label: "Recreación infantil" },
  { value: "cines", label: "Cines" },
  { value: "escape rooms", label: "Escape rooms" },
  { value: "parques de diversiones", label: "Parques de diversiones" },
  { value: "canchas deportivas", label: "Canchas deportivas" },

  // ── SERVICIOS DIGITALES Y CREATIVOS ───────────────────
  { value: "agencias de marketing", label: "Agencias de marketing" },
  { value: "agencias de diseño", label: "Agencias de diseño" },
  { value: "imprentas", label: "Imprentas" },
  { value: "fotografía", label: "Fotografía" },
  { value: "estudio de grabación", label: "Estudio de grabación" },
  { value: "agencias de publicidad", label: "Agencias de publicidad" },

  // ── RELIGIOSO Y SOCIAL ─────────────────────────────────
  { value: "iglesias", label: "Iglesias" },
  { value: "funerarias", label: "Funerarias" },
  { value: "asilos y casas de reposo", label: "Asilos y casas de reposo" },
  { value: "orfanatos", label: "Orfanatos" },
  { value: "organizaciones sin fines de lucro", label: "ONG / Sin fines de lucro" },

  // ── OTROS ──────────────────────────────────────────────
  { value: "negocios locales", label: "Negocios locales" },
  { value: "otra", label: "Otra" },
] as const;