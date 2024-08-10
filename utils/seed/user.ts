import { KeystoneContext } from "@keystone-6/core/types";
export async function createUserAdmin(context: KeystoneContext) {
  // Check if there are already roles
  const existingUser = await context.sudo().query.User.findMany();
  if (existingUser.length > 0) {
    console.log("♻️  Skipped User seeding.");
    return existingUser;
  }

  const data = await context.sudo().query.User.createOne({
    data: {
      name: "Marco",
      lastName: "Castañeda",
      username: "marco410",
      email: "marco_pascual410@hotmail.com",
      password: "1234567890",
      role: "admin",
    },
    query: "id",
  });
  console.log("✅ User seeding complete.");
}
