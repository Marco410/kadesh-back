import { Readable } from "stream";
import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { imageSize } from "image-size";
import { getSessionUserId, isSignedIn } from "../../../../utils/access/tenant";
import {
  fillCityFromCoordinates,
  findReportDuplicates,
  optionalPhone,
  petPublicUrl,
  placeLabelFromAddress,
  requirePhone,
} from "../../../../utils/pet/animalReport";
import { noteAnimalCoverSaved } from "../../../../models/Pet/Animal/scheduleAnimalFacebookPost";

const TYPE_ALIASES: Record<string, string> = {
  perro: "dog",
  dog: "dog",
  gato: "cat",
  cat: "cat",
  ave: "bird",
  bird: "bird",
  pez: "fish",
  fish: "fish",
  reptil: "reptil",
  mamifero: "mammal",
  mamífero: "mammal",
  mammal: "mammal",
};

type ReportInput = {
  type: string;
  name: string;
  size?: string | null;
  age?: string | null;
  color?: string | null;
  sex?: string | null;
  breed?: string | null;
  marks?: string | null;
  status: string;
  lostDate?: string | null;
  lat: string;
  lng: string;
  addressText?: string | null;
  phone: string;
  phone2?: string | null;
  note?: string | null;
  sourceUrl?: string | null;
  reportedBy?: string | null;
  imageUrls?: string[] | null;
  confirmDuplicate?: boolean | null;
  reporterUserId?: string | null;
};

const typeDefs = `
  input CreateAnimalReportInput {
    type: String!
    name: String!
    size: String
    age: String
    color: String
    sex: String
    breed: String
    marks: String
    status: String!
    lostDate: String
    lat: String!
    lng: String!
    addressText: String
    phone: String!
    phone2: String
    note: String
    sourceUrl: String
    reportedBy: String
    imageUrls: [String!]
    confirmDuplicate: Boolean
    reporterUserId: String
  }

  type CreateAnimalReportResult {
    id: ID!
    slug: String!
    url: String!
  }
`;

const definition = `
  createAnimalReport(input: CreateAnimalReportInput!): CreateAnimalReportResult!
`;

function serviceToken(context: KeystoneContext) {
  const header = context.req?.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function assertCanCreate(context: KeystoneContext) {
  const expected = process.env.PET_AUTOMATION_TOKEN?.trim();
  const token = serviceToken(context);
  if (expected && token && token === expected) return;
  if (isSignedIn(context.session)) return;
  throw new GraphQLError("No autorizado para crear reportes.");
}

function parseLostDate(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return new Date().toISOString();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const date = dateOnly
    ? new Date(`${raw}T12:00:00-06:00`)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new GraphQLError("La fecha no es válida.");
  }
  if (date.getTime() > Date.now()) {
    throw new GraphQLError("La fecha no puede ser posterior a hoy.");
  }
  return date.toISOString();
}

async function resolveType(context: KeystoneContext, type: string) {
  const key = type.trim();
  const alias = TYPE_ALIASES[key.toLowerCase()] || key;
  const rows = (await context.sudo().query.AnimalType.findMany({
    where: {
      OR: [
        { id: { equals: key } },
        { name: { equals: alias } },
        { name: { equals: key } },
      ],
    },
    query: "id name",
    take: 1,
  })) as Array<{ id: string; name?: string | null }>;
  if (!rows[0]) throw new GraphQLError("Elige un tipo de animal válido.");
  return rows[0];
}

async function resolveBreed(
  context: KeystoneContext,
  typeId: string,
  breed?: string | null,
) {
  const key = breed?.trim();
  if (key) {
    const rows = (await context.sudo().query.AnimalBreed.findMany({
      where: {
        animal_type: { id: { equals: typeId } },
        OR: [{ id: { equals: key } }, { breed: { equals: key } }],
      },
      query: "id breed",
      take: 1,
    })) as Array<{ id: string }>;
    if (rows[0]) return rows[0].id;
  }
  const fallback = (await context.sudo().query.AnimalBreed.findMany({
    where: { animal_type: { id: { equals: typeId } } },
    query: "id breed",
    take: 50,
  })) as Array<{ id: string; breed?: string | null }>;
  const mestizo = fallback.find((row) =>
    /mestiz|crioll|sin raza|no se|desconoc/i.test(row.breed || ""),
  );
  return (mestizo || fallback[0])?.id || null;
}

