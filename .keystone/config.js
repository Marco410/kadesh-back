"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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

// models/User/User.ts
var User_default = (0, import_core7.list)({
  access: access_default,
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields7.text)(),
    username: (0, import_fields7.text)({
      isIndexed: "unique"
    }),
    email: (0, import_fields7.text)({
      isIndexed: "unique",
      hooks: emailHooks
    }),
    password: (0, import_fields7.password)({
      validation: { isRequired: true },
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
      defaultValue: "admin",
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
    birthday: (0, import_fields9.calendarDay)(),
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
  PetMultimedia: PetMultimedia_default
};

// keystone.ts
var import_core11 = require("@keystone-6/core");

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
  sessionData: "name createdAt",
  secretField: "password",
  // WARNING: remove initFirstItem functionality in production
  //   see https://keystonejs.com/docs/config/auth#init-first-item for more
  initFirstItem: {
    // if there are no items in the database, by configuring this field
    //   you are asking the Keystone AdminUI to create a new user
    //   providing inputs for these fields
    fields: ["name", "email", "password", "role"]
    // it uses context.sudo() to do this, which bypasses any access control you might have
    //   you shouldn't use this in production
  }
});
var sessionMaxAge = 60 * 60 * 24 * 30;
var session = (0, import_session.statelessSessions)({
  maxAge: sessionMaxAge,
  secret: sessionSecret
});

// keystone.ts
var keystone_default = withAuth(
  (0, import_core11.config)({
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
    session
  })
);
//# sourceMappingURL=config.js.map
