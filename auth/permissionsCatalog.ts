/**
 * Catálogo alineado con el front (`kadesh-business` → `profile/usuarios/permissions.ts`).
 * El backend valida las mismas llaves en mutaciones y en access control.
 */

export const PERMISSION_KEYS = {
  INICIO_VER: "inicio.ver",
  PERFIL_VER: "perfil.ver",
  PERFIL_EDITAR: "perfil.editar",
  AI_VER: "ai.ver",
  AI_CONFIGURAR: "ai.configurar",
  CLIENTES_VER: "clientes.ver",
  CLIENTES_VER_EMPRESA: "clientes.ver_empresa",
  CLIENTES_CREAR: "clientes.crear",
  CLIENTES_EDITAR: "clientes.editar",
  CLIENTES_ASIGNAR: "clientes.asignar",
  CLIENTES_EXPORTAR: "clientes.exportar",
  VENDEDORES_VER: "vendedores.ver",
  VENDEDORES_CREAR: "vendedores.crear",
  VENDEDORES_EDITAR: "vendedores.editar",
  ARCHIVOS_VER: "archivos.ver",
  ARCHIVOS_SUBIR: "archivos.subir",
  ARCHIVOS_ELIMINAR: "archivos.eliminar",
  PROYECTOS_VER: "proyectos.ver",
  PROYECTOS_CREAR: "proyectos.crear",
  PROYECTOS_EDITAR: "proyectos.editar",
  COTIZACIONES_VER: "cotizaciones.ver",
  COTIZACIONES_CREAR: "cotizaciones.crear",
  COTIZACIONES_EDITAR: "cotizaciones.editar",
  CALENDARIO_VER: "calendario.ver",
  CALENDARIO_GESTIONAR: "calendario.gestionar",
  ESPACIOS_VER: "espacios.ver",
  ESPACIOS_CREAR: "espacios.crear",
  ESPACIOS_MIEMBROS: "espacios.miembros",
  WHATSAPP_VER: "whatsapp.ver",
  WHATSAPP_CONFIGURAR: "whatsapp.configurar",
} as const;

export type PermissionKey =
  (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

const ALL_KEYS = new Set<string>(Object.values(PERMISSION_KEYS));

export function isPermissionKey(value: string): value is PermissionKey {
  return ALL_KEYS.has(value);
}

/** Normaliza JSON del usuario a lista de llaves válidas, o `null` si no hay lista (legado). */
export function normalizePermissions(value: unknown): PermissionKey[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is PermissionKey =>
      typeof item === "string" && isPermissionKey(item),
  );
}