async function storeRemoteImage(context: KeystoneContext, url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "KadeshPet/1.0 (https://pet.kadesh.com.mx)" },
  });
  if (!res.ok) throw new GraphQLError("No se pudo descargar una imagen del reporte.");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 8 * 1024 * 1024) {
    throw new GraphQLError("Una imagen pesa más de 8 MB.");
  }
  let probed: { type?: string; width?: number; height?: number };
  try {
    probed = imageSize(buffer);
  } catch {
    throw new GraphQLError("La imagen debe ser jpg, png o webp.");
  }
  if (probed.type !== "jpg" && probed.type !== "png" && probed.type !== "webp") {
    throw new GraphQLError("La imagen debe ser jpg, png o webp.");
  }
  const images = context.images("s3_animals");
  const stored = await images.getDataFromStream(
    Readable.from(buffer),
    `reporte.${probed.type}`,
  );
  return stored as {
    id: string;
    extension: string;
    filesize: number;
    width: number;
    height: number;
  };
}

const resolver = {
  createAnimalReport: async (
    _root: unknown,
    { input }: { input: ReportInput },
    context: KeystoneContext,
  ) => {
    try {
      assertCanCreate(context);
      const phone = requirePhone(input.phone, "teléfono del dueño");
      const phone2 = optionalPhone(input.phone2);
      const animalType = await resolveType(context, input.type);
      const breedId = await resolveBreed(context, animalType.id, input.breed);
      const reportedBy = input.reportedBy === "volunteer" ? "volunteer" : "owner";
      const addressText = input.addressText?.trim() || "";
      const place = await fillCityFromCoordinates({
        lat: input.lat,
        lng: input.lng,
      });
      const placeLabel = addressText ? placeLabelFromAddress(addressText) : "";

      const duplicates = await findReportDuplicates(context, {
        sourceUrl: input.sourceUrl,
        phone,
        animalTypeId: animalType.id,
        name: input.name,
      });
      if (duplicates.length && !input.confirmDuplicate) {
        throw new GraphQLError(
          `Parece que este reporte ya existe: ${duplicates[0].url}`,
        );
      }

      const sessionUser = getSessionUserId(context.session);
      const userId =
        input.reporterUserId?.trim() ||
        sessionUser ||
        process.env.PET_AUTOMATION_USER_ID?.trim() ||
        "";

      const animal = (await context.sudo().query.Animal.createOne({
        data: {
          name: input.name.trim() || "Sin nombre",
          contactNumber: phone,
          contactNumber2: phone2,
          sex: input.sex?.trim() || "unknown",
          physical_description: input.marks?.trim() || "",
          age: input.age?.trim() || "",
          color: input.color?.trim() || "",
          size: input.size?.trim() || "",
          sourceUrl: input.sourceUrl?.trim() || "",
          reportedBy,
          animal_type: { connect: { id: animalType.id } },
          ...(breedId ? { animal_breed: { connect: { id: breedId } } } : {}),
          ...(userId ? { user: { connect: { id: userId } } } : {}),
        },
        query: "id slug",
      })) as { id: string; slug?: string | null };

      await context.sudo().query.AnimalLog.createOne({
        data: {
          animal: { connect: { id: animal.id } },
          status: input.status.trim(),
          notes: input.note?.trim() || "Sin información adicional",
          lat: String(input.lat),
          lng: String(input.lng),
          address: addressText,
          city: place.city,
          state: place.state,
          country: place.country || "México",
          neighborhood: place.neighborhood,
          postalCode: place.postalCode,
          placeLabel,
          last_seen: input.status !== "in_adoption",
          date_status: parseLostDate(input.lostDate),
        },
        query: "id",
      });

      const urls = (input.imageUrls || []).map((url) => url.trim()).filter(Boolean).slice(0, 3);
      for (let index = 0; index < urls.length; index += 1) {
        const stored = await storeRemoteImage(context, urls[index]);
        await context.sudo().prisma.animalMultimedia.create({
          data: {
            animalId: animal.id,
            order: index + 1,
            image_id: stored.id,
            image_extension: stored.extension,
            image_filesize: stored.filesize,
            image_width: stored.width,
            image_height: stored.height,
          },
        });
      }
      if (urls.length) noteAnimalCoverSaved(animal.id, context);

      const fresh = (await context.sudo().query.Animal.findOne({
        where: { id: animal.id },
        query: "id slug",
      })) as { id: string; slug?: string | null } | null;
      const slug = fresh?.slug || animal.slug || animal.id;
      return { id: animal.id, slug, url: petPublicUrl(slug) };
    } catch (error) {
      console.error("[animal] createAnimalReport", error);
      if (error instanceof GraphQLError) throw error;
      const message = error instanceof Error ? error.message : "No se pudo publicar el reporte.";
      throw new GraphQLError(message);
    }
  },
};

const createAnimalReport = { typeDefs, definition, resolver };
export default createAnimalReport;
