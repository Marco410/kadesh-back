"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default
});
module.exports = __toCommonJS(keystone_exports);

// env.ts
var path = require("path");
var dotenv = require("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), "config", ".env.dev") });

// models/Animal/Animal.ts
var import_core = require("@keystone-6/core");
var import_fields = require("@keystone-6/core/fields");

// utils/generalAccess/access.ts
var access = {
  operation: {
    query: () => true,
    create: () => true,
    update: () => true,
    delete: () => true
  },
  filter: {
    query: () => true,
    update: () => true,
    delete: () => true
  }
};
var access_default = access;

// utils/constants/constants.ts
var ANIMAL_TYPE_OPTIONS = [
  { label: "Perro", value: "dog" /* DOG */ },
  { label: "Gato", value: "cat" /* CAT */ },
  { label: "Ave", value: "bird" /* BIRD */ },
  { label: "Pez", value: "fish" /* FISH */ },
  { label: "Reptil", value: "reptil" /* REPTIL */ },
  { label: "Mam\xEDfero", value: "mammal" /* MAMMAL */ }
];
var ANIMAL_SEX_OPTIONS = [
  { label: "Macho", value: "male" },
  { label: "Hembra", value: "female" },
  { label: "Desconocido", value: "unknown" }
];
var ANIMAL_LOGS_OPTIONS = [
  {
    label: "Registrado",
    value: "register"
  },
  {
    label: "Adoptado",
    value: "adopted"
  },
  {
    label: "Abandonado",
    value: "abandoned"
  },
  {
    label: "Rescatado",
    value: "rescued"
  },
  {
    label: "En familia",
    value: "in_family"
  },
  {
    label: "Perdido",
    value: "lost"
  },
  {
    label: "Encontrado",
    value: "found"
  }
];
var PRODUCT_CATEGORIES = [
  { label: "Croquetas", value: "croquetas" },
  { label: "Limpieza", value: "limpieza" }
];
var BRANDS = [
  { label: "Purina", value: "purina" },
  { label: "DogShow", value: "dogshow" }
];
var ORDER_STATUS = [
  { label: "Pendiente", value: "pending" },
  { label: "Preparando", value: "preparing" },
  { label: "Validando", value: "validating" },
  { label: "Enviada", value: "sent" },
  { label: "Cancelada", value: "cancelled" },
  { label: "Completada", value: "completed" }
];
var PAYMENT_TYPES = [
  { label: "Tarjeta d\xE9bito", value: "debit" },
  { label: "Tarjeta cr\xE9dito", value: "credit" },
  { label: "Transferencia", value: "transfer" },
  { label: "Stripe", value: "stripe" }
];
var TYPES_PET_SHELTER = [
  {
    label: "Veterinaria",
    plural: "Veterinarias",
    value: "veterinary"
  },
  {
    label: "Refugio",
    plural: "Refugios",
    value: "pet_shelter"
  },
  {
    label: "Tienda",
    plural: "Tiendas",
    value: "pet_store"
  },
  {
    label: "Hotel/Guarder\xEDa",
    plural: "Hoteles/Guarder\xEDas",
    value: "pet_boarding"
  },
  {
    label: "Parque",
    plural: "Parques",
    value: "pet_park"
  },
  {
    label: "Otro",
    plural: "Otros",
    value: "other"
  }
];
var TYPES_AD = [
  {
    label: "Producto",
    value: "product"
  },
  {
    label: "Lugar",
    value: "pet_place"
  },
  {
    label: "Servicio",
    value: "service"
  }
];
var STATUS_AD = [
  {
    label: "Pendiente",
    value: "pending"
  },
  {
    label: "Aprobado",
    value: "approved"
  },
  {
    label: "Rechazado",
    value: "rejected"
  }
];
var POST_CATEGORIES = [
  { label: "Cuidado y Salud", value: "care_health" },
  { label: "Alimentaci\xF3n", value: "nutrition" },
  { label: "Entrenamiento", value: "training" },
  { label: "Razas", value: "breeds" },
  { label: "Adopci\xF3n", value: "adoption" },
  { label: "Noticias", value: "news" },
  { label: "Consejos", value: "tips" },
  { label: "Otro", value: "other" }
];

// models/Animal/Animal.ts
var Animal_default = (0, import_core.list)({
  access: access_default,
  fields: {
    name: (0, import_fields.text)({ validation: { isRequired: true } }),
    sex: (0, import_fields.select)({
      options: ANIMAL_SEX_OPTIONS,
      defaultValue: "male"
    }),
    animal_type: (0, import_fields.relationship)({
      ref: "AnimalType",
      many: false
    }),
    animal_breed: (0, import_fields.relationship)({
      ref: "AnimalBreed",
      many: false
    }),
    user: (0, import_fields.relationship)({
      ref: "User",
      many: false
    }),
    multimedia: (0, import_fields.relationship)({
      ref: "AnimalMultimedia.animal",
      many: true
    }),
    logs: (0, import_fields.relationship)({
      ref: "AnimalLog.animal",
      many: true
    }),
    createdAt: (0, import_fields.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Animal/AnimalType/AnimalType.ts
var import_core2 = require("@keystone-6/core");
var import_fields2 = require("@keystone-6/core/fields");
var AnimalType_default = (0, import_core2.list)({
  access: access_default,
  fields: {
    name: (0, import_fields2.select)({
      defaultValue: "dog" /* DOG */,
      options: ANIMAL_TYPE_OPTIONS,
      isIndexed: "unique",
      validation: { isRequired: true }
    }),
    animal_breed: (0, import_fields2.relationship)({
      ref: "AnimalBreed.animal_type",
      many: true
    }),
    order: (0, import_fields2.integer)()
  },
  ui: {
    labelField: "name"
  }
});

// models/Animal/AnimalMultimedia/AnimalMultimedia.ts
var import_core3 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var AnimalMultimedia_default = (0, import_core3.list)({
  access: access_default,
  fields: {
    image: (0, import_fields3.image)({
      storage: "s3_animals"
    }),
    animal: (0, import_fields3.relationship)({
      ref: "Animal.multimedia"
    }),
    createdAt: (0, import_fields3.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Animal/AnimalFavorite/AnimalFavorite.ts
var import_core4 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var AnimalFavorite_default = (0, import_core4.list)({
  access: access_default,
  fields: {
    animal: (0, import_fields4.relationship)({
      ref: "Animal",
      many: false
    }),
    user: (0, import_fields4.relationship)({
      ref: "User",
      many: false
    }),
    createdAt: (0, import_fields4.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Animal/AnimalLog/AnimalLog.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var AnimalLog_default = (0, import_core5.list)({
  access: access_default,
  fields: {
    animal: (0, import_fields5.relationship)({
      ref: "Animal.logs"
    }),
    status: (0, import_fields5.select)({
      defaultValue: "Registrado",
      options: ANIMAL_LOGS_OPTIONS
    }),
    notes: (0, import_fields5.text)({
      ui: { displayMode: "textarea" }
    }),
    lat: (0, import_fields5.text)(),
    lng: (0, import_fields5.text)(),
    address: (0, import_fields5.text)(),
    city: (0, import_fields5.text)(),
    state: (0, import_fields5.text)(),
    country: (0, import_fields5.text)(),
    last_seen: (0, import_fields5.checkbox)(),
    createdAt: (0, import_fields5.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Animal/AnimalComment/AnimalComment.ts
var import_core6 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var AnimalComment_default = (0, import_core6.list)({
  access: access_default,
  fields: {
    comment: (0, import_fields6.text)({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" }
    }),
    animal: (0, import_fields6.relationship)({
      ref: "Animal",
      many: false
    }),
    user: (0, import_fields6.relationship)({
      ref: "User",
      many: false
    }),
    createdAt: (0, import_fields6.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/User/User.ts
var import_core7 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");

// utils/helpers/unike_link.ts
function genUniqueLink(link) {
  return link.toLowerCase().replace(/ñ/g, "n").replace(/\s+/g, ".");
}

// models/Role/constants.ts
var ROLES = [
  { label: "Admin", value: "admin" /* ADMIN */ },
  { label: "User", value: "user" /* USER */ },
  { label: "Author", value: "author" /* AUTHOR */ }
];

// models/User/User.hooks.ts
var phoneHooks = {
  validateInput: async ({ resolvedData, addValidationError }) => {
    const { phone } = resolvedData;
    if (phone) {
      const pattern = /\+?\d{10,}(?:-?\d+)*$/;
      if (!pattern.test(phone) || phone.length < 10 && phone.length !== 0) {
        addValidationError(
          "El tel\xE9fono debe ser de 10 d\xEDgitos y puros n\xFAmeros"
        );
      }
    }
    return phone;
  }
};
var emailHooks = {
  validateInput: async ({ resolvedData, addValidationError }) => {
    const { email } = resolvedData;
    if (email && email !== "") {
      const pattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      if (!pattern.test(email)) {
        addValidationError("El formato del correo es incorrecto");
      }
    }
    return email;
  }
};
var userNameHook = {
  resolveInput: async ({ resolvedData, item, context }) => {
    if (item && resolvedData.username) {
      return resolvedData.username;
    }
    if (item && !resolvedData.username) {
      return item.username;
    }
    if (!item && resolvedData.username) {
      return resolvedData.username;
    }
    if (!item && !resolvedData.username) {
      const name = resolvedData.name;
      const lastName = resolvedData.lastName || "";
      if (name) {
        return checkUserName(name, lastName, context);
      }
    }
    return resolvedData.username;
  }
};
async function checkUserName(name, lastName, context) {
  if (!name) {
    throw new Error("El nombre es requerido para generar el username");
  }
  const namePart = name.trim();
  const lastNamePart = lastName ? lastName.trim() : "";
  const fullName = lastNamePart ? `${namePart} ${lastNamePart}` : namePart;
  let baseLink = genUniqueLink(fullName);
  if (!baseLink || baseLink === "") {
    baseLink = "user";
  }
  let uniqueLink = baseLink;
  let existingUser = await context.db.User.findOne({
    where: { username: uniqueLink }
  });
  let counter = 1;
  while (existingUser) {
    const randomNum1 = Math.floor(Math.random() * 100).toString();
    uniqueLink = `${baseLink}${randomNum1}`;
    existingUser = await context.db.User.findOne({
      where: { username: uniqueLink }
    });
    counter++;
  }
  return uniqueLink;
}
var userRoleHook = {
  resolveInput: async ({ resolvedData, item, operation, context }) => {
    if (operation === "create" && !item) {
      const hasRoles = resolvedData.roles && (resolvedData.roles.connect && resolvedData.roles.connect.length > 0 || resolvedData.roles.set && resolvedData.roles.set.length > 0 || resolvedData.roles.create && resolvedData.roles.create.length > 0);
      if (!hasRoles) {
        try {
          const userRole = await context.db.Role.findOne({
            where: { name: "user" /* USER */ }
          });
          if (userRole) {
            resolvedData.roles = {
              connect: [{ id: userRole.id }]
            };
          }
        } catch (error) {
          console.error("Error al asignar el role 'user':", error);
        }
      }
    }
    return resolvedData;
  }
};

// models/User/User.ts
var User_default = (0, import_core7.list)({
  access: access_default,
  hooks: {
    resolveInput: userRoleHook.resolveInput
  },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields7.text)(),
    secondLastName: (0, import_fields7.text)(),
    username: (0, import_fields7.text)({
      isIndexed: "unique",
      validation: { isRequired: true },
      hooks: userNameHook
    }),
    email: (0, import_fields7.text)({
      isIndexed: "unique",
      hooks: emailHooks
    }),
    password: (0, import_fields7.password)({
      validation: { isRequired: false },
      ui: {
        createView: {
          fieldMode: "hidden"
        }
      }
    }),
    phone: (0, import_fields7.text)({
      hooks: phoneHooks
    }),
    roles: (0, import_fields7.relationship)({
      ref: "Role.users",
      many: true
    }),
    profileImage: (0, import_fields7.image)({ storage: "s3_profile" }),
    birthday: (0, import_fields7.calendarDay)(),
    age: (0, import_fields7.virtual)({
      field: import_core7.graphql.field({
        type: import_core7.graphql.String,
        async resolve(item) {
          if (item?.birthday) {
            const today = /* @__PURE__ */ new Date();
            const birthDate = new Date(item.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
              age -= 1;
            }
            return age.toString();
          }
          return "";
        }
      })
    }),
    smsRegistrationId: (0, import_fields7.text)(),
    verified: (0, import_fields7.checkbox)(),
    createdAt: (0, import_fields7.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Animal/AnimalBreed/AnimalBreed.ts
var import_core8 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var AnimalBreed_default = (0, import_core8.list)({
  access: access_default,
  fields: {
    breed: (0, import_fields8.text)(),
    animal_type: (0, import_fields8.relationship)({
      ref: "AnimalType.animal_breed"
    })
  },
  ui: {
    labelField: "breed"
  }
});

// models/Pet/Pet.ts
var import_core9 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var Pet_default = (0, import_core9.list)({
  access: access_default,
  fields: {
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    birthday: (0, import_fields9.calendarDay)({ validation: { isRequired: true } }),
    age: (0, import_fields9.virtual)({
      field: import_core9.graphql.field({
        type: import_core9.graphql.String,
        async resolve(item) {
          if (item?.birthday) {
            const today = /* @__PURE__ */ new Date();
            const birthDate = new Date(item.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
              age -= 1;
            }
            return age.toString();
          }
          return "";
        }
      })
    }),
    animal_type: (0, import_fields9.relationship)({
      ref: "AnimalType",
      many: false
    }),
    animal_breed: (0, import_fields9.relationship)({
      ref: "AnimalBreed",
      many: false
    }),
    user: (0, import_fields9.relationship)({
      ref: "User",
      many: false
    }),
    multimedia: (0, import_fields9.relationship)({
      ref: "PetMultimedia.pet",
      many: true
    }),
    createdAt: (0, import_fields9.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Pet/PetMultimedia/PetMultimedia.ts
var import_core10 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var PetMultimedia_default = (0, import_core10.list)({
  access: access_default,
  fields: {
    image: (0, import_fields10.image)({
      storage: "s3_pets"
    }),
    pet: (0, import_fields10.relationship)({
      ref: "Pet.multimedia"
    }),
    createdAt: (0, import_fields10.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/PetPlace/PetPlace.ts
var import_core12 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");

// models/Schedule/Schedule.ts
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var Schedule_default = (0, import_core11.list)({
  access: access_default,
  fields: {
    day: (0, import_fields11.select)({
      options: [
        "Domingo" /* DOM */,
        "Lunes" /* LUN */,
        "Martes" /* MAR */,
        "Mi\xE9rcoles" /* MIER */,
        "Jueves" /* JUEV */,
        "Viernes" /* VIE */,
        "S\xE1bado" /* SAB */
      ],
      validation: { isRequired: true }
    }),
    timeIni: (0, import_fields11.integer)({ validation: { isRequired: true } }),
    timeEnd: (0, import_fields11.integer)({ validation: { isRequired: true } }),
    pet_place: (0, import_fields11.relationship)({
      ref: "PetPlace.pet_place_schedules"
    }),
    createdAt: (0, import_fields11.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});
var dayNames = {
  0: "Domingo" /* DOM */,
  1: "Lunes" /* LUN */,
  2: "Martes" /* MAR */,
  3: "Mi\xE9rcoles" /* MIER */,
  4: "Jueves" /* JUEV */,
  5: "Viernes" /* VIE */,
  6: "S\xE1bado" /* SAB */
};

// models/PetPlace/PetPlace.ts
var PetPlace_default = (0, import_core12.list)({
  access: access_default,
  fields: {
    name: (0, import_fields12.text)({ validation: { isRequired: true } }),
    description: (0, import_fields12.text)({ validation: { isRequired: true } }),
    phone: (0, import_fields12.text)(),
    website: (0, import_fields12.text)(),
    street: (0, import_fields12.text)(),
    municipality: (0, import_fields12.text)(),
    state: (0, import_fields12.text)(),
    country: (0, import_fields12.text)(),
    cp: (0, import_fields12.text)(),
    lat: (0, import_fields12.text)(),
    lng: (0, import_fields12.text)(),
    views: (0, import_fields12.integer)(),
    types: (0, import_fields12.relationship)({
      ref: "PetPlaceType",
      many: true
    }),
    services: (0, import_fields12.relationship)({
      ref: "PetPlaceService",
      many: true
    }),
    user: (0, import_fields12.relationship)({
      ref: "User",
      many: false
    }),
    isOpen: (0, import_fields12.virtual)({
      field: import_core12.graphql.field({
        type: import_core12.graphql.Boolean,
        async resolve(item, args, context) {
          const today = /* @__PURE__ */ new Date();
          const schedules = await context.query.Schedule.findMany({
            where: {
              pet_place: {
                id: {
                  equals: item.id
                }
              }
            },
            query: "day timeIni timeEnd"
          });
          if (schedules.length == 0) return false;
          let isInRange = schedules.some((e) => {
            if (e.day === dayNames[today.getDay()]) {
              if (today.getHours() >= e.timeIni && today.getHours() <= e.timeEnd) {
                return true;
              } else {
                return false;
              }
            }
            return false;
          });
          return isInRange;
        }
      })
    }),
    pet_place_social_media: (0, import_fields12.relationship)({
      ref: "SocialMedia.pet_place",
      many: true
    }),
    pet_place_likes: (0, import_fields12.relationship)({
      ref: "PetPlaceLike.pet_place",
      many: true
    }),
    pet_place_schedules: (0, import_fields12.relationship)({
      ref: "Schedule.pet_place",
      many: true
    }),
    pet_place_reviews: (0, import_fields12.relationship)({
      ref: "Review.pet_place",
      many: true
    }),
    pet_place_ads: (0, import_fields12.relationship)({
      ref: "Ad.pet_place",
      many: true
    }),
    address: (0, import_fields12.text)(),
    google_place_id: (0, import_fields12.text)({
      isIndexed: "unique",
      validation: { isRequired: false }
    }),
    google_opening_hours: (0, import_fields12.text)(),
    createdAt: (0, import_fields12.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/PetPlace/PetPlaceLike/PetPlaceLike.ts
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var PetPlaceLike_default = (0, import_core13.list)({
  access: access_default,
  fields: {
    user: (0, import_fields13.relationship)({
      ref: "User",
      many: false
    }),
    pet_place: (0, import_fields13.relationship)({
      ref: "PetPlace.pet_place_likes"
    }),
    createdAt: (0, import_fields13.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/PetPlace/PetPlaceService/PetPlaceService.ts
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var PetPlaceService_default = (0, import_core14.list)({
  access: access_default,
  fields: {
    name: (0, import_fields14.text)(),
    slug: (0, import_fields14.text)(),
    description: (0, import_fields14.text)({ ui: { displayMode: "textarea" } }),
    active: (0, import_fields14.checkbox)(),
    createdAt: (0, import_fields14.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/SocialMedia/SocialMedia.ts
var import_core15 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var SocialMedia_default = (0, import_core15.list)({
  access: access_default,
  fields: {
    social_media: (0, import_fields15.select)({
      options: ["Facebook", "Instagram", "X", "LinkedIn"],
      validation: { isRequired: true }
    }),
    link: (0, import_fields15.text)({
      validation: { isRequired: true }
    }),
    pet_place: (0, import_fields15.relationship)({
      ref: "PetPlace.pet_place_social_media"
    }),
    createdAt: (0, import_fields15.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Review/Review.ts
var import_core16 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var Review_default = (0, import_core16.list)({
  access: access_default,
  fields: {
    rating: (0, import_fields16.integer)(),
    review: (0, import_fields16.text)(),
    pet_place: (0, import_fields16.relationship)({
      ref: "PetPlace.pet_place_reviews"
    }),
    product: (0, import_fields16.relationship)({
      ref: "Product.product_reviews"
    }),
    user: (0, import_fields16.relationship)({
      ref: "User",
      many: false
    }),
    google_user: (0, import_fields16.text)(),
    google_user_photo: (0, import_fields16.text)(),
    createdAt: (0, import_fields16.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});
var dayNames2 = {
  0: "Domingo" /* DOM */,
  1: "Lunes" /* LUN */,
  2: "Martes" /* MAR */,
  3: "Mi\xE9rcoles" /* MIER */,
  4: "Jueves" /* JUEV */,
  5: "Viernes" /* VIE */,
  6: "S\xE1bado" /* SAB */
};

// models/Store/Product/Product.ts
var import_core17 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var Product_default = (0, import_core17.list)({
  access: access_default,
  fields: {
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    price: (0, import_fields17.integer)({ validation: { isRequired: true } }),
    description: (0, import_fields17.text)({ validation: { isRequired: true } }),
    category: (0, import_fields17.select)({
      validation: { isRequired: true },
      options: PRODUCT_CATEGORIES
    }),
    brand: (0, import_fields17.select)({
      validation: { isRequired: true },
      options: BRANDS
    }),
    type: (0, import_fields17.select)({
      validation: { isRequired: true },
      options: ANIMAL_TYPE_OPTIONS
    }),
    product_reviews: (0, import_fields17.relationship)({
      ref: "Review.product",
      many: true
    }),
    product_ads: (0, import_fields17.relationship)({
      ref: "Ad.product",
      many: true
    }),
    createdAt: (0, import_fields17.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Store/WishList/WishList.ts
var import_core18 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var WishList_default = (0, import_core18.list)({
  access: access_default,
  fields: {
    name: (0, import_fields18.text)({ validation: { isRequired: true } }),
    user: (0, import_fields18.relationship)({
      ref: "User",
      many: false
    }),
    product: (0, import_fields18.relationship)({
      ref: "Product",
      many: true
    }),
    createdAt: (0, import_fields18.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Store/Cart/Cart.ts
var import_core19 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var Cart_default = (0, import_core19.list)({
  access: access_default,
  fields: {
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    user: (0, import_fields19.relationship)({
      ref: "User",
      many: false
    }),
    product: (0, import_fields19.relationship)({
      ref: "Product",
      many: true
    }),
    createdAt: (0, import_fields19.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Store/Order/Order.ts
var import_core20 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var Order_default = (0, import_core20.list)({
  access: access_default,
  fields: {
    total: (0, import_fields20.integer)(),
    status: (0, import_fields20.select)({ validation: { isRequired: true }, options: ORDER_STATUS }),
    cart: (0, import_fields20.relationship)({
      ref: "Cart",
      many: false
    }),
    user: (0, import_fields20.relationship)({
      ref: "User",
      many: false
    }),
    payment: (0, import_fields20.relationship)({
      ref: "Payment.order_payment",
      many: false
    }),
    createdAt: (0, import_fields20.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Store/Payment/Payment.ts
var import_fields21 = require("@keystone-6/core/fields");
var import_core21 = require("@keystone-6/core");
var Payment_default = (0, import_core21.list)({
  access: access_default,
  fields: {
    order_payment: (0, import_fields21.relationship)({
      ref: "Order.payment"
    }),
    paymentMethod: (0, import_fields21.relationship)({
      ref: "PaymentMethod.payment"
    }),
    amount: (0, import_fields21.decimal)({
      scale: 6,
      defaultValue: "0.000000"
    }),
    status: (0, import_fields21.select)({
      type: "enum",
      validation: {
        isRequired: true
      },
      defaultValue: "pending",
      options: [
        { label: "Pendiente", value: "pending" },
        { label: "Procesando", value: "processing" },
        { label: "Exitoso", value: "succeeded" },
        { label: "Cancelado", value: "cancelled" },
        { label: "Fallido", value: "failed" },
        { label: "Devuelto", value: "refunded" }
      ]
    }),
    processorStripeChargeId: (0, import_fields21.text)(),
    stripeErrorMessage: (0, import_fields21.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    processorRefundId: (0, import_fields21.text)(),
    createdAt: (0, import_fields21.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields21.timestamp)({
      defaultValue: { kind: "now" },
      db: { updatedAt: true }
    })
  }
});

// models/Store/PaymentMethod/PaymentMethod.ts
var import_fields22 = require("@keystone-6/core/fields");
var import_core22 = require("@keystone-6/core");
var PaymentMethod_default = (0, import_core22.list)({
  access: access_default,
  fields: {
    user: (0, import_fields22.relationship)({
      ref: "User"
    }),
    cardType: (0, import_fields22.text)(),
    isDefault: (0, import_fields22.checkbox)(),
    lastFourDigits: (0, import_fields22.text)(),
    expMonth: (0, import_fields22.text)(),
    expYear: (0, import_fields22.text)(),
    stripeProcessorId: (0, import_fields22.text)(),
    address: (0, import_fields22.text)(),
    postalCode: (0, import_fields22.text)(),
    ownerName: (0, import_fields22.text)(),
    country: (0, import_fields22.text)(),
    // Two-letter country code (ISO 3166-1 alpha-2).
    payment: (0, import_fields22.relationship)({
      ref: "Payment.paymentMethod",
      many: true
    }),
    type: (0, import_fields22.select)({ options: PAYMENT_TYPES }),
    createdAt: (0, import_fields22.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields22.timestamp)({
      defaultValue: { kind: "now" },
      db: { updatedAt: true }
    })
  }
});

// models/TokenNotification/TokenNotification.ts
var import_fields23 = require("@keystone-6/core/fields");
var import_core23 = require("@keystone-6/core");

// models/TokenNotification/TokenNotification.hooks.ts
var hooks = {
  validateInput: async ({
    context,
    operation,
    resolvedData,
    addValidationError
  }) => {
    if (operation === "create") {
      try {
        const userId = resolvedData?.user.connect.id;
        const tokenOld = await context.query.TokenNotification.findMany({
          where: {
            token: {
              equals: resolvedData?.token
            },
            user: {
              id: {
                equals: userId
              }
            }
          },
          query: "token"
        });
        if (tokenOld.length === 0) {
          return resolvedData;
        }
        addValidationError("Token exists");
      } catch (e) {
        console.log("Token notification error:", e);
      }
    }
    return resolvedData;
  }
};
var TokenNotification_hooks_default = { hooks };

// models/TokenNotification/TokenNotification.ts
var TokenNotification_default = (0, import_core23.list)({
  access: access_default,
  hooks: TokenNotification_hooks_default.hooks,
  fields: {
    token: (0, import_fields23.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    user: (0, import_fields23.relationship)({
      ref: "User",
      many: false
    })
  }
});

// models/Ad/Ad.ts
var import_core24 = require("@keystone-6/core");
var import_fields24 = require("@keystone-6/core/fields");
var Ad_default = (0, import_core24.list)({
  access: access_default,
  fields: {
    title: (0, import_fields24.text)(),
    description: (0, import_fields24.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    active: (0, import_fields24.checkbox)(),
    start_date: (0, import_fields24.calendarDay)(),
    end_date: (0, import_fields24.calendarDay)(),
    price: (0, import_fields24.integer)(),
    status: (0, import_fields24.select)({
      options: STATUS_AD
    }),
    type: (0, import_fields24.select)({
      options: TYPES_AD
    }),
    lat: (0, import_fields24.text)(),
    lng: (0, import_fields24.text)(),
    image: (0, import_fields24.image)({
      storage: "s3_ads"
    }),
    pet_place: (0, import_fields24.relationship)({
      ref: "PetPlace.pet_place_ads"
    }),
    product: (0, import_fields24.relationship)({
      ref: "Product.product_ads"
    }),
    user: (0, import_fields24.relationship)({
      ref: "User",
      many: false
    }),
    createdAt: (0, import_fields24.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Post/Post.ts
var import_core25 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");

// models/Blog/Post/Post.hooks.ts
var postUrlHook = {
  resolveInput: async ({ resolvedData, item, context }) => {
    if (item && !resolvedData.title) {
      return item.url;
    }
    if (resolvedData.title) {
      return checkPostUrl(resolvedData.title, item?.id, context);
    }
    return item?.url || null;
  }
};
function sanitizeUrl(title) {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;
  let cleaned = title.replace(emojiRegex, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ñ/g, "n").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned;
}
async function checkPostUrl(title, currentPostId, context) {
  let baseLink = sanitizeUrl(title);
  if (!baseLink || baseLink.length === 0) {
    baseLink = "post";
  }
  let uniqueLink = baseLink;
  let existingPost = await context.db.Post.findOne({
    where: { url: uniqueLink }
  });
  if (existingPost && existingPost.id !== currentPostId) {
    let counter = 1;
    while (existingPost && existingPost.id !== currentPostId) {
      uniqueLink = `${baseLink}-${counter}`;
      existingPost = await context.db.Post.findOne({
        where: { url: uniqueLink }
      });
      counter++;
    }
  }
  return uniqueLink;
}
var publishedAtHook = {
  resolveInput: async ({ resolvedData, item, operation }) => {
    if (resolvedData.published === true) {
      resolvedData.publishedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    return resolvedData;
  }
};

// models/Blog/Post/Post.ts
var import_fields_document = require("@keystone-6/fields-document");
var Post_default = (0, import_core25.list)({
  access: access_default,
  hooks: {
    resolveInput: publishedAtHook.resolveInput
  },
  fields: {
    title: (0, import_fields25.text)({ validation: { isRequired: true } }),
    url: (0, import_fields25.text)({
      isIndexed: "unique",
      hooks: postUrlHook,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    content: (0, import_fields_document.document)({
      formatting: true,
      dividers: true,
      links: true
    }),
    excerpt: (0, import_fields25.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    image: (0, import_fields25.image)({
      storage: "s3_posts"
    }),
    published: (0, import_fields25.checkbox)({
      defaultValue: false
    }),
    publishedAt: (0, import_fields25.timestamp)({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "edit" }
      }
    }),
    category: (0, import_fields25.relationship)({
      ref: "Category.posts",
      many: false
    }),
    tags: (0, import_fields25.relationship)({
      ref: "Tag.posts",
      many: true
    }),
    author: (0, import_fields25.relationship)({
      ref: "User",
      many: false
    }),
    comments: (0, import_fields25.relationship)({
      ref: "PostComment.post",
      many: true
    }),
    post_likes: (0, import_fields25.relationship)({
      ref: "PostLike.post",
      many: true
    }),
    post_favorites: (0, import_fields25.relationship)({
      ref: "PostFavorite.post",
      many: true
    }),
    post_views: (0, import_fields25.relationship)({
      ref: "PostView.post",
      many: true
    }),
    createdAt: (0, import_fields25.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields25.timestamp)({
      defaultValue: {
        kind: "now"
      },
      db: {
        updatedAt: true
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Post/PostComment/PostComment.ts
var import_core26 = require("@keystone-6/core");
var import_fields26 = require("@keystone-6/core/fields");
var PostComment_default = (0, import_core26.list)({
  access: access_default,
  fields: {
    comment: (0, import_fields26.text)({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" }
    }),
    post: (0, import_fields26.relationship)({
      ref: "Post.comments",
      many: false
    }),
    user: (0, import_fields26.relationship)({
      ref: "User",
      many: false
    }),
    createdAt: (0, import_fields26.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields26.timestamp)({
      defaultValue: {
        kind: "now"
      },
      db: {
        updatedAt: true
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Post/PostLike/PostLike.ts
var import_core27 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var PostLike_default = (0, import_core27.list)({
  access: access_default,
  fields: {
    user: (0, import_fields27.relationship)({
      ref: "User",
      many: false
    }),
    post: (0, import_fields27.relationship)({
      ref: "Post.post_likes",
      many: false
    }),
    createdAt: (0, import_fields27.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Post/PostFavorite/PostFavorite.ts
var import_core28 = require("@keystone-6/core");
var import_fields28 = require("@keystone-6/core/fields");
var PostFavorite_default = (0, import_core28.list)({
  access: access_default,
  fields: {
    user: (0, import_fields28.relationship)({
      ref: "User",
      many: false
    }),
    post: (0, import_fields28.relationship)({
      ref: "Post.post_favorites",
      many: false
    }),
    createdAt: (0, import_fields28.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Post/PostView/PostView.ts
var import_core29 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var PostView_default = (0, import_core29.list)({
  access: access_default,
  fields: {
    user: (0, import_fields29.relationship)({
      ref: "User",
      many: false
    }),
    post: (0, import_fields29.relationship)({
      ref: "Post.post_views",
      many: false
    }),
    createdAt: (0, import_fields29.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Tag/Tag.ts
var import_core30 = require("@keystone-6/core");
var import_fields30 = require("@keystone-6/core/fields");
var Tag_default = (0, import_core30.list)({
  access: access_default,
  fields: {
    name: (0, import_fields30.text)({
      validation: { isRequired: true },
      isIndexed: "unique"
    }),
    posts: (0, import_fields30.relationship)({
      ref: "Post.tags",
      many: true
    }),
    createdAt: (0, import_fields30.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Blog/Category/Category.ts
var import_core31 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");

// models/Blog/Category/Category.hooks.ts
function sanitizeUrl2(text24) {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;
  let cleaned = text24.replace(emojiRegex, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ñ/g, "n").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned;
}
var categoryUrlHook = {
  resolveInput: async ({ resolvedData, item, context }) => {
    if (item && !resolvedData.name) {
      return item.url;
    }
    if (resolvedData.name) {
      return checkCategoryUrl(resolvedData.name, item?.id, context);
    }
    return item?.url || null;
  }
};
async function checkCategoryUrl(name, currentCategoryId, context) {
  let baseLink = sanitizeUrl2(name);
  if (!baseLink || baseLink.length === 0) {
    baseLink = "category";
  }
  let uniqueLink = baseLink;
  let existingCategory = await context.db.Category.findOne({
    where: { url: uniqueLink }
  });
  if (existingCategory && existingCategory.id !== currentCategoryId) {
    let counter = 1;
    while (existingCategory && existingCategory.id !== currentCategoryId) {
      uniqueLink = `${baseLink}-${counter}`;
      existingCategory = await context.db.Category.findOne({
        where: { url: uniqueLink }
      });
      counter++;
    }
  }
  return uniqueLink;
}

// models/Blog/Category/Category.ts
var Category_default = (0, import_core31.list)({
  access: access_default,
  fields: {
    name: (0, import_fields31.select)({
      options: POST_CATEGORIES,
      isIndexed: "unique"
    }),
    url: (0, import_fields31.text)({
      isIndexed: "unique",
      hooks: categoryUrlHook,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    image: (0, import_fields31.image)({
      storage: "s3_categories"
    }),
    posts: (0, import_fields31.relationship)({
      ref: "Post.category",
      many: true
    }),
    createdAt: (0, import_fields31.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Role/Role.ts
var import_core32 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var Role_default = (0, import_core32.list)({
  access: access_default,
  fields: {
    name: (0, import_fields32.select)({
      options: ROLES,
      isIndexed: "unique"
    }),
    users: (0, import_fields32.relationship)({
      ref: "User.roles",
      many: true
    }),
    createdAt: (0, import_fields32.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/PetPlace/PetPlaceType/PetPlaceType.ts
var import_core33 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var PET_PLACE_TYPE_OPTIONS = TYPES_PET_SHELTER.map((type) => ({
  label: type.label,
  value: type.value
}));
var labelHook = {
  resolveInput: async ({ resolvedData, item }) => {
    if (resolvedData.value) {
      const typeData = TYPES_PET_SHELTER.find((t) => t.value === resolvedData.value);
      return typeData ? typeData.label : resolvedData.label || item?.label;
    }
    return resolvedData.label || item?.label;
  }
};
var pluralHook = {
  resolveInput: async ({ resolvedData, item }) => {
    if (resolvedData.value) {
      const typeData = TYPES_PET_SHELTER.find((t) => t.value === resolvedData.value);
      return typeData ? typeData.plural : resolvedData.plural || item?.plural;
    }
    return resolvedData.plural || item?.plural;
  }
};
var PetPlaceType_default = (0, import_core33.list)({
  access: access_default,
  fields: {
    value: (0, import_fields33.select)({
      validation: { isRequired: true },
      isIndexed: "unique",
      options: PET_PLACE_TYPE_OPTIONS
    }),
    label: (0, import_fields33.text)({
      isIndexed: "unique",
      hooks: labelHook,
      ui: {
        itemView: { fieldMode: "read" }
      }
    }),
    plural: (0, import_fields33.text)({
      hooks: pluralHook,
      ui: {
        itemView: { fieldMode: "read" }
      }
    })
  },
  ui: {
    labelField: "label"
  }
});

// models/schema.ts
var schema_default = {
  User: User_default,
  Animal: Animal_default,
  AnimalType: AnimalType_default,
  AnimalMultimedia: AnimalMultimedia_default,
  AnimalFavorite: AnimalFavorite_default,
  AnimalLog: AnimalLog_default,
  AnimalComment: AnimalComment_default,
  AnimalBreed: AnimalBreed_default,
  Pet: Pet_default,
  PetMultimedia: PetMultimedia_default,
  PetPlace: PetPlace_default,
  PetPlaceType: PetPlaceType_default,
  PetPlaceLike: PetPlaceLike_default,
  PetPlaceService: PetPlaceService_default,
  Schedule: Schedule_default,
  SocialMedia: SocialMedia_default,
  Review: Review_default,
  Product: Product_default,
  WishList: WishList_default,
  Cart: Cart_default,
  Order: Order_default,
  Payment: Payment_default,
  PaymentMethod: PaymentMethod_default,
  TokenNotification: TokenNotification_default,
  Ad: Ad_default,
  Post: Post_default,
  PostComment: PostComment_default,
  PostLike: PostLike_default,
  PostFavorite: PostFavorite_default,
  PostView: PostView_default,
  Tag: Tag_default,
  Category: Category_default,
  Role: Role_default
};

// keystone.ts
var import_core34 = require("@keystone-6/core");

// auth/auth.ts
var import_crypto = require("crypto");
var import_auth = require("@keystone-6/auth");
var import_session = require("@keystone-6/core/session");
var sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV !== "production") {
  sessionSecret = (0, import_crypto.randomBytes)(32).toString("hex");
}
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  // this is a GraphQL query fragment for fetching what data will be attached to a context.session
  //   this can be helpful for when you are writing your access control functions
  //   you can find out more at https://keystonejs.com/docs/guides/auth-and-access-control
  sessionData: "id name lastName username email verified profileImage { url } phone roles { name } createdAt",
  secretField: "password",
  // WARNING: remove initFirstItem functionality in production
  //   see https://keystonejs.com/docs/config/auth#init-first-item for more
  initFirstItem: {
    // if there are no items in the database, by configuring this field
    //   you are asking the Keystone AdminUI to create a new user
    //   providing inputs for these fields
    fields: ["name", "lastName", "username", "email", "password", "roles"]
    // it uses context.sudo() to do this, which bypasses any access control you might have
    //   you shouldn't use this in production
  }
});
var sessionMaxAge = 60 * 60 * 24 * 365 * 100;
var session = (0, import_session.statelessSessions)({
  maxAge: sessionMaxAge,
  secret: sessionSecret
});

// graphql/extendedSchema.ts
var import_schema = require("@graphql-tools/schema");

// graphql/customs/mutations/auth/customAuth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_crypto2 = require("crypto");
var typeDefs = `
  type customAuthType {
    message: String,
    success: Boolean,
    data: JSON
  }
`;
var definition = "customAuth(email: String!, name: String, lastName: String): customAuthType";
var resolver = {
  customAuth: async (root, {
    email,
    name,
    lastName
  }, context) => {
    let userFound = await context.sudo().query.User.findOne({
      query: "id name lastName secondLastName username email phone role birthday age verified createdAt profileImage { url } ",
      where: {
        email
      }
    });
    if (!userFound) {
      userFound = await context.db.User.createOne({
        data: {
          email,
          name,
          lastName,
          username: await checkUserName(name, lastName, context),
          role: "user"
        }
      });
    }
    let sessionSecret2 = process.env.SESSION_SECRET;
    if (!sessionSecret2) {
      sessionSecret2 = (0, import_crypto2.randomBytes)(32).toString("hex");
    }
    const sessionToken = import_jsonwebtoken.default.sign(
      {
        data: {
          id: userFound.id,
          email: userFound.email
        }
      },
      sessionSecret2
    );
    console.log("userFound");
    console.log(userFound);
    return {
      success: true,
      message: "Success",
      data: {
        ...userFound,
        sessionToken
      }
    };
  }
};
var customAuth_default = { typeDefs, definition, resolver };

// graphql/customs/mutations/importPetPlace.ts
var typeDefs2 = `
  input ImportPetPlaceInput {
    inputValue: String!
    type: String!
  }
  
  type ImportPetPlaceResult {
    success: Boolean!
    message: String!
    result: String
  }
  
  type Mutation {
    executeImportPetPlace(input: ImportPetPlaceInput!): ImportPetPlaceResult!
  }
`;
var definition2 = `
  executeImportPetPlace(input: ImportPetPlaceInput!): ImportPetPlaceResult!
`;
var resolver2 = {
  executeImportPetPlace: async (root, { input }, context) => {
    try {
      console.log("Ejecutando importaci\xF3n de lugares con datos:", input.inputValue, "tipo:", input.type);
      const result = await importVeterinaries(input.inputValue, input.type, context);
      console.log("Resultados de la importaci\xF3n:", result);
      return {
        success: true,
        message: "Veterinarias importadas exitosamente",
        result
      };
    } catch (error) {
      console.error("Error importando veterinarias:", error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
        result: null
      };
    }
  }
};
async function importVeterinaries(city, type, context) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY no est\xE1 configurada en las variables de entorno");
    }
    const typeLabels = {
      "veterinary": "veterinarias",
      "pet_shelter": "refugios de animales",
      "pet_store": "tiendas de mascotas",
      "pet_boarding": "hoteles para mascotas guarder\xEDas",
      "pet_park": "parques para perros",
      "other": "lugares para mascotas"
    };
    const searchTerm = typeLabels[type] || "lugares para mascotas";
    const query = encodeURIComponent(`${searchTerm} en ${city}`);
    const baseUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${apiKey}`;
    let url = `${baseUrl}&query=${query}`;
    let importedCount = 0;
    let errors = [];
    let page = 0;
    let nextPageToken = void 0;
    let maxPagesToSearch = 1;
    do {
      if (page > 0 && nextPageToken) {
        const waitSeconds = 5;
        for (let i = 1; i <= waitSeconds; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          console.log(`Esperando... ${i} segundo(s) de ${waitSeconds}`);
        }
        url = `${baseUrl}&pagetoken=${nextPageToken}`;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error en la respuesta de la API: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status !== "OK") {
          throw new Error(`Error en la API de Google Places: ${data.status} - ${data.error_message || "Error desconocido"}`);
        }
        console.log(`Se encontraron ${data.results?.length || 0} lugares en ${city} (p\xE1gina ${page + 1})`);
        if (data.results && data.results.length > 0) {
          for (const place of data.results) {
            try {
              if (!place.name) {
                errors.push(`Lugar sin nombre: ${JSON.stringify(place)}`);
                continue;
              }
              const address = place.formatted_address || "";
              const lat = place.geometry?.location?.lat?.toString() || "";
              const lng = place.geometry?.location?.lng?.toString() || "";
              const rating = place.rating || 0;
              const userRatingsTotal = place.user_ratings_total || 0;
              const placeId = place.place_id || "";
              const existingVeterinary = await context.sudo().query.PetPlace.findOne({
                where: { google_place_id: placeId },
                query: "id"
              });
              if (existingVeterinary) {
                console.log(`Lugar con placeId ${placeId} ya registrado, se omite.`);
                continue;
              }
              let petPlaceType = await context.sudo().query.PetPlaceType.findOne({
                where: { value: type },
                query: "id"
              });
              if (!petPlaceType) {
                const typeData = TYPES_PET_SHELTER.find((t) => t.value === type);
                if (typeData) {
                  petPlaceType = await context.sudo().query.PetPlaceType.createOne({
                    data: {
                      label: typeData.label,
                      value: typeData.value,
                      plural: typeData.plural
                    }
                  });
                } else {
                  console.error(`Tipo ${type} no encontrado en TYPES_PET_SHELTER`);
                  continue;
                }
              }
              const result = await context.sudo().query.PetPlace.createOne({
                data: {
                  name: place.name,
                  description: `Lugar ubicado en ${address}. ${rating > 0 ? `Calificaci\xF3n: ${rating}/5 (${userRatingsTotal} rese\xF1as)` : ""}`,
                  types: { connect: [{ id: petPlaceType.id }] },
                  phone: "",
                  website: "",
                  street: "",
                  municipality: "",
                  state: "",
                  country: "",
                  cp: "",
                  lat,
                  lng,
                  views: 0,
                  address,
                  google_place_id: placeId
                }
              });
              if (placeId) {
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,opening_hours,international_phone_number&key=${apiKey}&language=es`;
                try {
                  const detailsResponse = await fetch(detailsUrl);
                  if (!detailsResponse.ok) {
                    throw new Error(`Error en la respuesta de la API de detalles: ${detailsResponse.status} ${detailsResponse.statusText}`);
                  }
                  const detailsData = await detailsResponse.json();
                  if (detailsData.status === "OK" && detailsData.result) {
                    const updateData = {};
                    if (detailsData.result.international_phone_number) {
                      updateData.phone = detailsData.result.international_phone_number;
                    }
                    if (detailsData.result.opening_hours && Array.isArray(detailsData.result.opening_hours.weekday_text)) {
                      updateData.google_opening_hours = detailsData.result.opening_hours.weekday_text.join("\n");
                    }
                    if (Object.keys(updateData).length > 0) {
                      try {
                        await context.sudo().query.PetPlace.updateOne({
                          where: { id: result.id },
                          data: updateData
                        });
                      } catch (updateError) {
                        console.error(`Error actualizando datos de Veterinary para ${place.name}:`, updateError);
                      }
                    }
                    if (Array.isArray(detailsData.result.reviews)) {
                      for (const review of detailsData.result.reviews) {
                        try {
                          let createdAt = void 0;
                          if (review.time) {
                            createdAt = new Date(review.time * 1e3);
                          }
                          await context.sudo().query.Review.createOne({
                            data: {
                              rating: review.rating || 0,
                              review: review.text || "",
                              createdAt,
                              google_user: review.author_name || "",
                              google_user_photo: review.profile_photo_url || "",
                              pet_place: { connect: { id: result.id } }
                            }
                          });
                        } catch (reviewError) {
                          console.error(`Error guardando review para ${place.name}:`, reviewError);
                        }
                      }
                    }
                  }
                } catch (detailsError) {
                  console.error(`Error obteniendo detalles de reviews para ${place.name}:`, detailsError);
                }
              }
              importedCount++;
              console.log(`Lugar importado: ${place.name} - ${address}`);
            } catch (error) {
              const errorMsg = `Error importando ${place.name || "veterinaria"}: ${error instanceof Error ? error.message : "Error desconocido"}`;
              console.error(errorMsg);
            }
          }
        }
        nextPageToken = data.next_page_token;
        page++;
      } catch (apiError) {
        console.error("Error al llamar a la API de Google Places:", apiError);
        break;
      }
    } while (nextPageToken && page < maxPagesToSearch);
    let resultMessage = `Importaci\xF3n completada. ${importedCount} lugares importados exitosamente.`;
    if (errors.length > 0) {
      resultMessage += `

Errores encontrados:
${errors.join("\n")}`;
    }
    return resultMessage;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Formato JSON inv\xE1lido. Por favor verifica que los datos est\xE9n en formato JSON correcto.");
    }
    throw error;
  }
}
var importPetPlace_default = {
  typeDefs: typeDefs2,
  definition: definition2,
  resolver: resolver2
};

// graphql/customs/mutations/nearbyPetPlaces.ts
var typeDefs3 = `
  type PetPlaceType {
    id: ID!
    label: String
    value: String
    plural: String
  }

  type NearbyPetPlace {
    id: ID!
    name: String
    description: String
    lat: String
    lng: String
    distance: Float
    address: String
    phone: String
    website: String
    street: String
    municipality: String
    state: String
    country: String
    cp: String
    views: String
    types: [PetPlaceType]
    services: [PetPlaceService]
    user: User
    isOpen: Boolean
    pet_place_social_media: [SocialMedia]
    pet_place_likes: [PetPlaceLike]
    pet_place_schedules: [Schedule]
    pet_place_reviews: [Review]
    pet_place_ads: [Ad]
    google_place_id: String
    google_opening_hours: String
    createdAt: String
  }

  type NearbyPetPlacesResult {
    success: Boolean!
    message: String!
    petPlaces: [NearbyPetPlace!]
  }

  input NearbyPetPlacesInput {
    lat: Float!
    lng: Float!
    limit: Int = 10
    radius: Float = 10
  }

  type Mutation {
    getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
  }
`;
var definition3 = `
  getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
`;
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => value * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
var resolver3 = {
  getNearbyPetPlaces: async (root, { input }, context) => {
    const { lat, lng, limit = 10, radius = 10 } = input;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        success: false,
        message: "Latitud y longitud inv\xE1lidas",
        petPlaces: []
      };
    }
    const petPlaces = await context.sudo().query.PetPlace.findMany({
      query: `id name description 
        lat lng 
        address phone 
        website street 
        municipality state 
        country cp 
        views 
        types { id label value plural }
        services { id name }
        user { id name }
        isOpen
        pet_place_social_media { id }
        pet_place_likes { id }
        pet_place_schedules { id }
        pet_place_reviews { id }
        pet_place_ads { id }
        google_place_id
        google_opening_hours
        createdAt
      `
    });
    const withDistance = petPlaces.map((place) => {
      const placeLat = parseFloat(place.lat);
      const placeLng = parseFloat(place.lng);
      if (isNaN(placeLat) || isNaN(placeLng)) return null;
      const distance = haversineDistance(lat, lng, placeLat, placeLng);
      return { ...place, distance };
    }).filter((place) => place && place.distance <= radius);
    withDistance.sort((a, b) => a.distance - b.distance);
    const result = withDistance.slice(0, limit);
    return {
      success: true,
      message: "PetPlaces encontrados",
      petPlaces: result
    };
  }
};
var nearbyPetPlaces_default = { typeDefs: typeDefs3, definition: definition3, resolver: resolver3 };

// graphql/customs/mutations/index.ts
var customMutation = {
  typeDefs: `
    ${customAuth_default.typeDefs}
    ${importPetPlace_default.typeDefs}
    ${nearbyPetPlaces_default.typeDefs}
  `,
  definitions: `
    ${customAuth_default.definition}
    ${importPetPlace_default.definition}
    ${nearbyPetPlaces_default.definition}
  `,
  resolvers: {
    ...customAuth_default.resolver,
    ...importPetPlace_default.resolver,
    ...nearbyPetPlaces_default.resolver
  }
};
var mutations_default = customMutation;

// graphql/extendedSchema.ts
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: `
      ${mutations_default.typeDefs}
      type Mutation {
        ${mutations_default.definitions}
      }
    `,
    resolvers: {
      Mutation: {
        ...mutations_default.resolvers
      }
    }
  });
}

// keystone.ts
var path2 = require("path");
var dotenv2 = require("dotenv");
dotenv2.config({ path: path2.resolve(process.cwd(), "config", ".env.dev") });
if (!process.env.S3_BUCKET_NAME || !process.env.S3_REGION || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
  throw new Error("S3 Configs are not set");
}
var {
  S3_BUCKET_NAME: bucketName = "",
  S3_REGION: region = "",
  S3_ACCESS_KEY_ID: accessKeyId = "",
  S3_SECRET_ACCESS_KEY: secretAccessKey = ""
} = process.env;
var keystone_default = withAuth(
  (0, import_core34.config)({
    db: {
      provider: "postgresql",
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connect_timeout=300`
    },
    server: {
      cors: true,
      maxFileSize: 200 * 1024 * 1024
    },
    storage: {
      my_local_images: {
        kind: "local",
        type: "image",
        generateUrl: (path3) => `http://${process.env.DB_HOST}:3000/images${path3}`,
        serverRoute: {
          path: "/images"
        },
        storagePath: "public/images"
      },
      s3_files: {
        kind: "s3",
        // this storage uses S3
        type: "image",
        // only for files
        bucketName,
        // from your S3_BUCKET_NAME environment variable
        region,
        // from your S3_REGION environment variable
        accessKeyId,
        // from your S3_ACCESS_KEY_ID environment variable
        secretAccessKey,
        // from your S3_SECRET_ACCESS_KEY environment variable
        signed: { expiry: 3600 }
        // (optional) links will be signed with an expiry of 3600 seconds (an hour)
      },
      s3_categories: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/categories/" : "categories/",
        // subcarpeta para categorías, usa 'dev/categories' en entorno dev
        signed: { expiry: 3600 }
      },
      s3_posts: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/posts/" : "posts/",
        // subcarpeta para posts, usa 'dev/posts' en entorno dev
        signed: { expiry: 3600 }
      },
      s3_profile: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/profiles/" : "profiles/",
        // subcarpeta para profiles, usa 'dev/profiles' en entorno dev
        signed: { expiry: 3600 }
      },
      s3_animals: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/animals/" : "animals/",
        // subcarpeta para profiles, usa 'dev/profiles' en entorno dev
        signed: { expiry: 3600 }
      },
      s3_pets: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/pets/" : "pets/",
        // subcarpeta para profiles, usa 'dev/profiles' en entorno dev
        signed: { expiry: 3600 }
      },
      s3_ads: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/ads/" : "ads/",
        // subcarpeta para ads, usa 'dev/ads' en entorno dev
        signed: { expiry: 3600 }
      }
    },
    graphql: {
      extendGraphqlSchema
    },
    lists: schema_default,
    session
  })
);
//# sourceMappingURL=config.js.map
