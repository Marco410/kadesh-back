import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { PET_PLACE_SERVICE_STATUS } from "./status";

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export const petPlaceServiceHooks = {
  resolveInput: async ({
    resolvedData,
    item,
    operation,
    context,
  }: any) => {
    if (
      operation === "create" &&
      getSessionUserId(context.session) &&
      !isPlatformAdmin(context.session)
    ) {
      resolvedData.status = PET_PLACE_SERVICE_STATUS.PENDING;
      resolvedData.active = false;
    }

    const status = resolvedData.status ?? item?.status;
    if (status === PET_PLACE_SERVICE_STATUS.APPROVED) {
      if (resolvedData.active === undefined) resolvedData.active = true;
    } else if (
      status === PET_PLACE_SERVICE_STATUS.PENDING ||
      status === PET_PLACE_SERVICE_STATUS.REJECTED
    ) {
      resolvedData.active = false;
    }

    const name = String(resolvedData.name ?? item?.name ?? "").trim();
    if (!resolvedData.slug && !item?.slug && name) {
      let slug = slugFromName(name) || "servicio";
      let candidate = slug;
      let n = 2;
      while (
        (
          await context.sudo().query.PetPlaceService.findMany({
            where: { slug: { equals: candidate } },
            take: 1,
            query: "id",
          })
        ).length > 0
      ) {
        candidate = `${slug}_${n}`;
        n += 1;
      }
      resolvedData.slug = candidate;
    }

    return resolvedData;
  },
  afterOperation: async ({ operation, item, inputData, context }: any) => {
    if (operation !== "update" || !item?.id) return;
    if (inputData?.status !== PET_PLACE_SERVICE_STATUS.APPROVED) return;

    const row = (await context.sudo().query.PetPlaceService.findOne({
      where: { id: item.id },
      query: "id requestedFor { id }",
    })) as { id: string; requestedFor?: { id: string } | null } | null;

    const placeId = row?.requestedFor?.id;
    if (!placeId) return;

    await context.sudo().query.PetPlace.updateOne({
      where: { id: placeId },
      data: { services: { connect: [{ id: item.id }] } },
    });
  },
};
