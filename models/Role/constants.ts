export enum Role {
  ADMIN = "admin",
  USER = "user",
  AUTHOR = "author",
  VENDEDOR = "vendedor",
}

export const ROLES = [
  { label: "Admin", value: Role.ADMIN },
  { label: "User", value: Role.USER },
  { label: "Author", value: Role.AUTHOR },
  { label: "Vendedor", value: Role.VENDEDOR },
];
