/* eslint-disable no-console */
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "./keystone";
import seed from "./utils/seed";

async function main() {
  const context = getContext(config, PrismaModule);

  console.log(`🌱 Inserting seed data`);

  await seed(context);

  console.log(`🚀 Seed data inserted`);
  console.log(
    `👋 Please start the process with \`yarn dev\` or \`npm run dev\``
  );
}

main();
