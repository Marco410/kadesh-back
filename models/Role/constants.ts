export enum Role {
  ADMIN = "admin",
  USER = "user",
  AUTHOR = "author",
  ADMIN_COMPANY = "admin_company",
  GERENCIA = "gerencia",
  VENDEDOR = "vendedor",
  USER_COMPANY = "user_company",
}

export const ROLES = [
  { label: "Admin", value: Role.ADMIN },
  { label: "User", value: Role.USER },
  { label: "Author", value: Role.AUTHOR },
  { label: "Admin (Company)", value: Role.ADMIN_COMPANY },
  { label: "Gerencia", value: Role.GERENCIA },
  { label: "User (Company)", value: Role.USER_COMPANY },
  { label: "Vendedor", value: Role.VENDEDOR },
];

/** Roles que admin de empresa / Gerencia pueden asignar desde Usuarios (además de `user`). */
export const ASSIGNABLE_COMPANY_ROLE_NAMES = [
  Role.USER,
  Role.GERENCIA,
  Role.VENDEDOR,
  Role.USER_COMPANY,
] as const;

/** Roles que Gerencia no puede ver ni editar. */
export const PROTECTED_COMPANY_ROLE_NAMES = [
  Role.ADMIN,
  Role.ADMIN_COMPANY,
] as const;
