export enum Role {
  ADMIN = "admin",
  USER = "user",
  AUTHOR = "author",
  ADMIN_COMPANY = "admin_company",
  VENDEDOR = "vendedor",
}

export const ROLES = [
  { label: "Admin", value: Role.ADMIN },
  { label: "User", value: Role.USER },
  { label: "Author", value: Role.AUTHOR },
  { label: "Admin (Company)", value: Role.ADMIN_COMPANY },
  { label: "Vendedor", value: Role.VENDEDOR },
];
