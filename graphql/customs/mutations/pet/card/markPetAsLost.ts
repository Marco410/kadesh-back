import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import createAnimalReport from "../createAnimalReport";
import { PET_STATUS } from "../../../../../models/Pet/constants";
import { copyPetPhotosToReport, petAgeLabel, requirePetOwner } from "../../../../../utils/pet/petCard";
import { petPublicUrl } from "../../../../../utils/pet/animalReport";

const typeDefs = `
  input PetLastSeenLocationInput {
    lat: String!
    lng: String!
    address: String
  }

  type MarkPetAsLostResult {
    petId: ID!
    reportId: ID!
    slug: String!
    url: String!
  }
`;

const definition = `
  markPetAsLost(petId: ID!, lastSeenLocation: PetLastSeenLocationInput!, lastSeenDate: String!, notes: String, contactPhone: String): MarkPetAsLostResult!
`;

type Args = {
  petId: string;
  lastSeenLocation: { lat: string; lng: string; address?: string | null };
  lastSeenDate: string;
  notes?: string | null;
  /** Teléfono del cartel público. Sin él se usa el del perfil de quien reporta. */
  contactPhone?: string | null;
};

type PetForReport = {
  id: string;
  name: string;
  status: string;
  sex?: string | null;
  color?: string | null;
  distinctiveMarks?: string | null;
  approximateAge?: string | null;
  birthday?: string | null;
  animal_type?: { id: string } | null;
  animal_breed?: { id: string } | null;
  lostReport?: { id: string; slug?: string | null } | null;
};

const resolver = {
  /**
   * Crea el reporte de perdida con los datos y fotos de la mascota, la marca `lost` y liga los dos.
   * El reporte sale por `createAnimalReport` (mismo slug, ciudad, validaciones, alerta de zona y
   * aviso a Operaciones que un reporte normal). Ver docs/cartilla/README.md.
   */
  markPetAsLost: async (_root: unknown, args: Args, context: KeystoneContext) => {
    try {
      const { userId } = await requirePetOwner(context, args.petId);
      const sudo = context.sudo();
      const pet = (await sudo.query.Pet.findOne({
        where: { id: args.petId },
        query:
          "id name status sex color distinctiveMarks approximateAge birthday animal_type { id } animal_breed { id } lostReport { id slug }",
      })) as PetForReport | null;
      if (!pet) throw new GraphQLError("No encontramos esta mascota en tu cartilla.");
      if (pet.status === PET_STATUS.LOST) {
        const slug = pet.lostReport?.slug;
        throw new GraphQLError(
          slug ? `Ya está reportada como perdida: ${petPublicUrl(slug)}` : "Ya está reportada como perdida.",
        );
      }
      if (pet.status !== PET_STATUS.ACTIVE) {
        throw new GraphQLError("Solo puedes reportar como perdida una mascota activa.");
      }
      if (!pet.animal_type?.id) {
        throw new GraphQLError("Elige la especie de tu mascota antes de reportarla.");
      }

      let phone = args.contactPhone?.trim() || "";
      if (!phone) {
        const user = (await sudo.query.User.findOne({
          where: { id: userId },
          query: "phone",
        })) as { phone?: string | null } | null;
        phone = user?.phone?.trim() || "";
      }
      if (!phone) throw new GraphQLError("Agrega un teléfono de contacto para el reporte.");

      const report = (await createAnimalReport.resolver.createAnimalReport(
        null,
        {
          input: {
            type: pet.animal_type.id,
            breed: pet.animal_breed?.id ?? null,
            name: pet.name,
            sex: pet.sex || "unknown",
            color: pet.color || "",
            marks: pet.distinctiveMarks || "",
            age: petAgeLabel(pet.birthday, pet.approximateAge),
            status: "lost",
            lostDate: args.lastSeenDate,
            lat: String(args.lastSeenLocation.lat),
            lng: String(args.lastSeenLocation.lng),
            addressText: args.lastSeenLocation.address ?? "",
            phone,
            note: args.notes ?? "",
            reportedBy: "owner",
            reporterUserId: userId,
            // Es la misma mascota del dueño: no frenar por "parece duplicado".
            confirmDuplicate: true,
          },
        },
        context,
      )) as { id: string; slug: string; url: string };

      await copyPetPhotosToReport(context, pet.id, report.id);

      // Prisma directo: solo se amarran los dos registros, sin volver a correr sus hooks.
      const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
      const linked = await prisma.animal.update({ where: { id: report.id }, data: { petId: pet.id } });
      if (linked instanceof Error) throw linked;
      const updated = await prisma.pet.update({
        where: { id: pet.id },
        data: { status: PET_STATUS.LOST, lostReportId: report.id },
      });
      if (updated instanceof Error) throw updated;

      return { petId: pet.id, reportId: report.id, slug: report.slug, url: report.url };
    } catch (error) {
      console.error("[pet] markPetAsLost", error);
      if (error instanceof GraphQLError) throw error;
      const message = error instanceof Error ? error.message : "No se pudo reportar la mascota.";
      throw new GraphQLError(message);
    }
  },
};

export default { typeDefs, definition, resolver };
