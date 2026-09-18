import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import { PET_PLACE_SERVICE_STATUS } from "../../../../../models/Pet/PetPlace/PetPlaceService/status";
import { sendAdminPetPlaceServiceRequestEmail } from "../../../../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../../../../utils/intregrations/smtpMail";
import { requireOwnedVerifiedPlace } from "./ownedPlace";

const typeDefs = `
  input RequestPetPlaceServiceInput {
    petPlaceId: String!
    name: String!
    description: String
  }

  type RequestPetPlaceServiceResult {
    success: Boolean!
    message: String!
    serviceId: String
    status: String
  }
`;

const definition = `
  requestPetPlaceService(input: RequestPetPlaceServiceInput!): RequestPetPlaceServiceResult!
`;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const resolver = {
  requestPetPlaceService: async (
    _root: unknown,
    { input }: { input: { petPlaceId: string; name: string; description?: string | null } },
    context: KeystoneContext,
  ) => {
    const owned = await requireOwnedVerifiedPlace(context, input.petPlaceId);
    if ("success" in owned) return { ...owned, serviceId: null, status: null };

    const name = normalizeName(input.name ?? "");
    if (name.length < 3) {
      return {
        success: false,
        message: "Escribe el nombre del servicio (al menos 3 letras).",
        serviceId: null,
        status: null,
      };
    }

    const description = (input.description ?? "").trim();
    const { userId, place } = owned;

    const duplicates = (await context.sudo().query.PetPlaceService.findMany({
      where: { name: { equals: name, mode: "insensitive" } },
      query: "id name status active requestedFor { id }",
    })) as Array<{
      id: string;
      name: string | null;
      status: string | null;
      active: boolean | null;
      requestedFor?: { id: string } | null;
    }>;

    const approved = duplicates.find(
      (row) =>
        row.status === PET_PLACE_SERVICE_STATUS.APPROVED || row.active === true,
    );
    if (approved) {
      return {
        success: false,
        message: "Ese servicio ya está en el catálogo. Búscalo y márcalo.",
        serviceId: approved.id,
        status: PET_PLACE_SERVICE_STATUS.APPROVED,
      };
    }

    const pendingMine = duplicates.find(
      (row) =>
        row.status === PET_PLACE_SERVICE_STATUS.PENDING &&
        row.requestedFor?.id === place.id,
    );
    if (pendingMine) {
      return {
        success: false,
        message: "Ya pediste este servicio. Está en revisión.",
        serviceId: pendingMine.id,
        status: PET_PLACE_SERVICE_STATUS.PENDING,
      };
    }

    const created = (await context.sudo().query.PetPlaceService.createOne({
      data: {
        name,
        description,
        active: false,
        status: PET_PLACE_SERVICE_STATUS.PENDING,
        requestedBy: { connect: { id: userId } },
        requestedFor: { connect: { id: place.id } },
      },
      query: "id status name",
    })) as { id: string; status: string | null; name: string | null };

    if (isSmtpConfigured()) {
      const requester = (await context.sudo().query.User.findOne({
        where: { id: userId },
        query: "name lastName email",
      })) as { name?: string | null; lastName?: string | null; email?: string | null } | null;

      const requesterName =
        [requester?.name, requester?.lastName].filter(Boolean).join(" ") || "Un dueño";

      try {
        await sendAdminPetPlaceServiceRequestEmail({
          serviceName: created.name || name,
          description,
          petPlaceName: place.name || "Clínica",
          petPlaceId: place.id,
          requesterName,
          requesterEmail: requester?.email ?? "",
        });
      } catch (error) {
        console.error("[requestPetPlaceService] Error enviando correo:", error);
      }
    }

    return {
      success: true,
      message: "Lo revisamos y, si aplica, aparecerá en el catálogo.",
      serviceId: created.id,
      status: created.status,
    };
  },
};

export default { typeDefs, definition, resolver };
