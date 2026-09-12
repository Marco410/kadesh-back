import { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../models/Role/constants";

export async function createUserAdmin(context: KeystoneContext) {
  const sudo = context.sudo();
  const existingUser = await sudo.query.User.findMany({
    query: "id",
  });
  if (existingUser.length > 0) {
    console.log("♻️  Skipped User seeding.");
    return existingUser[0].id;
  }

  const [adminRole] = await sudo.query.Role.findMany({
    where: { name: { equals: Role.ADMIN } },
    take: 1,
    query: "id",
  });

  const data = await sudo.query.User.createOne({
    data: {
      name: "Marco",
      lastName: "Castañeda",
      username: "marco410",
      email: "marco_pascual410@hotmail.com",
      password: "1234567890",
    },
    query: "id",
  });

  if (adminRole) {
    await sudo.prisma.user.update({
      where: { id: data.id },
      data: { roles: { set: [{ id: adminRole.id }] } },
    });
  }

  console.log("✅ User seeding complete.");

  return data.id;
}
