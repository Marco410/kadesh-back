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

// models/Animal/Animal.ts
var Animal_default = (0, import_core.list)({
  access: access_default,
  fields: {
    name: (0, import_fields.text)({ validation: { isRequired: true } }),
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
    history: (0, import_fields.relationship)({
      ref: "AnimalHistory.animal",
      many: true
    }),
    createdAt: (0, import_fields.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Animal/AnimalType/AnimalType.ts
var import_core2 = require("@keystone-6/core");
var import_fields2 = require("@keystone-6/core/fields");

// utils/constants/constants.ts
var animal_type_options = [
  { label: "Perro", value: "dog" /* DOG */ },
  { label: "Gato", value: "cat" /* CAT */ },
  { label: "Ave", value: "bird" /* BIRD */ },
  { label: "Pez", value: "fish" /* FISH */ },
  { label: "Reptil", value: "reptil" /* REPTIL */ },
  { label: "Mam\xEDfero", value: "mammal" /* MAMMAL */ }
];
var animal_history_options = [
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
  }
];
var product_categories = [
  { label: "Croquetas", value: "croquetas" },
  { label: "Limpieza", value: "limpieza" }
];
var brands = [
  { label: "Purina", value: "purina" },
  { label: "DogShow", value: "dogshow" }
];
var order_status = [
  { label: "Pendiente", value: "pending" },
  { label: "Preparando", value: "preparing" },
  { label: "Validando", value: "validating" },
  { label: "Enviada", value: "sent" },
  { label: "Cancelada", value: "cancelled" },
  { label: "Completada", value: "completed" }
];
var payment_types = [
  { label: "Tarjeta d\xE9bito", value: "debit" },
  { label: "Tarjeta cr\xE9dito", value: "credit" },
  { label: "Transferencia", value: "transfer" },
  { label: "Stripe", value: "stripe" }
];

// models/Animal/AnimalType/AnimalType.ts
var AnimalType_default = (0, import_core2.list)({
  access: access_default,
  fields: {
    name: (0, import_fields2.select)({
      defaultValue: "dog" /* DOG */,
      options: animal_type_options,
      isIndexed: "unique",
      validation: { isRequired: true }
    }),
    animal_breed: (0, import_fields2.relationship)({
      ref: "AnimalBreed.animal_type",
      many: true
    }),
    order: (0, import_fields2.integer)()
  }
});

// models/Animal/AnimalMultimedia/AnimalMultimedia.ts
var import_core3 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var AnimalMultimedia_default = (0, import_core3.list)({
  access: access_default,
  fields: {
    image: (0, import_fields3.image)({
      storage: "my_local_images"
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

// models/Animal/AnimalHistory/AnimalHistory.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var AnimalHistory_default = (0, import_core5.list)({
  access: access_default,
  fields: {
    animal: (0, import_fields5.relationship)({
      ref: "Animal.history"
    }),
    status: (0, import_fields5.select)({
      defaultValue: "Registrado",
      options: animal_history_options
    }),
    notes: (0, import_fields5.text)({
      ui: { displayMode: "textarea" }
    }),
    lat: (0, import_fields5.text)(),
    lng: (0, import_fields5.text)(),
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
async function checkUserName(name, lastName, context) {
  let baseLink = genUniqueLink(`${name.toLowerCase()}.${lastName.toLowerCase()}`);
  let uniqueLink = baseLink;
  let existingUser = await context.db.User.findOne({
    where: { username: uniqueLink }
  });
  let counter = 1;
  while (existingUser) {
    uniqueLink = `${baseLink}-${counter}`;
    existingUser = await context.db.User.findOne({
      where: { username: uniqueLink }
    });
    counter++;
  }
  return uniqueLink;
}

// models/User/User.ts
var User_default = (0, import_core7.list)({
  access: access_default,
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields7.text)(),
    secondLastName: (0, import_fields7.text)(),
    username: (0, import_fields7.text)({
      isIndexed: "unique",
      validation: { isRequired: true }
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
    role: (0, import_fields7.select)({
      type: "enum",
      validation: {
        isRequired: true
      },
      defaultValue: "user",
      options: [
        { label: "Admnistrador", value: "admin" },
        { label: "User", value: "user" }
      ]
    }),
    profileImage: (0, import_fields7.image)({ storage: "my_local_images" }),
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
      storage: "my_local_images"
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

// models/Veterinary/Veterinary.ts
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
    veterinary: (0, import_fields11.relationship)({
      ref: "Veterinary.veterinary_schedules"
    }),
    pet_shelter: (0, import_fields11.relationship)({
      ref: "PetShelter.pet_shelter_schedules"
    }),
    createdAt: (0, import_fields11.timestamp)({
      defaultValue: {
        kind: "now"
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

// models/Veterinary/Veterinary.ts
var Veterinary_default = (0, import_core12.list)({
  access: access_default,
  fields: {
    name: (0, import_fields12.text)({ validation: { isRequired: true } }),
    description: (0, import_fields12.text)({ validation: { isRequired: true } }),
    phone: (0, import_fields12.text)({
      hooks: phoneHooks
    }),
    website: (0, import_fields12.text)(),
    street: (0, import_fields12.text)(),
    municipality: (0, import_fields12.text)(),
    state: (0, import_fields12.text)(),
    country: (0, import_fields12.text)(),
    cp: (0, import_fields12.text)(),
    lat: (0, import_fields12.text)(),
    lng: (0, import_fields12.text)(),
    views: (0, import_fields12.integer)(),
    services: (0, import_fields12.relationship)({
      ref: "VeterinaryService",
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
              veterinary: {
                id: {
                  equals: item.id
                }
              }
            },
            query: "day timeIni timeEnd"
          });
          if (schedules.length == 0)
            return false;
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
    veterinary_social_media: (0, import_fields12.relationship)({
      ref: "SocialMedia.veterinary",
      many: true
    }),
    veterinary_likes: (0, import_fields12.relationship)({
      ref: "VeterinaryLike.veterinary",
      many: true
    }),
    veterinary_schedules: (0, import_fields12.relationship)({
      ref: "Schedule.veterinary",
      many: true
    }),
    veterinary_reviews: (0, import_fields12.relationship)({
      ref: "Review.veterinary",
      many: true
    }),
    createdAt: (0, import_fields12.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Veterinary/VeterinaryLike/VeterinaryLike.ts
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var VeterinaryLike_default = (0, import_core13.list)({
  access: access_default,
  fields: {
    user: (0, import_fields13.relationship)({
      ref: "User",
      many: false
    }),
    veterinary: (0, import_fields13.relationship)({
      ref: "Veterinary.veterinary_likes"
    }),
    createdAt: (0, import_fields13.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Veterinary/VeterinaryService/VeterinaryService.ts
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var VeterinaryService_default = (0, import_core14.list)({
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
    veterinary: (0, import_fields15.relationship)({
      ref: "Veterinary.veterinary_social_media"
    }),
    pet_shelter: (0, import_fields15.relationship)({
      ref: "PetShelter.pet_shelter_social_media"
    }),
    createdAt: (0, import_fields15.timestamp)({
      defaultValue: {
        kind: "now"
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
    veterinary: (0, import_fields16.relationship)({
      ref: "Veterinary.veterinary_reviews"
    }),
    pet_shelter: (0, import_fields16.relationship)({
      ref: "PetShelter.pet_shelter_reviews"
    }),
    product: (0, import_fields16.relationship)({
      ref: "Product.product_reviews"
    }),
    user: (0, import_fields16.relationship)({
      ref: "User",
      many: false
    }),
    createdAt: (0, import_fields16.timestamp)({
      defaultValue: {
        kind: "now"
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

// models/PetShelter/PetShelter.ts
var import_core17 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var PetShelter_default = (0, import_core17.list)({
  access: access_default,
  fields: {
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    description: (0, import_fields17.text)({ validation: { isRequired: true } }),
    phone: (0, import_fields17.text)({
      hooks: phoneHooks
    }),
    website: (0, import_fields17.text)(),
    street: (0, import_fields17.text)(),
    municipality: (0, import_fields17.text)(),
    state: (0, import_fields17.text)(),
    country: (0, import_fields17.text)(),
    cp: (0, import_fields17.text)(),
    lat: (0, import_fields17.text)(),
    lng: (0, import_fields17.text)(),
    views: (0, import_fields17.integer)(),
    user: (0, import_fields17.relationship)({
      ref: "User",
      many: false
    }),
    isOpen: (0, import_fields17.virtual)({
      field: import_core17.graphql.field({
        type: import_core17.graphql.Boolean,
        async resolve(item, args, context) {
          const today = /* @__PURE__ */ new Date();
          const schedules = await context.query.Schedule.findMany({
            where: {
              pet_shelter: {
                id: {
                  equals: item.id
                }
              }
            },
            query: "day timeIni timeEnd"
          });
          if (schedules.length == 0)
            return false;
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
    pet_shelter_social_media: (0, import_fields17.relationship)({
      ref: "SocialMedia.pet_shelter",
      many: true
    }),
    pet_shelter_schedules: (0, import_fields17.relationship)({
      ref: "Schedule.pet_shelter",
      many: true
    }),
    pet_shelter_reviews: (0, import_fields17.relationship)({
      ref: "Review.pet_shelter",
      many: true
    }),
    createdAt: (0, import_fields17.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Store/Product/Product.ts
var import_core18 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var Product_default = (0, import_core18.list)({
  access: access_default,
  fields: {
    name: (0, import_fields18.text)({ validation: { isRequired: true } }),
    price: (0, import_fields18.integer)({ validation: { isRequired: true } }),
    description: (0, import_fields18.text)({ validation: { isRequired: true } }),
    category: (0, import_fields18.select)({
      validation: { isRequired: true },
      options: product_categories
    }),
    brand: (0, import_fields18.select)({
      validation: { isRequired: true },
      options: brands
    }),
    type: (0, import_fields18.select)({
      validation: { isRequired: true },
      options: animal_type_options
    }),
    product_reviews: (0, import_fields18.relationship)({
      ref: "Review.product",
      many: true
    }),
    createdAt: (0, import_fields18.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Store/WishList/WishList.ts
var import_core19 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var WishList_default = (0, import_core19.list)({
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
      }
    })
  }
});

// models/Store/Cart/Cart.ts
var import_core20 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var Cart_default = (0, import_core20.list)({
  access: access_default,
  fields: {
    name: (0, import_fields20.text)({ validation: { isRequired: true } }),
    user: (0, import_fields20.relationship)({
      ref: "User",
      many: false
    }),
    product: (0, import_fields20.relationship)({
      ref: "Product",
      many: true
    }),
    createdAt: (0, import_fields20.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Store/Order/Order.ts
var import_core21 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var Order_default = (0, import_core21.list)({
  access: access_default,
  fields: {
    total: (0, import_fields21.integer)(),
    status: (0, import_fields21.select)({ validation: { isRequired: true }, options: order_status }),
    cart: (0, import_fields21.relationship)({
      ref: "Cart",
      many: false
    }),
    user: (0, import_fields21.relationship)({
      ref: "User",
      many: false
    }),
    payment: (0, import_fields21.relationship)({
      ref: "Payment.order_payment",
      many: false
    }),
    createdAt: (0, import_fields21.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/Store/Payment/Payment.ts
var import_fields22 = require("@keystone-6/core/fields");
var import_core22 = require("@keystone-6/core");
var Payment_default = (0, import_core22.list)({
  access: access_default,
  fields: {
    order_payment: (0, import_fields22.relationship)({
      ref: "Order.payment"
    }),
    paymentMethod: (0, import_fields22.relationship)({
      ref: "PaymentMethod.payment"
    }),
    amount: (0, import_fields22.decimal)({
      scale: 6,
      defaultValue: "0.000000"
    }),
    status: (0, import_fields22.select)({
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
    processorStripeChargeId: (0, import_fields22.text)(),
    stripeErrorMessage: (0, import_fields22.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    processorRefundId: (0, import_fields22.text)(),
    createdAt: (0, import_fields22.timestamp)({
      defaultValue: { kind: "now" }
    }),
    updatedAt: (0, import_fields22.timestamp)({
      defaultValue: { kind: "now" },
      db: { updatedAt: true }
    })
  }
});

// models/Store/PaymentMethod/PaymentMethod.ts
var import_fields23 = require("@keystone-6/core/fields");
var import_core23 = require("@keystone-6/core");
var PaymentMethod_default = (0, import_core23.list)({
  access: access_default,
  fields: {
    user: (0, import_fields23.relationship)({
      ref: "User"
    }),
    cardType: (0, import_fields23.text)(),
    isDefault: (0, import_fields23.checkbox)(),
    lastFourDigits: (0, import_fields23.text)(),
    expMonth: (0, import_fields23.text)(),
    expYear: (0, import_fields23.text)(),
    stripeProcessorId: (0, import_fields23.text)(),
    address: (0, import_fields23.text)(),
    postalCode: (0, import_fields23.text)(),
    ownerName: (0, import_fields23.text)(),
    country: (0, import_fields23.text)(),
    // Two-letter country code (ISO 3166-1 alpha-2).
    payment: (0, import_fields23.relationship)({
      ref: "Payment.paymentMethod",
      many: true
    }),
    type: (0, import_fields23.select)({ options: payment_types }),
    createdAt: (0, import_fields23.timestamp)({
      defaultValue: { kind: "now" }
    }),
    updatedAt: (0, import_fields23.timestamp)({
      defaultValue: { kind: "now" },
      db: { updatedAt: true }
    })
  }
});

// models/TokenNotification/TokenNotification.ts
var import_fields24 = require("@keystone-6/core/fields");
var import_core24 = require("@keystone-6/core");

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
var TokenNotification_default = (0, import_core24.list)({
  access: access_default,
  hooks: TokenNotification_hooks_default.hooks,
  fields: {
    token: (0, import_fields24.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    user: (0, import_fields24.relationship)({
      ref: "User",
      many: false
    })
  }
});

// models/schema.ts
var schema_default = {
  User: User_default,
  Animal: Animal_default,
  AnimalType: AnimalType_default,
  AnimalMultimedia: AnimalMultimedia_default,
  AnimalFavorite: AnimalFavorite_default,
  AnimalHistory: AnimalHistory_default,
  AnimalComment: AnimalComment_default,
  AnimalBreed: AnimalBreed_default,
  Pet: Pet_default,
  PetMultimedia: PetMultimedia_default,
  Veterinary: Veterinary_default,
  VeterinaryLike: VeterinaryLike_default,
  VeterinaryService: VeterinaryService_default,
  Schedule: Schedule_default,
  SocialMedia: SocialMedia_default,
  Review: Review_default,
  PetShelter: PetShelter_default,
  Product: Product_default,
  WishList: WishList_default,
  Cart: Cart_default,
  Order: Order_default,
  Payment: Payment_default,
  PaymentMethod: PaymentMethod_default,
  TokenNotification: TokenNotification_default
};

// keystone.ts
var import_core25 = require("@keystone-6/core");

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
  sessionData: "id name lastName username email phone role createdAt",
  secretField: "password",
  // WARNING: remove initFirstItem functionality in production
  //   see https://keystonejs.com/docs/config/auth#init-first-item for more
  initFirstItem: {
    // if there are no items in the database, by configuring this field
    //   you are asking the Keystone AdminUI to create a new user
    //   providing inputs for these fields
    fields: ["name", "lastName", "username", "email", "password", "role"]
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

// graphql/customs/mutations/index.ts
var customMutation = {
  typeDefs: `
    ${customAuth_default.typeDefs}
  `,
  definitions: `
    ${customAuth_default.definition}
  `,
  resolvers: {
    ...customAuth_default.resolver
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
var keystone_default = withAuth(
  (0, import_core25.config)({
    db: {
      provider: "postgresql",
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connect_timeout=300`
    },
    server: {
      cors: true,
      maxFileSize: 200 * 1024 * 1024,
      healthCheck: true
    },
    storage: {
      my_local_images: {
        kind: "local",
        type: "image",
        generateUrl: (path2) => `http://${process.env.DB_HOST}:3000/images${path2}`,
        serverRoute: {
          path: "/images"
        },
        storagePath: "public/images"
      }
    },
    lists: schema_default,
    session,
    extendGraphqlSchema
  })
);
//# sourceMappingURL=config.js.map
