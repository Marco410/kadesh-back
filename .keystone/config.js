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
var TRIAL_DAYS_FREE_PLAN = 7;
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
  },
  {
    label: "En adopci\xF3n",
    value: "in_adoption"
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
var PET_PLACES_SEED_LOCATION = {
  lat: Number(process.env.PET_PLACES_SEED_LAT) || 19.4326,
  lng: Number(process.env.PET_PLACES_SEED_LNG) || -99.1332
};
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
    physical_description: (0, import_fields.text)(),
    age: (0, import_fields.text)(),
    sex: (0, import_fields.select)({
      options: ANIMAL_SEX_OPTIONS,
      defaultValue: "male"
    }),
    color: (0, import_fields.text)(),
    size: (0, import_fields.text)(),
    contactNumber: (0, import_fields.text)(),
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
    // Could be a different date when lost
    date_status: (0, import_fields5.timestamp)({
      defaultValue: {
        kind: "now"
      }
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

// utils/helpers/sendgrid.ts
var import_mail = __toESM(require("@sendgrid/mail"));
if (process.env.SENDGRID_API_KEY) {
  import_mail.default.setApiKey(process.env.SENDGRID_API_KEY);
}
async function sendEmail({
  to,
  subject,
  html,
  from = process.env.SENDGRID_FROM_EMAIL || "noreply@kadesh.com"
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY is not configured. Email not sent.");
    return;
  }
  try {
    const msg = {
      to: Array.isArray(to) ? to : [to],
      from,
      subject,
      html
    };
    await import_mail.default.send(msg);
    console.log(
      `Email sent successfully to ${Array.isArray(to) ? to.join(", ") : to}`
    );
  } catch (error) {
    console.error("Error sending email:", error);
    if (error.response) {
      console.error("SendGrid error response:", error.response.body);
    }
    throw error;
  }
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var BRAND_ORANGE = "#FF8C42";
var BRAND_ORANGE_DARK = "#E6732E";
function parseAdminNotificationEmails() {
  const raw = process.env.SENDGRID_FROM_EMAIL?.trim();
  if (!raw) return [];
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}
function buildWelcomeEmailHtml(displayName, appUrl) {
  const name = escapeHtml(displayName || "ah\xED");
  const ctaRow = appUrl ? `
        <tr>
          <td style="padding: 8px 0 0 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0;">
              <tr>
                <td style="border-radius: 8px; background: ${BRAND_ORANGE};">
                  <a href="${escapeHtml(appUrl)}" target="_blank" rel="noopener noreferrer"
                    style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                    Ir a la plataforma
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Bienvenido</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef0f4; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_ORANGE} 0%, ${BRAND_ORANGE_DARK} 100%); padding: 28px 32px;">
              <p style="margin:0; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.9);">Kadesh</p>
              <h1 style="margin: 8px 0 0 0; font-size: 26px; font-weight: 700; line-height: 1.25; color: #ffffff;">\xA1Bienvenido!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 28px 32px;">
              <p style="margin:0 0 16px 0; font-size: 18px; line-height: 1.5; color: #0f172a;">Hola <strong>${name}</strong>,</p>
              <p style="margin:0 0 20px 0; font-size: 16px; line-height: 1.65; color: #475569;">
                Gracias por unirte. Tu cuenta ya est\xE1 activa y puedes empezar a usar la plataforma cuando quieras.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${ctaRow}
                <tr>
                  <td style="padding-top: 28px; border-top: 1px solid #e2e8f0;">
                    <p style="margin:0; font-size: 14px; line-height: 1.6; color: #64748b;">
                      Si no creaste esta cuenta, puedes ignorar este mensaje.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 28px 32px; background: #f8fafc;">
              <p style="margin:0; font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
                \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Kadesh \xB7 Equipo de soporte
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function buildBankAlertEmailHtml(userId, userName, userEmail, fieldsList) {
  const rows = [
    ["ID de usuario", userId],
    ["Nombre", userName],
    ["Email", userEmail],
    ["Campos actualizados", fieldsList]
  ];
  const tableRows = rows.map(
    ([label, value]) => `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #334155; font-size: 13px; font-weight: 600; color: #94a3b8; width: 38%; vertical-align: top;">${escapeHtml(label)}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #334155; font-size: 14px; color: #e2e8f0; vertical-align: top;">${escapeHtml(value)}</td>
          </tr>`
  ).join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background: #1e293b; border-radius: 14px; overflow: hidden; border: 1px solid #334155;">
          <tr>
            <td style="padding: 22px 24px; border-bottom: 1px solid #334155;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: rgba(255,140,66,0.2); color: ${BRAND_ORANGE}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">Alerta admin</span>
              <h1 style="margin: 12px 0 0 0; font-size: 20px; font-weight: 700; color: #f8fafc;">Datos bancarios actualizados</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">Un usuario guard\xF3 cambios en banco, CLABE o tarjeta. Revisa el registro en el Admin de Keystone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${tableRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 24px 24px 24px;">
              <p style="margin:0; font-size: 12px; color: #64748b; line-height: 1.5;">Este mensaje se gener\xF3 autom\xE1ticamente. No respondas a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
async function sendUserWelcomeEmail({
  to,
  displayName
}) {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendUserWelcomeEmail: sin email destino.");
    return;
  }
  const subject = "Bienvenido a Kadesh";
  const appUrl = "https://negocios.kadesh.com.mx/auth/login";
  const html = buildWelcomeEmailHtml(displayName, appUrl);
  await sendEmail({ to: trimmedTo, subject, html });
}
async function sendAdminUserBankDetailsUpdatedEmail({
  userId,
  userEmail,
  userName,
  fieldsUpdated
}) {
  const recipients = parseAdminNotificationEmails();
  if (recipients.length === 0) {
    console.warn(
      "SENDGRID_FROM_EMAIL no configurado. No se env\xEDa aviso de datos bancarios."
    );
    return;
  }
  const fieldsList = fieldsUpdated.join(", ");
  const subject = "[Kadesh] Usuario actualiz\xF3 datos bancarios";
  const html = buildBankAlertEmailHtml(userId, userName, userEmail, fieldsList);
  await sendEmail({ to: recipients, subject, html });
}
async function sendNewPostEmail({
  postTitle,
  postUrl,
  postExcerpt,
  authorName,
  categoryName,
  recipientEmails
}) {
  if (recipientEmails.length === 0) {
    return;
  }
  const subject = `Nuevo post publicado: ${postTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="dark">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #BBBBBB;
          background-color: #1A1A1A;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #FF8C42;
          color: #FFFFFF;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
        }
        .content {
          background-color: #2C2C2C;
          padding: 20px;
          border-radius: 0 0 5px 5px;
          border: 1px solid #404040;
          border-top: none;
        }
        .post-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #FFFFFF;
        }
        .post-excerpt {
          font-size: 16px;
          color: #BBBBBB;
          margin-bottom: 20px;
          line-height: 1.8;
        }
        .post-meta {
          font-size: 14px;
          color: #87CEEB;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background-color: #FF8C42;
          color: #FFFFFF;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin-top: 20px;
        }
        .button:hover {
          background-color: #E67A35;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #404040;
          font-size: 12px;
          color: #BBBBBB;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>\xA1Nuevo Post Publicado!</h1>
      </div>
      <div class="content">
        <div class="post-title">${postTitle}</div>
        ${postExcerpt ? `<div class="post-excerpt">${postExcerpt}</div>` : ""}
        <div class="post-meta">
          ${authorName ? `<strong>Autor:</strong> ${authorName}<br>` : ""}
          ${categoryName ? `<strong>Categor\xEDa:</strong> ${categoryName}` : ""}
        </div>
        <a href="${postUrl}" class="button">Leer Post Completo</a>
      </div>
      <div class="footer">
        <p>Gracias por suscribirte a nuestro blog.</p>
        <p>Si no deseas recibir m\xE1s notificaciones, puedes cancelar tu suscripci\xF3n en cualquier momento.</p>
      </div>
    </body>
    </html>
  `;
  for (const email of recipientEmails) {
    await sendEmail({
      to: email,
      subject,
      html
    });
  }
}

// models/Role/constants.ts
var ROLES = [
  { label: "Admin", value: "admin" /* ADMIN */ },
  { label: "User", value: "user" /* USER */ },
  { label: "Author", value: "author" /* AUTHOR */ },
  { label: "Admin (Company)", value: "admin_company" /* ADMIN_COMPANY */ },
  { label: "User (Company)", value: "user_company" /* USER_COMPANY */ },
  { label: "Vendedor", value: "vendedor" /* VENDEDOR */ }
];

// utils/intregrations/stripe.ts
var Stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var stripe_default = Stripe;

// models/User/User.hooks.ts
var USER_BANK_NOTIFICATION_FIELDS = ["bank", "clabe", "cardNumber"];
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
var REFERRAL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateReferralSuffix(length = 5) {
  let result = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * REFERRAL_CHARS.length);
    result += REFERRAL_CHARS[index];
  }
  return result;
}
async function generateUniqueReferralCode(context) {
  while (true) {
    const candidate = "K" + generateReferralSuffix(5);
    const existing = await context.sudo().query.User.findOne({
      where: { referralCode: candidate },
      query: "id"
    });
    if (!existing) {
      return candidate;
    }
  }
}
var userReferralHook = {
  resolveInput: async ({
    resolvedData,
    item,
    operation,
    context
  }) => {
    if (operation === "create" && !item && !resolvedData.referralCode) {
      const code = await generateUniqueReferralCode(context);
      resolvedData.referralCode = code;
    }
    if (resolvedData.referralCode) {
      const code = String(resolvedData.referralCode).toUpperCase();
      const pattern = /^K[A-Z0-9]{5}$/;
      if (!pattern.test(code)) {
        throw new Error(
          "El c\xF3digo de referido debe empezar con K y tener 5 caracteres alfanum\xE9ricos m\xE1s (total 6)."
        );
      }
      resolvedData.referralCode = code;
    }
    return resolvedData;
  }
};
var stripeCustomerHook = {
  resolveInput: async ({
    resolvedData,
    operation
  }) => {
    if (operation !== "create") return resolvedData;
    const email = resolvedData.email;
    if (!email || typeof email !== "string") return resolvedData;
    if (!process.env.STRIPE_SECRET_KEY) return resolvedData;
    try {
      const existingCustomers = await stripe_default.customers.list({
        email,
        limit: 1
      });
      let stripeResp;
      if (existingCustomers.data.length > 0) {
        stripeResp = existingCustomers.data[0];
      } else {
        stripeResp = await stripe_default.customers.create({
          name: `${resolvedData.name ?? ""} ${resolvedData.lastName ?? ""}`.trim(),
          email,
          phone: resolvedData.phone ?? void 0
        });
      }
      resolvedData.stripeCustomerId = stripeResp.id;
    } catch (_) {
    }
    return resolvedData;
  }
};
var userWelcomeEmailHook = {
  afterOperation: async (args) => {
    const { listKey, operation, item } = args;
    if (listKey !== "User" || operation !== "create" || !item) return;
    const email = item.email;
    if (!email || String(email).trim() === "") return;
    const displayName = [item.name, item.lastName].filter(Boolean).join(" ").trim() || "ah\xED";
    try {
      await sendUserWelcomeEmail({
        to: String(email),
        displayName
      });
    } catch (err) {
      console.error("Error enviando correo de bienvenida:", err);
    }
  }
};
var userBankDetailsNotificationHook = {
  afterOperation: async (args) => {
    const { listKey, operation, inputData, item } = args;
    if (listKey !== "User" || operation !== "update" || !item?.id) return;
    if (!inputData) return;
    const fieldsUpdated = USER_BANK_NOTIFICATION_FIELDS.filter(
      (f) => Object.prototype.hasOwnProperty.call(inputData, f)
    );
    if (fieldsUpdated.length === 0) return;
    const userId = String(item.id);
    const userName = [item.name, item.lastName].filter(Boolean).join(" ").trim() || "(sin nombre)";
    const userEmail = item.email ?? "";
    try {
      await sendAdminUserBankDetailsUpdatedEmail({
        userId,
        userEmail,
        userName,
        fieldsUpdated: [...fieldsUpdated]
      });
    } catch (err) {
      console.error("Error enviando aviso de actualizaci\xF3n de datos bancarios:", err);
    }
  }
};
var userBlogSubscriptionHook = {
  afterOperation: async ({ operation, item, context }) => {
    if (operation === "create" && item && item.email) {
      try {
        const existingSubscription = await context.db.BlogSubscription.findOne({
          where: { email: item.email }
        });
        if (!existingSubscription) {
          await context.db.BlogSubscription.createOne({
            data: {
              email: item.email,
              user: { connect: { id: item.id } },
              active: true
            }
          });
        } else if (existingSubscription && !existingSubscription.userId) {
          await context.db.BlogSubscription.updateOne({
            where: { id: existingSubscription.id },
            data: {
              user: { connect: { id: item.id } }
            }
          });
        }
      } catch (error) {
        console.error("Error al crear suscripci\xF3n de blog para el usuario:", error);
      }
    }
  }
};

// models/User/User.ts
async function resolveInput(args) {
  const afterRole = await userRoleHook.resolveInput(args);
  const afterStripe = await stripeCustomerHook.resolveInput({
    ...args,
    resolvedData: afterRole
  });
  const afterReferral = await userReferralHook.resolveInput({
    ...args,
    resolvedData: afterStripe
  });
  return afterReferral;
}
var User_default = (0, import_core7.list)({
  access: access_default,
  hooks: {
    resolveInput,
    afterOperation: async (args) => {
      await userBlogSubscriptionHook.afterOperation(args);
      await userWelcomeEmailHook.afterOperation(args);
      await userBankDetailsNotificationHook.afterOperation(args);
    }
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "lastName",
        "secondLastName",
        "email",
        "phone",
        "roles",
        "company",
        "leadSyncLogs",
        "createdAt",
        "lastLoginAt"
      ]
    }
  },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields7.text)(),
    secondLastName: (0, import_fields7.text)({
      db: { isNullable: true }
    }),
    username: (0, import_fields7.text)({
      isIndexed: "unique",
      validation: { isRequired: true },
      hooks: userNameHook
    }),
    referralCode: (0, import_fields7.text)({
      isIndexed: "unique",
      validation: { isRequired: true, length: { min: 6, max: 6 } },
      ui: {
        description: "C\xF3digo de referido (K + 5 caracteres alfanum\xE9ricos)"
      }
    }),
    email: (0, import_fields7.text)({
      isIndexed: "unique",
      hooks: emailHooks
    }),
    businessEmail: (0, import_fields7.text)({
      db: { isNullable: true },
      ui: {
        description: "Correo electr\xF3nico de la empresa"
      }
    }),
    businessPhone: (0, import_fields7.text)({
      db: { isNullable: true },
      ui: {
        description: "Tel\xE9fono de la empresa"
      }
    }),
    password: (0, import_fields7.password)({
      validation: { isRequired: false },
      ui: {
        createView: {
          fieldMode: "hidden"
        }
      }
    }),
    phone: (0, import_fields7.text)(),
    roles: (0, import_fields7.relationship)({
      ref: "Role.users",
      many: true
    }),
    referredBy: (0, import_fields7.relationship)({
      ref: "User.referrals",
      ui: {
        description: "Usuario que refiri\xF3 a este usuario"
      }
    }),
    referrals: (0, import_fields7.relationship)({
      ref: "User.referredBy",
      many: true,
      ui: {
        description: "Usuarios que este usuario ha referido"
      }
    }),
    /** Company (SaaS tenant) this user belongs to; 1 company : N users */
    company: (0, import_fields7.relationship)({
      ref: "SaasCompany.users",
      many: false,
      ui: { description: "Company/organization this user belongs to" }
    }),
    workspaces: (0, import_fields7.relationship)({
      ref: "SaasWorkspace.members",
      many: true,
      ui: { description: "Workspaces (\xE1reas) a los que pertenece" }
    }),
    blog_subscriptions: (0, import_fields7.relationship)({
      ref: "BlogSubscription.user",
      many: true
    }),
    businessLeadsAssigned: (0, import_fields7.relationship)({
      ref: "TechBusinessLead.salesPerson",
      many: true
    }),
    salesActivities: (0, import_fields7.relationship)({
      ref: "TechSalesActivity.assignedSeller",
      many: true,
      ui: { hideCreate: true }
    }),
    createdBySalesActivities: (0, import_fields7.relationship)({
      ref: "TechSalesActivity.createdBy",
      many: true,
      ui: { hideCreate: true }
    }),
    tasksResponsible: (0, import_fields7.relationship)({
      ref: "TechTask.responsible",
      many: true,
      ui: { hideCreate: true, description: "Tareas de workspace asignadas" }
    }),
    createdByTasks: (0, import_fields7.relationship)({
      ref: "TechTask.createdBy",
      many: true,
      ui: { hideCreate: true }
    }),
    followUpTasks: (0, import_fields7.relationship)({
      ref: "TechFollowUpTask.assignedSeller",
      many: true,
      ui: { hideCreate: true }
    }),
    createdByFollowUpTasks: (0, import_fields7.relationship)({
      ref: "TechFollowUpTask.createdBy",
      many: true,
      ui: { hideCreate: true }
    }),
    proposals: (0, import_fields7.relationship)({
      ref: "TechProposal.assignedSeller",
      many: true,
      ui: { hideCreate: true }
    }),
    createdByProposals: (0, import_fields7.relationship)({
      ref: "TechProposal.createdBy",
      many: true,
      ui: { hideCreate: true }
    }),
    projectsResponsible: (0, import_fields7.relationship)({
      ref: "SaasProject.responsible",
      many: true,
      ui: { description: "Proyectos donde es responsable" }
    }),
    leadSyncLogs: (0, import_fields7.relationship)({
      ref: "TechLeadSyncLog.user",
      many: true,
      ui: { description: "Logs de sincronizaci\xF3n de leads (mapa)" }
    }),
    saasSubscriptionLogs: (0, import_fields7.relationship)({
      ref: "SaasSubscriptionLog.user",
      many: true,
      ui: { description: "Logs de intentos de suscripci\xF3n SaaS" }
    }),
    authLogs: (0, import_fields7.relationship)({
      ref: "UserAuthLog.user",
      many: true,
      ui: { description: "Registro de login / registro (customAuth, registerUser)" }
    }),
    quotationsCreated: (0, import_fields7.relationship)({
      ref: "SaasQuotation.createdBy",
      many: true,
      ui: {
        hideCreate: true,
        description: "Cotizaciones creadas por este usuario"
      }
    }),
    quotationsAssignedSeller: (0, import_fields7.relationship)({
      ref: "SaasQuotation.assignedSeller",
      many: true,
      ui: {
        hideCreate: true,
        description: "Cotizaciones donde act\xFAa como vendedor asignado"
      }
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
    salesPersonVerified: (0, import_fields7.checkbox)(),
    salesComission: (0, import_fields7.integer)({
      ui: { description: "Comisi\xF3n de ventas (en porcentaje)" },
      defaultValue: 10
    }),
    bank: (0, import_fields7.text)({
      ui: { description: "Nombre del banco" }
    }),
    clabe: (0, import_fields7.text)({
      db: { isNullable: true },
      ui: {
        listView: { fieldMode: "hidden" }
      }
    }),
    cardNumber: (0, import_fields7.text)({
      db: { isNullable: true },
      ui: {
        listView: { fieldMode: "hidden" }
      }
    }),
    stripeCustomerId: (0, import_fields7.text)({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
        itemView: { fieldMode: "read" },
        description: "Stripe Customer ID, created automatically on user signup"
      }
    }),
    /** SaaS payment methods (Stripe cards) saved by this user */
    saasPaymentMethods: (0, import_fields7.relationship)({
      ref: "SaasPaymentMethod.user",
      many: true,
      ui: { description: "Saved payment methods (Stripe)" }
    }),
    /** SaaS payments (subscriptions, one-time) made by this user */
    saasPayments: (0, import_fields7.relationship)({
      ref: "SaasPayment.user",
      many: true,
      ui: { description: "Payments made by this user (SaaS)" }
    }),
    techStatusBusinessLeads: (0, import_fields7.relationship)({
      ref: "TechStatusBusinessLead.salesPerson",
      many: true
    }),
    createdAt: (0, import_fields7.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    lastLoginAt: (0, import_fields7.timestamp)({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/User/UserAuthLog/UserAuthLog.ts
var import_core8 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");

// auth/permissions.ts
function sessionRoleNames(session2) {
  const names = [];
  const roles = session2?.data?.roles;
  if (Array.isArray(roles)) {
    for (const r of roles) {
      if (r && typeof r.name === "string" && r.name) {
        names.push(r.name);
      }
    }
  }
  const single = session2?.data?.role;
  if (typeof single === "string" && single) {
    names.push(single);
  }
  return names;
}
var hasRole = (session2, allowedRoles) => {
  if (!session2?.data) return false;
  const allowed = /* @__PURE__ */ new Set([...allowedRoles, "admin" /* ADMIN */]);
  return sessionRoleNames(session2).some((name) => allowed.has(name));
};

// models/User/UserAuthLog/UserAuthLog.access.ts
var userAuthLogAccess = {
  operation: {
    query: () => true,
    create: () => true,
    update: () => false,
    delete: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */])
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const userId = session2?.data?.id;
      if (!userId) return false;
      return { user: { id: { equals: userId } } };
    },
    update: () => false,
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      return false;
    }
  }
};

// models/User/UserAuthLog/constants.ts
var USER_AUTH_LOG_SOURCE = {
  REGISTER_USER: "REGISTER_USER",
  CUSTOM_AUTH: "CUSTOM_AUTH"
};
var USER_AUTH_LOG_STEP = {
  REGISTER_SUCCESS: "REGISTER_SUCCESS",
  REGISTER_FAIL_INVALID_REFERRER: "REGISTER_FAIL_INVALID_REFERRER",
  REGISTER_FAIL: "REGISTER_FAIL",
  CUSTOM_AUTH_SIGNUP: "CUSTOM_AUTH_SIGNUP",
  CUSTOM_AUTH_LOGIN: "CUSTOM_AUTH_LOGIN",
  CUSTOM_AUTH_FAIL: "CUSTOM_AUTH_FAIL"
};

// models/User/UserAuthLog/UserAuthLog.ts
var UserAuthLog_default = (0, import_core8.list)({
  access: userAuthLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "source",
        "step",
        "success",
        "emailMasked",
        "user",
        "message"
      ]
    }
  },
  fields: {
    user: (0, import_fields8.relationship)({
      ref: "User.authLogs",
      many: false,
      ui: { description: "Usuario afectado (vac\xEDo si fall\xF3 antes de crear cuenta)" }
    }),
    source: (0, import_fields8.select)({
      type: "string",
      options: [
        { label: "registerUser", value: USER_AUTH_LOG_SOURCE.REGISTER_USER },
        { label: "customAuth", value: USER_AUTH_LOG_SOURCE.CUSTOM_AUTH }
      ],
      ui: { description: "Mutaci\xF3n / flujo" }
    }),
    step: (0, import_fields8.text)({
      isIndexed: true,
      ui: { description: "C\xF3digo de resultado (USER_AUTH_LOG_STEP)" }
    }),
    success: (0, import_fields8.checkbox)({
      defaultValue: false
    }),
    message: (0, import_fields8.text)({
      ui: { displayMode: "textarea", description: "Mensaje o error (sin datos sensibles)" }
    }),
    emailMasked: (0, import_fields8.text)({
      ui: { description: "Email del intento (enmascarado)" }
    }),
    responseSnapshot: (0, import_fields8.json)({
      ui: { description: "Payload devuelto o metadatos (sin tokens)" }
    }),
    durationMs: (0, import_fields8.integer)({
      db: { isNullable: true },
      ui: { description: "Duraci\xF3n del intento en ms" }
    }),
    createdAt: (0, import_fields8.timestamp)({
      defaultValue: { kind: "now" },
      ui: { description: "Momento del evento" }
    })
  }
});

// models/Animal/AnimalBreed/AnimalBreed.ts
var import_core9 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var AnimalBreed_default = (0, import_core9.list)({
  access: access_default,
  fields: {
    breed: (0, import_fields9.text)(),
    animal_type: (0, import_fields9.relationship)({
      ref: "AnimalType.animal_breed"
    })
  },
  ui: {
    labelField: "breed"
  }
});

// models/Pet/Pet.ts
var import_core10 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var Pet_default = (0, import_core10.list)({
  access: access_default,
  fields: {
    name: (0, import_fields10.text)({ validation: { isRequired: true } }),
    birthday: (0, import_fields10.calendarDay)({ validation: { isRequired: true } }),
    age: (0, import_fields10.virtual)({
      field: import_core10.graphql.field({
        type: import_core10.graphql.String,
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
    animal_type: (0, import_fields10.relationship)({
      ref: "AnimalType",
      many: false
    }),
    animal_breed: (0, import_fields10.relationship)({
      ref: "AnimalBreed",
      many: false
    }),
    user: (0, import_fields10.relationship)({
      ref: "User",
      many: false
    }),
    multimedia: (0, import_fields10.relationship)({
      ref: "PetMultimedia.pet",
      many: true
    }),
    createdAt: (0, import_fields10.timestamp)({
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
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var PetMultimedia_default = (0, import_core11.list)({
  access: access_default,
  fields: {
    image: (0, import_fields11.image)({
      storage: "s3_pets"
    }),
    pet: (0, import_fields11.relationship)({
      ref: "Pet.multimedia"
    }),
    createdAt: (0, import_fields11.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/PetPlace/PetPlace.ts
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");

// models/Schedule/Schedule.ts
var import_core12 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var Schedule_default = (0, import_core12.list)({
  access: access_default,
  fields: {
    day: (0, import_fields12.select)({
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
    timeIni: (0, import_fields12.integer)({ validation: { isRequired: true } }),
    timeEnd: (0, import_fields12.integer)({ validation: { isRequired: true } }),
    pet_place: (0, import_fields12.relationship)({
      ref: "PetPlace.pet_place_schedules"
    }),
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
var PetPlace_default = (0, import_core13.list)({
  access: access_default,
  fields: {
    name: (0, import_fields13.text)({ validation: { isRequired: true } }),
    description: (0, import_fields13.text)({ validation: { isRequired: true } }),
    phone: (0, import_fields13.text)(),
    website: (0, import_fields13.text)(),
    street: (0, import_fields13.text)(),
    municipality: (0, import_fields13.text)(),
    state: (0, import_fields13.text)(),
    country: (0, import_fields13.text)(),
    cp: (0, import_fields13.text)(),
    lat: (0, import_fields13.text)(),
    lng: (0, import_fields13.text)(),
    views: (0, import_fields13.integer)(),
    types: (0, import_fields13.relationship)({
      ref: "PetPlaceType",
      many: true
    }),
    services: (0, import_fields13.relationship)({
      ref: "PetPlaceService",
      many: true
    }),
    user: (0, import_fields13.relationship)({
      ref: "User",
      many: false
    }),
    isOpen: (0, import_fields13.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.Boolean,
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
    pet_place_social_media: (0, import_fields13.relationship)({
      ref: "SocialMedia.pet_place",
      many: true
    }),
    pet_place_likes: (0, import_fields13.relationship)({
      ref: "PetPlaceLike.pet_place",
      many: true
    }),
    pet_place_schedules: (0, import_fields13.relationship)({
      ref: "Schedule.pet_place",
      many: true
    }),
    pet_place_reviews: (0, import_fields13.relationship)({
      ref: "Review.pet_place",
      many: true
    }),
    reviewsCount: (0, import_fields13.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.Int,
        async resolve(item, args, context) {
          const reviews = await context.query.Review.findMany({
            where: {
              pet_place: {
                id: {
                  equals: item.id
                }
              }
            },
            query: "id"
          });
          return reviews.length;
        }
      })
    }),
    averageRating: (0, import_fields13.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.Float,
        async resolve(item, args, context) {
          const reviews = await context.query.Review.findMany({
            where: {
              pet_place: {
                id: {
                  equals: item.id
                }
              }
            },
            query: "rating"
          });
          if (reviews.length === 0) {
            return 0;
          }
          const totalRating = reviews.reduce((sum, review) => {
            return sum + (review.rating || 0);
          }, 0);
          const average = totalRating / reviews.length;
          return Math.round(average * 10) / 10;
        }
      })
    }),
    pet_place_ads: (0, import_fields13.relationship)({
      ref: "Ad.pet_place",
      many: true
    }),
    address: (0, import_fields13.text)(),
    google_place_id: (0, import_fields13.text)({
      isIndexed: "unique",
      validation: { isRequired: false }
    }),
    google_opening_hours: (0, import_fields13.text)(),
    createdAt: (0, import_fields13.timestamp)({
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
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var PetPlaceLike_default = (0, import_core14.list)({
  access: access_default,
  fields: {
    user: (0, import_fields14.relationship)({
      ref: "User",
      many: false
    }),
    pet_place: (0, import_fields14.relationship)({
      ref: "PetPlace.pet_place_likes"
    }),
    createdAt: (0, import_fields14.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/PetPlace/PetPlaceService/PetPlaceService.ts
var import_core15 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var PetPlaceService_default = (0, import_core15.list)({
  access: access_default,
  fields: {
    name: (0, import_fields15.text)(),
    slug: (0, import_fields15.text)(),
    description: (0, import_fields15.text)({ ui: { displayMode: "textarea" } }),
    active: (0, import_fields15.checkbox)(),
    createdAt: (0, import_fields15.timestamp)({
      defaultValue: {
        kind: "now"
      }
    })
  }
});

// models/SocialMedia/SocialMedia.ts
var import_core16 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var SocialMedia_default = (0, import_core16.list)({
  access: access_default,
  fields: {
    social_media: (0, import_fields16.select)({
      options: ["Facebook", "Instagram", "X", "LinkedIn"],
      validation: { isRequired: true }
    }),
    link: (0, import_fields16.text)({
      validation: { isRequired: true }
    }),
    pet_place: (0, import_fields16.relationship)({
      ref: "PetPlace.pet_place_social_media"
    }),
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

// models/SystemRelease/SystemRelease.ts
var import_core17 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");

// models/SystemRelease/systemRelease.access.ts
var systemReleaseAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]),
    update: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]),
    delete: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */])
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) return true;
      return { isPublished: { equals: true } };
    },
    update: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]),
    delete: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */])
  }
};

// models/SystemRelease/constants.ts
var SYSTEM_RELEASE_PRODUCT = {
  PET: "pet",
  SAAS: "saas",
  ALL: "all"
};
var SYSTEM_RELEASE_PRODUCT_OPTIONS = [
  { label: "Pet", value: SYSTEM_RELEASE_PRODUCT.PET },
  { label: "SaaS", value: SYSTEM_RELEASE_PRODUCT.SAAS },
  { label: "Ambas", value: SYSTEM_RELEASE_PRODUCT.ALL }
];

// models/SystemRelease/SystemRelease.ts
var SystemRelease_default = (0, import_core17.list)({
  access: systemReleaseAccess,
  ui: {
    labelField: "version",
    listView: {
      initialColumns: [
        "version",
        "product",
        "title",
        "releasedAt",
        "isPublished",
        "createdAt"
      ]
    }
  },
  fields: {
    version: (0, import_fields17.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Versi\xF3n semver o etiqueta (ej. 1.4.0)" }
    }),
    product: (0, import_fields17.select)({
      options: SYSTEM_RELEASE_PRODUCT_OPTIONS,
      validation: { isRequired: true },
      ui: {
        displayMode: "select",
        description: "Pet, SaaS o ambas apps"
      }
    }),
    title: (0, import_fields17.text)({
      ui: { description: "T\xEDtulo corto del release (opcional)" }
    }),
    body: (0, import_fields17.text)({
      ui: {
        displayMode: "textarea",
        description: "Notas de cambio (texto o markdown seg\xFAn el front)"
      }
    }),
    releasedAt: (0, import_fields17.timestamp)({
      validation: { isRequired: true },
      ui: { description: "Fecha en que aplica / se publica el release" }
    }),
    isPublished: (0, import_fields17.checkbox)({
      defaultValue: false,
      ui: { description: "Si est\xE1 desmarcado, solo admins lo ven en listados" }
    }),
    createdAt: (0, import_fields17.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Review/Review.ts
var import_core18 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var Review_default = (0, import_core18.list)({
  access: access_default,
  fields: {
    rating: (0, import_fields18.integer)(),
    review: (0, import_fields18.text)(),
    pet_place: (0, import_fields18.relationship)({
      ref: "PetPlace.pet_place_reviews"
    }),
    product: (0, import_fields18.relationship)({
      ref: "Product.product_reviews"
    }),
    user: (0, import_fields18.relationship)({
      ref: "User",
      many: false
    }),
    google_user: (0, import_fields18.text)(),
    google_user_photo: (0, import_fields18.text)(),
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

// models/Store/Product/Product.ts
var import_core19 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var Product_default = (0, import_core19.list)({
  access: access_default,
  fields: {
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    price: (0, import_fields19.integer)({ validation: { isRequired: true } }),
    description: (0, import_fields19.text)({ validation: { isRequired: true } }),
    category: (0, import_fields19.select)({
      validation: { isRequired: true },
      options: PRODUCT_CATEGORIES
    }),
    brand: (0, import_fields19.select)({
      validation: { isRequired: true },
      options: BRANDS
    }),
    type: (0, import_fields19.select)({
      validation: { isRequired: true },
      options: ANIMAL_TYPE_OPTIONS
    }),
    product_reviews: (0, import_fields19.relationship)({
      ref: "Review.product",
      many: true
    }),
    product_ads: (0, import_fields19.relationship)({
      ref: "Ad.product",
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

// models/Store/WishList/WishList.ts
var import_core20 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var WishList_default = (0, import_core20.list)({
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
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// models/Store/Cart/Cart.ts
var import_core21 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var Cart_default = (0, import_core21.list)({
  access: access_default,
  fields: {
    name: (0, import_fields21.text)({ validation: { isRequired: true } }),
    user: (0, import_fields21.relationship)({
      ref: "User",
      many: false
    }),
    product: (0, import_fields21.relationship)({
      ref: "Product",
      many: true
    }),
    createdAt: (0, import_fields21.timestamp)({
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
var import_core22 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var Order_default = (0, import_core22.list)({
  access: access_default,
  fields: {
    total: (0, import_fields22.integer)(),
    status: (0, import_fields22.select)({ validation: { isRequired: true }, options: ORDER_STATUS }),
    cart: (0, import_fields22.relationship)({
      ref: "Cart",
      many: false
    }),
    user: (0, import_fields22.relationship)({
      ref: "User",
      many: false
    }),
    payment: (0, import_fields22.relationship)({
      ref: "Payment.order_payment",
      many: false
    }),
    createdAt: (0, import_fields22.timestamp)({
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
var import_fields23 = require("@keystone-6/core/fields");
var import_core23 = require("@keystone-6/core");
var Payment_default = (0, import_core23.list)({
  access: access_default,
  fields: {
    order_payment: (0, import_fields23.relationship)({
      ref: "Order.payment"
    }),
    paymentMethod: (0, import_fields23.relationship)({
      ref: "PaymentMethod.payment"
    }),
    amount: (0, import_fields23.decimal)({
      scale: 6,
      defaultValue: "0.000000"
    }),
    status: (0, import_fields23.select)({
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
    processorStripeChargeId: (0, import_fields23.text)(),
    stripeErrorMessage: (0, import_fields23.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    processorRefundId: (0, import_fields23.text)(),
    createdAt: (0, import_fields23.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields23.timestamp)({
      defaultValue: { kind: "now" },
      db: { updatedAt: true }
    })
  }
});

// models/Store/PaymentMethod/PaymentMethod.ts
var import_fields24 = require("@keystone-6/core/fields");
var import_core24 = require("@keystone-6/core");
var PaymentMethod_default = (0, import_core24.list)({
  access: access_default,
  fields: {
    user: (0, import_fields24.relationship)({
      ref: "User"
    }),
    cardType: (0, import_fields24.text)(),
    isDefault: (0, import_fields24.checkbox)(),
    lastFourDigits: (0, import_fields24.text)(),
    expMonth: (0, import_fields24.text)(),
    expYear: (0, import_fields24.text)(),
    stripeProcessorId: (0, import_fields24.text)(),
    address: (0, import_fields24.text)(),
    postalCode: (0, import_fields24.text)(),
    ownerName: (0, import_fields24.text)(),
    country: (0, import_fields24.text)(),
    // Two-letter country code (ISO 3166-1 alpha-2).
    payment: (0, import_fields24.relationship)({
      ref: "Payment.paymentMethod",
      many: true
    }),
    type: (0, import_fields24.select)({ options: PAYMENT_TYPES }),
    createdAt: (0, import_fields24.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields24.timestamp)({
      defaultValue: { kind: "now" },
      db: { updatedAt: true }
    })
  }
});

// models/TokenNotification/TokenNotification.ts
var import_fields25 = require("@keystone-6/core/fields");
var import_core25 = require("@keystone-6/core");

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
var TokenNotification_default = (0, import_core25.list)({
  access: access_default,
  hooks: TokenNotification_hooks_default.hooks,
  fields: {
    token: (0, import_fields25.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    user: (0, import_fields25.relationship)({
      ref: "User",
      many: false
    })
  }
});

// models/Ad/Ad.ts
var import_core26 = require("@keystone-6/core");
var import_fields26 = require("@keystone-6/core/fields");
var Ad_default = (0, import_core26.list)({
  access: access_default,
  fields: {
    title: (0, import_fields26.text)(),
    description: (0, import_fields26.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    active: (0, import_fields26.checkbox)(),
    start_date: (0, import_fields26.calendarDay)(),
    end_date: (0, import_fields26.calendarDay)(),
    price: (0, import_fields26.integer)(),
    status: (0, import_fields26.select)({
      options: STATUS_AD
    }),
    type: (0, import_fields26.select)({
      options: TYPES_AD
    }),
    lat: (0, import_fields26.text)(),
    lng: (0, import_fields26.text)(),
    image: (0, import_fields26.image)({
      storage: "s3_ads"
    }),
    pet_place: (0, import_fields26.relationship)({
      ref: "PetPlace.pet_place_ads"
    }),
    product: (0, import_fields26.relationship)({
      ref: "Product.product_ads"
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
    })
  }
});

// models/Blog/Post/Post.ts
var import_core27 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");

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
var newPostEmailHook = {
  afterOperation: async ({
    operation,
    item,
    context
  }) => {
    if (operation === "create" && item?.published === true) {
      try {
        const post = await context.sudo().query.Post.findOne({
          where: { id: item.id },
          query: `
            id
            title
            url
            excerpt
            author {
              name
              lastName
            }
            category {
              name
            }
          `
        });
        if (!post) {
          return;
        }
        const subscriptions = await context.sudo().query.BlogSubscription.findMany({
          where: {
            active: {
              equals: true
            }
          },
          query: "email"
        });
        if (subscriptions.length === 0) {
          console.log("No active subscriptions found. Email not sent.");
          return;
        }
        const recipientEmails = subscriptions.map((sub) => sub.email).filter((email) => email && email.trim() !== "");
        if (recipientEmails.length === 0) {
          console.log("No valid email addresses found. Email not sent.");
          return;
        }
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const postUrl = `${frontendUrl}/blog/${post.url || post.id}`;
        const authorName = post.author ? `${post.author.name} ${post.author.lastName || ""}`.trim() : null;
        await sendNewPostEmail({
          postTitle: post.title,
          postUrl,
          postExcerpt: post.excerpt,
          authorName,
          categoryName: post.category?.name || null,
          recipientEmails
        });
        console.log(`New post email sent to ${recipientEmails.length} subscribers`);
      } catch (error) {
        console.error("Error sending new post email:", error);
      }
    }
  }
};

// models/Blog/Post/Post.ts
var import_fields_document = require("@keystone-6/fields-document");
var Post_default = (0, import_core27.list)({
  access: access_default,
  hooks: {
    resolveInput: publishedAtHook.resolveInput,
    afterOperation: newPostEmailHook.afterOperation
  },
  fields: {
    title: (0, import_fields27.text)({ validation: { isRequired: true } }),
    url: (0, import_fields27.text)({
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
    excerpt: (0, import_fields27.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    image: (0, import_fields27.image)({
      storage: "s3_posts"
    }),
    published: (0, import_fields27.checkbox)({
      defaultValue: false
    }),
    publishedAt: (0, import_fields27.timestamp)({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "edit" }
      }
    }),
    category: (0, import_fields27.relationship)({
      ref: "Category.posts",
      many: false
    }),
    tags: (0, import_fields27.relationship)({
      ref: "Tag.posts",
      many: true
    }),
    author: (0, import_fields27.relationship)({
      ref: "User",
      many: false
    }),
    comments: (0, import_fields27.relationship)({
      ref: "PostComment.post",
      many: true
    }),
    post_likes: (0, import_fields27.relationship)({
      ref: "PostLike.post",
      many: true
    }),
    post_favorites: (0, import_fields27.relationship)({
      ref: "PostFavorite.post",
      many: true
    }),
    post_views: (0, import_fields27.relationship)({
      ref: "PostView.post",
      many: true
    }),
    createdAt: (0, import_fields27.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields27.timestamp)({
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
var import_core28 = require("@keystone-6/core");
var import_fields28 = require("@keystone-6/core/fields");
var PostComment_default = (0, import_core28.list)({
  access: access_default,
  fields: {
    comment: (0, import_fields28.text)({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" }
    }),
    post: (0, import_fields28.relationship)({
      ref: "Post.comments",
      many: false
    }),
    user: (0, import_fields28.relationship)({
      ref: "User",
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
    }),
    updatedAt: (0, import_fields28.timestamp)({
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
var import_core29 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var PostLike_default = (0, import_core29.list)({
  access: access_default,
  fields: {
    user: (0, import_fields29.relationship)({
      ref: "User",
      many: false
    }),
    post: (0, import_fields29.relationship)({
      ref: "Post.post_likes",
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

// models/Blog/Post/PostFavorite/PostFavorite.ts
var import_core30 = require("@keystone-6/core");
var import_fields30 = require("@keystone-6/core/fields");
var PostFavorite_default = (0, import_core30.list)({
  access: access_default,
  fields: {
    user: (0, import_fields30.relationship)({
      ref: "User",
      many: false
    }),
    post: (0, import_fields30.relationship)({
      ref: "Post.post_favorites",
      many: false
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

// models/Blog/Post/PostView/PostView.ts
var import_core31 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");
var PostView_default = (0, import_core31.list)({
  access: access_default,
  fields: {
    user: (0, import_fields31.relationship)({
      ref: "User",
      many: false
    }),
    post: (0, import_fields31.relationship)({
      ref: "Post.post_views",
      many: false
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

// models/Blog/Tag/Tag.ts
var import_core32 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var Tag_default = (0, import_core32.list)({
  access: access_default,
  fields: {
    name: (0, import_fields32.text)({
      validation: { isRequired: true },
      isIndexed: "unique"
    }),
    posts: (0, import_fields32.relationship)({
      ref: "Post.tags",
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

// models/Blog/Category/Category.ts
var import_core33 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");

// models/Blog/Category/Category.hooks.ts
function sanitizeUrl2(text48) {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;
  let cleaned = text48.replace(emojiRegex, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ñ/g, "n").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
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
var Category_default = (0, import_core33.list)({
  access: access_default,
  fields: {
    name: (0, import_fields33.select)({
      options: POST_CATEGORIES,
      isIndexed: "unique"
    }),
    url: (0, import_fields33.text)({
      isIndexed: "unique",
      hooks: categoryUrlHook,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    image: (0, import_fields33.image)({
      storage: "s3_categories"
    }),
    posts: (0, import_fields33.relationship)({
      ref: "Post.category",
      many: true
    }),
    createdAt: (0, import_fields33.timestamp)({
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

// models/Blog/BlogSubscription/BlogSubscription.ts
var import_core34 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var BlogSubscription_default = (0, import_core34.list)({
  access: access_default,
  fields: {
    email: (0, import_fields34.text)({
      isIndexed: "unique",
      ui: {
        displayMode: "input"
      }
    }),
    user: (0, import_fields34.relationship)({
      ref: "User.blog_subscriptions",
      many: false,
      ui: {
        displayMode: "select"
      }
    }),
    active: (0, import_fields34.checkbox)({
      defaultValue: true,
      ui: {
        description: "Si est\xE1 activo, recibir\xE1 notificaciones de nuevos posts"
      }
    }),
    createdAt: (0, import_fields34.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  },
  ui: {
    labelField: "email",
    listView: {
      initialColumns: ["email", "user", "active", "createdAt"]
    }
  }
});

// models/Role/Role.ts
var import_core35 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var Role_default = (0, import_core35.list)({
  access: access_default,
  fields: {
    name: (0, import_fields35.select)({
      options: ROLES,
      isIndexed: "unique"
    }),
    users: (0, import_fields35.relationship)({
      ref: "User.roles",
      many: true
    }),
    createdAt: (0, import_fields35.timestamp)({
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
var import_core36 = require("@keystone-6/core");
var import_fields36 = require("@keystone-6/core/fields");
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
var PetPlaceType_default = (0, import_core36.list)({
  access: access_default,
  fields: {
    value: (0, import_fields36.select)({
      validation: { isRequired: true },
      isIndexed: "unique",
      options: PET_PLACE_TYPE_OPTIONS
    }),
    label: (0, import_fields36.text)({
      isIndexed: "unique",
      hooks: labelHook,
      ui: {
        itemView: { fieldMode: "read" }
      }
    }),
    plural: (0, import_fields36.text)({
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

// models/ContactForm/ContactForm.ts
var import_core37 = require("@keystone-6/core");
var import_fields37 = require("@keystone-6/core/fields");
var CONTACT_FORM_STATUS_OPTIONS = [
  { label: "Nuevo", value: "new" },
  { label: "Le\xEDdo", value: "read" },
  { label: "En proceso", value: "in_progress" },
  { label: "Resuelto", value: "resolved" }
];
var ContactForm_default = (0, import_core37.list)({
  access: access_default,
  fields: {
    name: (0, import_fields37.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "input"
      }
    }),
    email: (0, import_fields37.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "input"
      }
    }),
    phone: (0, import_fields37.text)({
      validation: { isRequired: false },
      ui: {
        displayMode: "input"
      }
    }),
    subject: (0, import_fields37.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "input"
      }
    }),
    message: (0, import_fields37.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea"
      }
    }),
    status: (0, import_fields37.select)({
      options: CONTACT_FORM_STATUS_OPTIONS,
      defaultValue: "new",
      ui: {
        displayMode: "select"
      }
    }),
    createdAt: (0, import_fields37.timestamp)({
      defaultValue: {
        kind: "now"
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  },
  ui: {
    labelField: "subject",
    listView: {
      initialColumns: ["name", "email", "subject", "status", "createdAt"]
    }
  }
});

// models/Tech/BusinessLead/TechBusinessLead.ts
var import_core38 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");

// models/Tech/BusinessLead/TechBusinessLead.access.ts
var businessLeadAccess = {
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

// models/Tech/BusinessLead/TechBusinessLead.hooks.ts
var businessLeadHooks = {
  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context,
    listKey
  }) => {
  }
};

// models/Tech/crm/constants.ts
var PIPELINE_STATUS = {
  DETECTADO: "01 - Detectado",
  SELECCIONADO: "02 - Seleccionado",
  CONTACTADO: "03 - Contactado",
  SIN_RESPUESTA: "04 - Sin Respuesta",
  INTERESADO: "05 - Interesado",
  CREANDO_PROYECTO_PROPUESTA: "06 - Creando proyecto propuesta",
  PROPUESTA_ENVIADA: "07 - Propuesta Enviada",
  SEGUIMIENTO: "08 - Seguimiento",
  EN_NEGOCIACION: "09 - En Negociaci\xF3n",
  PROPUESTA_ACEPTADA: "10 - Propuesta Aceptada",
  PROPUESTA_RECHAZADA: "11 - Propuesta Rechazada",
  CERRADO_GANADO: "12 - Cerrado Ganado",
  CERRADO_PERDIDO: "13 - Cerrado Perdido",
  DESCARTADO: "14 - Descartado"
};
var OPPORTUNITY_LEVEL = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja"
};
var SALES_ACTIVITY_TYPE = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  REUNION: "Reuni\xF3n",
  OTRA: "Otra"
};
var PROPOSAL_STATUS = {
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  PENDIENTE: "Pendiente",
  COMPRADA: "Comprada"
};
var FOLLOW_UP_TASK_STATUS = {
  PENDIENTE: "Pendiente",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
  POSPUESTO: "Pospuesto"
};
var TASK_PRIORITY = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja"
};
var LEAD_SOURCE = {
  GOOGLE_MAPS: "Google Maps",
  REFERIDO: "Referido",
  WEB: "Web",
  SOCIAL_MEDIA: "Redes Sociales",
  EMAIL: "Email",
  CALL: "Llamada",
  OTRO: "Otro"
};

// models/Tech/BusinessLead/TechBusinessLead.ts
var sourceOptions = Object.entries(LEAD_SOURCE).map(([k, v]) => ({
  label: v,
  value: v
}));
var TechBusinessLead_default = (0, import_core38.list)({
  access: businessLeadAccess,
  hooks: businessLeadHooks,
  ui: {
    labelField: "businessName",
    listView: {
      initialColumns: [
        "businessName",
        "category",
        "status",
        "salesPerson"
      ]
    }
  },
  fields: {
    businessName: (0, import_fields38.text)({
      validation: { isRequired: true },
      isIndexed: true
    }),
    category: (0, import_fields38.text)({ isIndexed: true }),
    phone: (0, import_fields38.text)(),
    email: (0, import_fields38.text)(),
    address: (0, import_fields38.text)(),
    city: (0, import_fields38.text)({ isIndexed: true }),
    state: (0, import_fields38.text)({ isIndexed: true }),
    country: (0, import_fields38.text)({ isIndexed: true }),
    rating: (0, import_fields38.float)(),
    lat: (0, import_fields38.float)(),
    lng: (0, import_fields38.float)(),
    reviewCount: (0, import_fields38.integer)({ ui: { description: "N\xFAmero de rese\xF1as" } }),
    hasWebsite: (0, import_fields38.checkbox)({
      defaultValue: false,
      ui: { description: "Tiene sitio web" }
    }),
    websiteUrl: (0, import_fields38.text)(),
    source: (0, import_fields38.select)({
      type: "string",
      options: sourceOptions,
      defaultValue: "Google Maps",
      ui: { description: "Fuente del lead" }
    }),
    status: (0, import_fields38.relationship)({
      ref: "TechStatusBusinessLead.businessLead",
      many: true,
      ui: { description: "Estado y datos variables del lead" }
    }),
    instagram: (0, import_fields38.text)({ ui: { description: "Usuario o URL de Instagram" } }),
    facebook: (0, import_fields38.text)({ ui: { description: "URL de Facebook" } }),
    xTwitter: (0, import_fields38.text)({ ui: { description: "Usuario o URL de X (Twitter)" } }),
    tiktok: (0, import_fields38.text)({ ui: { description: "Usuario o URL de TikTok" } }),
    // Reseñas de Google (máx. 5 positivas) para uso en prompt de IA
    topReview1: (0, import_fields38.text)({
      ui: { displayMode: "textarea", description: "Mejor rese\xF1a 1 (Google)" }
    }),
    topReview2: (0, import_fields38.text)({
      ui: { displayMode: "textarea", description: "Mejor rese\xF1a 2 (Google)" }
    }),
    topReview3: (0, import_fields38.text)({
      ui: { displayMode: "textarea", description: "Mejor rese\xF1a 3 (Google)" }
    }),
    topReview4: (0, import_fields38.text)({
      ui: { displayMode: "textarea", description: "Mejor rese\xF1a 4 (Google)" }
    }),
    topReview5: (0, import_fields38.text)({
      ui: { displayMode: "textarea", description: "Mejor rese\xF1a 5 (Google)" }
    }),
    // Prompt listo para copiar y usar en vibe coding / IA (info del negocio + reseñas)
    websitePromptContent: (0, import_fields38.text)({
      ui: {
        displayMode: "textarea",
        description: "Prompt listo para IA: crear sitio web con la info del negocio y las 5 rese\xF1as positivas de Google. Copiar y pegar en tu herramienta de vibe coding."
      }
    }),
    // Relaciones inversas
    activities: (0, import_fields38.relationship)({
      ref: "TechSalesActivity.businessLead",
      many: true,
      ui: { hideCreate: true }
    }),
    tasks: (0, import_fields38.relationship)({
      ref: "TechTask.businessLead",
      many: true,
      ui: { hideCreate: true, description: "Tareas de workspace ligadas al lead" }
    }),
    proposals: (0, import_fields38.relationship)({
      ref: "TechProposal.businessLead",
      many: true,
      ui: { hideCreate: true }
    }),
    projects: (0, import_fields38.relationship)({
      ref: "SaasProject.businessLead",
      many: true,
      ui: { description: "Proyectos creados tras venta cerrada (cliente)" }
    }),
    followUpTasks: (0, import_fields38.relationship)({
      ref: "TechFollowUpTask.businessLead",
      many: true,
      ui: { hideCreate: true }
    }),
    googleMapsUrl: (0, import_fields38.text)({
      ui: { description: "URL de Google Maps del negocio" }
    }),
    // Para importación desde Google (opcional)
    googlePlaceId: (0, import_fields38.text)({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" }
      }
    }),
    salesPerson: (0, import_fields38.relationship)({
      ref: "User.businessLeadsAssigned",
      many: true,
      ui: { description: "Vendedor asignado" }
    }),
    saasCompany: (0, import_fields38.relationship)({
      ref: "SaasCompany.leads",
      many: true,
      ui: { description: "Empresa a la que pertenece el lead" }
    }),
    quotations: (0, import_fields38.relationship)({
      ref: "SaasQuotation.lead",
      many: true,
      ui: { description: "Cotizaciones ligadas a este lead" }
    }),
    createdAt: (0, import_fields38.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields38.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Tech/StatusBusinessLead/TechStatusBusinessLead.ts
var import_core39 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");

// models/Tech/StatusBusinessLead/TechStatusBusinessLead.access.ts
var statusBusinessLeadAccess = {
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

// models/Tech/StatusBusinessLead/TechStatusBusinessLead.ts
var pipelineOptions = Object.entries(PIPELINE_STATUS).map(([k, v]) => ({
  label: v,
  value: v
}));
var opportunityOptions = Object.entries(OPPORTUNITY_LEVEL).map(([k, v]) => ({
  label: v,
  value: v
}));
var TechStatusBusinessLead_default = (0, import_core39.list)({
  access: statusBusinessLeadAccess,
  ui: {
    listView: {
      initialColumns: [
        "businessLead",
        "pipelineStatus",
        "opportunityLevel",
        "estimatedValue"
      ]
    }
  },
  fields: {
    businessLead: (0, import_fields39.relationship)({
      ref: "TechBusinessLead.status",
      many: false,
      ui: { description: "Lead de negocio asociado" }
    }),
    opportunityLevel: (0, import_fields39.select)({
      type: "string",
      options: opportunityOptions,
      defaultValue: "Media",
      isIndexed: true,
      ui: { description: "Nivel de oportunidad" }
    }),
    pipelineStatus: (0, import_fields39.select)({
      type: "string",
      options: pipelineOptions,
      defaultValue: PIPELINE_STATUS.DETECTADO,
      isIndexed: true,
      ui: { description: "Estado en el pipeline" }
    }),
    estimatedValue: (0, import_fields39.float)({
      ui: { description: "Valor estimado del proyecto" }
    }),
    productOffered: (0, import_fields39.text)({
      ui: { description: "Producto ofrecido (web, e-commerce, etc.)" }
    }),
    firstContactDate: (0, import_fields39.calendarDay)({
      ui: { description: "Fecha primer contacto" }
    }),
    /** Virtual: next follow-up date from the latest FollowUpTask with status Pendiente or Pospuesto */
    nextFollowUpDate: (0, import_fields39.virtual)({
      field: import_core39.graphql.field({
        type: import_core39.graphql.String,
        async resolve(item, _args, context) {
          let businessLeadId = item.businessLeadId;
          if (businessLeadId == null) {
            const s = await context.sudo().query.TechStatusBusinessLead.findOne({
              where: { id: item.id },
              query: "businessLead { id }"
            });
            businessLeadId = s?.businessLead?.id ?? null;
          }
          if (!businessLeadId) return null;
          const tasks = await context.sudo().query.TechFollowUpTask.findMany({
            where: {
              businessLead: { id: { equals: businessLeadId } },
              status: {
                in: [FOLLOW_UP_TASK_STATUS.PENDIENTE, FOLLOW_UP_TASK_STATUS.POSPUESTO]
              }
            },
            orderBy: [{ scheduledDate: "desc" }],
            take: 1,
            query: "scheduledDate"
          });
          const date = tasks[0]?.scheduledDate;
          return date ?? null;
        }
      }),
      ui: { description: "Pr\xF3xima fecha de seguimiento (del \xFAltimo FollowUpTask Pendiente o Pospuesto)" }
    }),
    saasCompany: (0, import_fields39.relationship)({
      ref: "SaasCompany.techStatusBusinessLeads",
      many: false,
      ui: { description: "Empresa a la que pertenece el lead" }
    }),
    salesPerson: (0, import_fields39.relationship)({
      ref: "User.techStatusBusinessLeads",
      many: false,
      ui: { description: "Vendedor asignado" }
    }),
    notes: (0, import_fields39.text)({
      ui: { displayMode: "textarea", description: "Notas generales" }
    })
  }
});

// models/Tech/FollowUpTask/TechFollowUpTask.ts
var import_core40 = require("@keystone-6/core");
var import_fields40 = require("@keystone-6/core/fields");

// utils/access/crmWorkspaceScopedFilter.ts
var getCompanyId = (session2) => session2?.data?.company?.id;
var getUserId = (session2) => session2?.data?.id;
function companyScopedOr(companyId) {
  return {
    OR: [
      {
        businessLead: {
          saasCompany: { some: { id: { equals: companyId } } }
        }
      },
      {
        workspace: {
          company: { id: { equals: companyId } }
        }
      }
    ]
  };
}
function crmWorkspaceScopedWhere(session2, options) {
  if (hasRole(session2, ["admin" /* ADMIN */])) {
    return true;
  }
  const companyId = getCompanyId(session2);
  const userId = getUserId(session2);
  const assigneeKey = options.assigneeField;
  if (hasRole(session2, ["admin_company" /* ADMIN_COMPANY */])) {
    if (!companyId) return false;
    return companyScopedOr(companyId);
  }
  if (hasRole(session2, ["user_company" /* USER_COMPANY */])) {
    if (!companyId || !userId) return false;
    return {
      AND: [
        { [assigneeKey]: { id: { equals: userId } } },
        companyScopedOr(companyId)
      ]
    };
  }
  return false;
}

// models/Tech/FollowUpTask/TechFollowUpTask.access.ts
var getCompanyId2 = (session2) => session2?.data?.company?.id;
var followUpTaskAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId2(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" }),
    update: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" }),
    delete: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" })
  }
};

// utils/validation/validateTechStatusCrm.ts
function getRelationshipConnectId(value) {
  if (!value || typeof value !== "object") return void 0;
  const c = value.connect;
  return typeof c?.id === "string" ? c.id : void 0;
}
async function resolveWorkspaceIdForTechItem(context, listKey, item) {
  if (item?.workspaceId) return item.workspaceId ?? void 0;
  if (!item?.id) return void 0;
  const sudo = context.sudo();
  if (listKey === "TechFollowUpTask") {
    const row2 = await sudo.query.TechFollowUpTask.findOne({
      where: { id: item.id },
      query: "workspace { id }"
    });
    return row2?.workspace?.id;
  }
  if (listKey === "TechProposal") {
    const row2 = await sudo.query.TechProposal.findOne({
      where: { id: item.id },
      query: "workspace { id }"
    });
    return row2?.workspace?.id;
  }
  if (listKey === "TechTask") {
    const row2 = await sudo.query.TechTask.findOne({
      where: { id: item.id },
      query: "workspace { id }"
    });
    return row2?.workspace?.id;
  }
  const row = await sudo.query.TechSalesActivity.findOne({
    where: { id: item.id },
    query: "workspace { id }"
  });
  return row?.workspace?.id;
}
async function validateTechStatusCrmInput(args) {
  const { context, resolvedData, item, listKey, addValidationError } = args;
  if (!("statusCrm" in resolvedData)) return;
  const statusCrmId = getRelationshipConnectId(resolvedData.statusCrm);
  if (!statusCrmId) return;
  const workspaceIdFromInput = getRelationshipConnectId(
    resolvedData.workspace
  );
  let workspaceId = workspaceIdFromInput ?? item?.workspaceId ?? await resolveWorkspaceIdForTechItem(context, listKey, item);
  if (!workspaceId) {
    addValidationError(
      "Asigna un workspace antes de usar un estado CRM (statusCrm)."
    );
    return;
  }
  const status = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
    where: { id: statusCrmId },
    query: "id workspace { id }"
  });
  if (!status) {
    addValidationError("El estado CRM indicado no existe.");
    return;
  }
  if (status.workspace?.id !== workspaceId) {
    addValidationError(
      "El estado CRM debe pertenecer al mismo workspace que el registro."
    );
  }
}

// models/Tech/FollowUpTask/TechFollowUpTask.hooks.ts
var followUpTaskHooks = {
  validateInput: async ({
    context,
    resolvedData,
    item,
    addValidationError
  }) => {
    await validateTechStatusCrmInput({
      context,
      resolvedData,
      item,
      listKey: "TechFollowUpTask",
      addValidationError
    });
  }
};

// models/Tech/FollowUpTask/TechFollowUpTask.ts
var statusOptions = Object.entries(FOLLOW_UP_TASK_STATUS).map(([k, v]) => ({
  label: v,
  value: v
}));
var priorityOptions = Object.entries(TASK_PRIORITY).map(([k, v]) => ({
  label: v,
  value: v
}));
var TechFollowUpTask_default = (0, import_core40.list)({
  access: followUpTaskAccess,
  hooks: followUpTaskHooks,
  ui: {
    listView: {
      initialColumns: [
        "scheduledDate",
        "status",
        "priority",
        "businessLead",
        "assignedSeller"
      ]
    }
  },
  fields: {
    scheduledDate: (0, import_fields40.calendarDay)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Fecha programada" }
    }),
    status: (0, import_fields40.select)({
      type: "string",
      options: statusOptions,
      defaultValue: FOLLOW_UP_TASK_STATUS.PENDIENTE,
      isIndexed: true
    }),
    priority: (0, import_fields40.select)({
      type: "string",
      options: priorityOptions,
      defaultValue: TASK_PRIORITY.MEDIA
    }),
    businessLead: (0, import_fields40.relationship)({
      ref: "TechBusinessLead.followUpTasks",
      many: false
    }),
    assignedSeller: (0, import_fields40.relationship)({
      ref: "User.followUpTasks",
      many: false
    }),
    createdBy: (0, import_fields40.relationship)({
      ref: "User.createdByFollowUpTasks",
      many: false
    }),
    workspace: (0, import_fields40.relationship)({
      ref: "SaasWorkspace.followUpTasks",
      many: false,
      ui: { description: "Workspace a la que pertenece la tarea" }
    }),
    statusCrm: (0, import_fields40.relationship)({
      ref: "SaasWorkspaceCrmStatus.followUpTasks",
      many: false,
      ui: { description: "Estado CRM din\xE1mico (workspace + tipo tarea)" }
    }),
    notes: (0, import_fields40.text)({ ui: { displayMode: "textarea" } }),
    hiddenInWorkspace: (0, import_fields40.checkbox)({
      defaultValue: false,
      ui: { description: "Ocultar en el workspace" }
    }),
    createdAt: (0, import_fields40.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields40.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Tech/Proposal/TechProposal.ts
var import_core41 = require("@keystone-6/core");
var import_fields41 = require("@keystone-6/core/fields");

// models/Tech/Proposal/TechProposal.access.ts
var getCompanyId3 = (session2) => session2?.data?.company?.id;
var proposalAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId3(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" }),
    update: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" }),
    delete: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" })
  }
};

// models/Tech/Proposal/TechProposal.hooks.ts
var proposalHooks = {
  validateInput: async ({
    context,
    resolvedData,
    item,
    addValidationError
  }) => {
    await validateTechStatusCrmInput({
      context,
      resolvedData,
      item,
      listKey: "TechProposal",
      addValidationError
    });
  },
  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context,
    listKey
  }) => {
    if (listKey !== "TechProposal" || !item?.id) return;
    if (operation === "update" && resolvedData?.status === PROPOSAL_STATUS.COMPRADA) {
      const proposal = await context.query.TechProposal.findOne({
        where: { id: item.id },
        query: "id status businessLead { id }"
      });
      if (!proposal?.businessLead?.id || proposal.status !== PROPOSAL_STATUS.COMPRADA)
        return;
      try {
        const lead = await context.query.TechBusinessLead.findOne({
          where: { id: proposal.businessLead.id },
          query: "id status { id }"
        });
        if (lead?.status?.id) {
          await context.db.TechStatusBusinessLead.updateOne({
            where: { id: lead.status.id },
            data: { pipelineStatus: PIPELINE_STATUS.CERRADO_GANADO }
          });
        }
      } catch (e) {
        console.error("Error updating BusinessLead status to Cerrado Ganado:", e);
      }
    }
  }
};

// models/Tech/Proposal/TechProposal.ts
var statusOptions2 = Object.entries(PROPOSAL_STATUS).map(([k, v]) => ({
  label: v,
  value: v
}));
var TechProposal_default = (0, import_core41.list)({
  access: proposalAccess,
  hooks: proposalHooks,
  ui: {
    listView: {
      initialColumns: ["sentDate", "amount", "status", "businessLead"]
    }
  },
  fields: {
    sentDate: (0, import_fields41.calendarDay)({
      validation: { isRequired: true },
      ui: { description: "Fecha env\xEDo" }
    }),
    amount: (0, import_fields41.float)({ ui: { description: "Monto" } }),
    status: (0, import_fields41.select)({
      type: "string",
      options: statusOptions2,
      defaultValue: PROPOSAL_STATUS.ENVIADA,
      isIndexed: true
    }),
    fileOrUrl: (0, import_fields41.text)({
      ui: { description: "URL o referencia al archivo de la propuesta" }
    }),
    approved: (0, import_fields41.checkbox)({
      defaultValue: false,
      ui: { description: "Aprobado por administrador" }
    }),
    paid: (0, import_fields41.checkbox)({
      defaultValue: false,
      ui: { description: "Pagado" }
    }),
    product: (0, import_fields41.text)({
      ui: { description: "Producto o servicio principal cotizado" }
    }),
    notes: (0, import_fields41.text)({
      ui: {
        displayMode: "textarea",
        description: "Notas adicionales o condiciones de la propuesta"
      }
    }),
    businessLead: (0, import_fields41.relationship)({
      ref: "TechBusinessLead.proposals",
      many: false
    }),
    assignedSeller: (0, import_fields41.relationship)({
      ref: "User.proposals",
      many: false
    }),
    createdBy: (0, import_fields41.relationship)({
      ref: "User.createdByProposals",
      many: false
    }),
    workspace: (0, import_fields41.relationship)({
      ref: "SaasWorkspace.proposals",
      many: false,
      ui: { description: "Workspace a la que pertenece la propuesta" }
    }),
    statusCrm: (0, import_fields41.relationship)({
      ref: "SaasWorkspaceCrmStatus.proposals",
      many: false,
      ui: { description: "Estado CRM din\xE1mico (workspace + tipo propuesta)" }
    }),
    project: (0, import_fields41.relationship)({
      ref: "SaasProject.proposal",
      many: false,
      ui: { description: "Proyecto creado a partir de esta propuesta" }
    }),
    hiddenInWorkspace: (0, import_fields41.checkbox)({
      defaultValue: false,
      ui: { description: "Ocultar en el workspace" }
    }),
    createdAt: (0, import_fields41.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields41.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Tech/SalesActivity/TechSalesActivity.ts
var import_core42 = require("@keystone-6/core");
var import_fields42 = require("@keystone-6/core/fields");

// models/Tech/SalesActivity/TechSalesActivity.access.ts
var getCompanyId4 = (session2) => session2?.data?.company?.id;
var salesActivityAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId4(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" }),
    update: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" }),
    delete: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "assignedSeller" })
  }
};

// models/Tech/SalesActivity/TechSalesActivity.hooks.ts
var salesActivityHooks = {
  validateInput: async ({
    context,
    resolvedData,
    item,
    addValidationError
  }) => {
    await validateTechStatusCrmInput({
      context,
      resolvedData,
      item,
      listKey: "TechSalesActivity",
      addValidationError
    });
  }
};

// models/Tech/SalesActivity/TechSalesActivity.ts
var activityTypeOptions = Object.entries(SALES_ACTIVITY_TYPE).map(
  ([k, v]) => ({
    label: v,
    value: v
  })
);
var priorityOptions2 = Object.entries(TASK_PRIORITY).map(([k, v]) => ({
  label: v,
  value: v
}));
var TechSalesActivity_default = (0, import_core42.list)({
  access: salesActivityAccess,
  hooks: salesActivityHooks,
  ui: {
    listView: {
      initialColumns: [
        "type",
        "activityDate",
        "dueDate",
        "priority",
        "result",
        "businessLead",
        "responsible"
      ]
    }
  },
  fields: {
    title: (0, import_fields42.text)({
      ui: { description: "T\xEDtulo de la actividad" }
    }),
    type: (0, import_fields42.select)({
      type: "string",
      options: activityTypeOptions,
      validation: { isRequired: true },
      isIndexed: true
    }),
    activityDate: (0, import_fields42.timestamp)({
      defaultValue: { kind: "now" },
      validation: { isRequired: true }
    }),
    dueDate: (0, import_fields42.calendarDay)({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "Deadline for this activity" }
    }),
    priority: (0, import_fields42.select)({
      type: "string",
      options: priorityOptions2,
      defaultValue: TASK_PRIORITY.MEDIA
    }),
    result: (0, import_fields42.text)({ ui: { description: "Resultado de la interacci\xF3n" } }),
    comments: (0, import_fields42.text)({ ui: { displayMode: "textarea" } }),
    businessLead: (0, import_fields42.relationship)({
      ref: "TechBusinessLead.activities",
      many: false
    }),
    assignedSeller: (0, import_fields42.relationship)({
      ref: "User.salesActivities",
      many: false
    }),
    createdBy: (0, import_fields42.relationship)({
      ref: "User.createdBySalesActivities",
      many: false
    }),
    workspace: (0, import_fields42.relationship)({
      ref: "SaasWorkspace.salesActivities",
      many: false,
      ui: { description: "Workspace a la que pertenece la actividad" }
    }),
    statusCrm: (0, import_fields42.relationship)({
      ref: "SaasWorkspaceCrmStatus.salesActivities",
      many: false,
      ui: { description: "Estado CRM din\xE1mico (workspace + tipo actividad)" }
    }),
    hiddenInWorkspace: (0, import_fields42.checkbox)({
      defaultValue: false,
      ui: { description: "Ocultar en el workspace" }
    }),
    createdAt: (0, import_fields42.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Tech/Task/TechTask.ts
var import_core43 = require("@keystone-6/core");
var import_fields43 = require("@keystone-6/core/fields");

// models/Tech/Task/TechTask.access.ts
var getCompanyId5 = (session2) => session2?.data?.company?.id;
var techTaskAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId5(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "responsible" }),
    update: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "responsible" }),
    delete: ({ session: session2 }) => crmWorkspaceScopedWhere(session2, { assigneeField: "responsible" })
  }
};

// models/Tech/Task/TechTask.hooks.ts
var techTaskHooks = {
  validateInput: async ({
    context,
    resolvedData,
    item,
    addValidationError
  }) => {
    await validateTechStatusCrmInput({
      context,
      resolvedData,
      item,
      listKey: "TechTask",
      addValidationError
    });
  }
};

// models/Tech/Task/TechTask.ts
var priorityOptions3 = Object.entries(TASK_PRIORITY).map(([k, v]) => ({
  label: v,
  value: v
}));
var TechTask_default = (0, import_core43.list)({
  access: techTaskAccess,
  hooks: techTaskHooks,
  ui: {
    listView: {
      initialColumns: [
        "type",
        "startDate",
        "dueDate",
        "priority",
        "result",
        "businessLead",
        "responsible"
      ]
    }
  },
  fields: {
    title: (0, import_fields43.text)({
      ui: { description: "T\xEDtulo de la tarea" }
    }),
    startDate: (0, import_fields43.timestamp)({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
      ui: { description: "Fecha de la tarea (programada o realizada)" }
    }),
    dueDate: (0, import_fields43.timestamp)({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "Fecha l\xEDmite de la tarea" }
    }),
    priority: (0, import_fields43.select)({
      type: "string",
      options: priorityOptions3,
      defaultValue: TASK_PRIORITY.MEDIA
    }),
    result: (0, import_fields43.text)({
      ui: { description: "Resultado o cierre de la tarea" }
    }),
    comments: (0, import_fields43.text)({ ui: { displayMode: "textarea" } }),
    businessLead: (0, import_fields43.relationship)({
      ref: "TechBusinessLead.tasks",
      many: false
    }),
    responsible: (0, import_fields43.relationship)({
      ref: "User.tasksResponsible",
      many: false
    }),
    workspace: (0, import_fields43.relationship)({
      ref: "SaasWorkspace.tasks",
      many: false,
      ui: { description: "Workspace al que pertenece esta tarea" }
    }),
    statusCrm: (0, import_fields43.relationship)({
      ref: "SaasWorkspaceCrmStatus.tasks",
      many: false,
      ui: {
        description: "Estado CRM din\xE1mico (workspace + tipo de tarea)"
      }
    }),
    createdBy: (0, import_fields43.relationship)({
      ref: "User.createdByTasks",
      many: false
    }),
    hiddenInWorkspace: (0, import_fields43.checkbox)({
      defaultValue: false,
      ui: { description: "Ocultar en el workspace" }
    }),
    createdAt: (0, import_fields43.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Tech/TechFiles/TechFiles.ts
var import_core44 = require("@keystone-6/core");
var import_fields44 = require("@keystone-6/core/fields");

// models/Tech/TechFiles/TechFiles.access.ts
var getCompanyId6 = (session2) => session2?.data?.company?.id;
var techFilesAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId6(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      const companyId = getCompanyId6(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session: session2 }) => {
      const companyId = getCompanyId6(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session: session2 }) => {
      const companyId = getCompanyId6(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Tech/TechFiles/TechFiles.ts
var CATEGORY_OPTIONS = [
  { label: "Proceso de venta", value: "purchase_process" },
  { label: "T\xE9cnica de venta", value: "sales_technique" },
  { label: "Cierres", value: "closing" },
  { label: "Speech / Guion", value: "speech_script" },
  { label: "Otro", value: "other" }
];
var TechFiles_default = (0, import_core44.list)({
  access: techFilesAccess,
  ui: {
    listView: {
      initialColumns: ["title", "category", "company", "createdAt"]
    }
  },
  fields: {
    title: (0, import_fields44.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre del archivo o recurso" }
    }),
    description: (0, import_fields44.text)({
      ui: {
        displayMode: "textarea",
        description: "Descripci\xF3n opcional del contenido"
      }
    }),
    category: (0, import_fields44.select)({
      type: "string",
      options: [...CATEGORY_OPTIONS],
      defaultValue: "otro",
      isIndexed: true,
      ui: {
        description: "Tipo de material (proceso, t\xE9cnica, cierre, speech, etc.)"
      }
    }),
    file: (0, import_fields44.file)({
      storage: "s3_tech_files",
      ui: { description: "Archivo (PDF, DOC, etc.)" }
    }),
    company: (0, import_fields44.relationship)({
      ref: "SaasCompany.techFiles",
      many: false
    }),
    createdAt: (0, import_fields44.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields44.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Tech/LeadSyncLog/TechLeadSyncLog.ts
var import_core45 = require("@keystone-6/core");
var import_fields45 = require("@keystone-6/core/fields");

// models/Tech/LeadSyncLog/TechLeadSyncLog.access.ts
var getCompanyId7 = (session2) => session2?.data?.company?.id;
var techLeadSyncLogAccess = {
  operation: {
    query: () => true,
    create: () => false,
    update: () => false,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId7(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: () => false,
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId7(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Tech/LeadSyncLog/TechLeadSyncLog.ts
var TechLeadSyncLog_default = (0, import_core45.list)({
  access: techLeadSyncLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "user",
        "success",
        "message",
        "syncedLeadsCount",
        "created",
        "alreadyInDb",
        "category"
      ]
    }
  },
  fields: {
    user: (0, import_fields45.relationship)({
      ref: "User.leadSyncLogs",
      many: false,
      ui: { description: "Usuario que ejecut\xF3 la sincronizaci\xF3n" }
    }),
    company: (0, import_fields45.relationship)({
      ref: "SaasCompany.leadSyncLogs",
      many: false,
      ui: { description: "Empresa" }
    }),
    success: (0, import_fields45.checkbox)({
      defaultValue: false,
      ui: { description: "Si la operaci\xF3n fue exitosa" }
    }),
    message: (0, import_fields45.text)({
      ui: { description: "Mensaje de resultado" }
    }),
    created: (0, import_fields45.integer)({
      defaultValue: 0,
      ui: { description: "Leads creados desde Google" }
    }),
    alreadyInDb: (0, import_fields45.integer)({
      defaultValue: 0,
      ui: { description: "Leads ya en BD asignados a la company" }
    }),
    skippedLowRating: (0, import_fields45.integer)({
      defaultValue: 0,
      ui: { description: "Leads omitidos por rating/rese\xF1as bajas" }
    }),
    syncedLeadsCount: (0, import_fields45.integer)({
      defaultValue: 0,
      ui: { description: "Total de leads asignados en esta ejecuci\xF3n" }
    }),
    syncedCount: (0, import_fields45.integer)({
      db: { isNullable: true },
      ui: { description: "Cuota usada este mes (total)" }
    }),
    leadLimit: (0, import_fields45.integer)({
      db: { isNullable: true },
      ui: { description: "L\xEDmite de leads del plan" }
    }),
    lat: (0, import_fields45.float)({
      db: { isNullable: true },
      ui: { description: "Latitud del centro de b\xFAsqueda" }
    }),
    lng: (0, import_fields45.float)({
      db: { isNullable: true },
      ui: { description: "Longitud del centro de b\xFAsqueda" }
    }),
    radius: (0, import_fields45.float)({
      db: { isNullable: true },
      ui: { description: "Radio de b\xFAsqueda (km)" }
    }),
    category: (0, import_fields45.text)({
      ui: { description: "Categor\xEDa buscada" }
    }),
    createdAt: (0, import_fields45.timestamp)({
      defaultValue: { kind: "now" },
      ui: { description: "Fecha y hora de la ejecuci\xF3n" }
    })
  }
});

// models/Saas/SaasCompany/SaasCompany.ts
var import_core46 = require("@keystone-6/core");
var import_fields46 = require("@keystone-6/core/fields");

// models/Saas/SaasCompany/SaasCompany.access.ts
var getCompanyId8 = (session2) => session2?.data?.company?.id;
var saasCompanyAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]),
    update: () => true,
    delete: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */])
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId8(session2);
      if (!companyId) return false;
      return { id: { equals: companyId } };
    },
    update: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId8(session2);
      if (!companyId) return false;
      return { id: { equals: companyId } };
    },
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      return false;
    }
  }
};

// models/Saas/SaasCompanySubscription/constants.ts
var SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  UNPAID: "unpaid",
  TRIALING: "trialing"
};
var SUBSCRIPTION_STATUS_OPTIONS = [
  { label: "Activa", value: SUBSCRIPTION_STATUS.ACTIVE },
  { label: "Vencida", value: SUBSCRIPTION_STATUS.PAST_DUE },
  { label: "Cancelada", value: SUBSCRIPTION_STATUS.CANCELLED },
  { label: "No pagada", value: SUBSCRIPTION_STATUS.UNPAID },
  { label: "En prueba", value: SUBSCRIPTION_STATUS.TRIALING }
];

// models/Saas/SaasCompany/SaasCompany.hooks.ts
var saasCompanySubscriptionHook = {
  afterOperation: async ({ operation, item, context }) => {
    if (operation !== "create" || !item?.id) return;
    try {
      const session2 = context.session;
      const createdByUserId = session2?.data?.id;
      if (createdByUserId) {
        const [adminCompanyRole] = await context.sudo().query.Role.findMany({
          where: { name: { equals: "admin_company" /* ADMIN_COMPANY */ } },
          take: 1,
          query: "id"
        });
        if (adminCompanyRole) {
          const user = await context.sudo().query.User.findOne({
            where: { id: createdByUserId },
            query: "id roles { id }"
          });
          const alreadyHasRole = user?.roles?.some((r) => r.id === adminCompanyRole.id);
          if (!alreadyHasRole) {
            await context.sudo().query.User.updateOne({
              where: { id: createdByUserId },
              data: { roles: { connect: { id: adminCompanyRole.id } } }
            });
          }
        }
      }
      await context.sudo().query.SaasWorkspace.createOne({
        data: {
          name: "Ventas",
          company: { connect: { id: item.id } },
          ...createdByUserId && {
            members: { connect: [{ id: createdByUserId }] }
          }
        }
      });
      const [freePlan] = await context.sudo().query.SaasPlan.findMany({
        where: { cost: { equals: 0 } },
        take: 1,
        query: "id name cost frequency leadLimit stripePriceId currency planFeatures"
      });
      if (!freePlan) {
        console.warn(
          "SaasCompany created but no free plan (cost=0) found; skipping subscription."
        );
        return;
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const trialDaysFromNow = /* @__PURE__ */ new Date();
      trialDaysFromNow.setDate(trialDaysFromNow.getDate() + TRIAL_DAYS_FREE_PLAN);
      const periodEnd = trialDaysFromNow.toISOString().slice(0, 10);
      await context.sudo().query.SaasCompanySubscription.createOne({
        data: {
          company: { connect: { id: item.id } },
          planName: freePlan.name,
          planCost: freePlan.cost,
          planFrequency: freePlan.frequency,
          planLeadLimit: freePlan.leadLimit,
          planStripePriceId: freePlan.stripePriceId ?? void 0,
          planCurrency: freePlan.currency ?? "mxn",
          planFeatures: freePlan.planFeatures ?? void 0,
          status: SUBSCRIPTION_STATUS.TRIALING,
          activatedAt: today,
          currentPeriodEnd: periodEnd
        }
      });
      await context.sudo().query.SaasCompany.updateOne({
        where: { id: item.id },
        data: {
          plan: { connect: { id: freePlan.id } },
          subscriptionStartedAt: today
        }
      });
    } catch (error) {
      console.error("Error creating free subscription for SaasCompany:", error);
    }
  }
};

// models/Saas/SaasCompany/SaasCompany.ts
var SaasCompany_default = (0, import_core46.list)({
  access: saasCompanyAccess,
  hooks: {
    afterOperation: saasCompanySubscriptionHook.afterOperation
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "plan",
        "subscriptions",
        "allowedGooglePlaceCategories",
        "subscriptionStartedAt",
        "users"
      ]
    }
  },
  fields: {
    /** Company / organization name */
    name: (0, import_fields46.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Company or organization name" }
    }),
    /** Users belonging to this company (1 company : N users) */
    users: (0, import_fields46.relationship)({
      ref: "User.company",
      many: true,
      ui: { description: "Users belonging to this company" }
    }),
    workspaces: (0, import_fields46.relationship)({
      ref: "SaasWorkspace.company",
      many: true,
      ui: { description: "Espacios de trabajo (\xE1reas) de la empresa" }
    }),
    allowedGooglePlaceCategories: (0, import_fields46.json)({
      ui: {
        description: 'Allowed categories for lead sync. JSON array of category values from GOOGLE_PLACE_CATEGORIES (e.g. ["restaurantes", "cafeter\xEDas"]). Empty or null = all allowed.'
      }
    }),
    leads: (0, import_fields46.relationship)({
      ref: "TechBusinessLead.saasCompany",
      many: true,
      ui: { description: "Leads belonging to this company" }
    }),
    /** Current plan (e.g. Free, Starter). Updated when a new subscription is created. */
    plan: (0, import_fields46.relationship)({
      ref: "SaasPlan.companies",
      many: false,
      ui: { description: "Current plan for this company" }
    }),
    /** Date when the company started its first subscription (e.g. free trial). */
    subscriptionStartedAt: (0, import_fields46.calendarDay)({
      db: { isNullable: true },
      ui: { description: "Date when the first subscription started" }
    }),
    /** Paid subscriptions (each record has a snapshot of the plan at contract time, no relation to SaasPlan) */
    subscriptions: (0, import_fields46.relationship)({
      ref: "SaasCompanySubscription.company",
      many: true,
      ui: {
        description: "Subscription history; plan data is stored as snapshot per record"
      }
    }),
    techStatusBusinessLeads: (0, import_fields46.relationship)({
      ref: "TechStatusBusinessLead.saasCompany",
      many: true,
      ui: { description: "Estados de los leads pertenecientes a esta company" }
    }),
    /** Monthly lead sync usage records (count of leads synced per month) */
    monthlyLeadSyncRecords: (0, import_fields46.relationship)({
      ref: "SaasCompanyMonthlyLeadSync.company",
      many: true,
      ui: { description: "Per-month lead sync usage (for quota enforcement)" }
    }),
    techFiles: (0, import_fields46.relationship)({
      ref: "TechFile.company",
      many: true,
      ui: { description: "Archivos y materiales para el equipo de ventas" }
    }),
    projects: (0, import_fields46.relationship)({
      ref: "SaasProject.company",
      many: true,
      ui: { description: "Proyectos o servicios de la empresa" }
    }),
    leadSyncLogs: (0, import_fields46.relationship)({
      ref: "TechLeadSyncLog.company",
      many: true,
      ui: { description: "Logs de sincronizaci\xF3n de leads" }
    }),
    saasSubscriptionLogs: (0, import_fields46.relationship)({
      ref: "SaasSubscriptionLog.company",
      many: true,
      ui: { description: "Logs de intentos de contrataci\xF3n de plan" }
    }),
    quotations: (0, import_fields46.relationship)({
      ref: "SaasQuotation.company",
      many: true,
      ui: { description: "Cotizaciones de la empresa" }
    }),
    logo: (0, import_fields46.file)({
      storage: "s3_company_logo",
      ui: { description: "Logo de la empresa" }
    }),
    onboardingMainOffer: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: 'Pregunta de oro 1 \u2014 El "Qu\xE9": \xBFEn una o dos oraciones, qu\xE9 servicio o producto principal vendes?'
      }
    }),
    onboardingIdealCustomer: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: 'Pregunta de oro 2 \u2014 El "Qui\xE9n": \xBFQui\xE9n es el cliente que m\xE1s te compra o con el que prefieres trabajar? (ej. cl\xEDnicas dentales, constructoras).'
      }
    }),
    onboardingAvgTicketValue: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: 'Pregunta de oro 3 \u2014 El "Cu\xE1nto": \xBFCu\xE1l es el precio promedio de tu servicio, o cu\xE1nto dinero le haces ganar o ahorrar a tus clientes?'
      }
    }),
    onboardingSalesPain: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: 'Pregunta de oro 4 \u2014 El "C\xF3mo": \xBFC\xF3mo consigues clientes hoy y qu\xE9 es lo que m\xE1s te cuesta al vender?'
      }
    }),
    termsQuotation: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "T\xE9rminos y condiciones de la cotizaci\xF3n"
      }
    }),
    colorPrimary: (0, import_fields46.text)({
      db: { isNullable: true },
      defaultValue: "#F7945E",
      ui: {
        description: "Color primario de la empresa"
      }
    }),
    colorSecondary: (0, import_fields46.text)({
      db: { isNullable: true },
      defaultValue: "#E07C3A",
      ui: {
        description: "Color secundario de la empresa"
      }
    }),
    contactEmail: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        description: "Correo electr\xF3nico de contacto de la empresa"
      }
    }),
    contactPhone: (0, import_fields46.text)({
      db: { isNullable: true },
      ui: {
        description: "Tel\xE9fono de contacto de la empresa"
      }
    }),
    createdAt: (0, import_fields46.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields46.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/SaasPlan/SaasPlan.ts
var import_core47 = require("@keystone-6/core");
var import_fields47 = require("@keystone-6/core/fields");

// models/Saas/SaasPlan/SaasPlan.access.ts
var saasPlanAccess = {
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

// models/Saas/SaasPlan/constants.ts
var PLAN_FREQUENCY = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  ANNUAL: "annual"
};
var PLAN_FREQUENCY_OPTIONS = [
  { label: "Weekly", value: PLAN_FREQUENCY.WEEKLY },
  { label: "Monthly", value: PLAN_FREQUENCY.MONTHLY },
  { label: "Annual", value: PLAN_FREQUENCY.ANNUAL }
];

// models/Saas/SaasPlan/SaasPlan.ts
var SaasPlan_default = (0, import_core47.list)({
  access: saasPlanAccess,
  ui: {
    listView: {
      initialColumns: [
        "name",
        "cost",
        "frequency",
        "leadLimit",
        "planFeatures",
        "active",
        "stripePriceId",
        "companies"
      ]
    }
  },
  fields: {
    /** Plan display name */
    name: (0, import_fields47.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Plan name (e.g. Starter, Pro, Enterprise)" }
    }),
    /** Price amount (in plan currency) */
    cost: (0, import_fields47.float)({
      ui: { description: "Plan cost per billing period" }
    }),
    /** Referral commission percentage for upfront payment (e.g. 20 = 20%) */
    referralUpfrontCommissionPct: (0, import_fields47.float)({
      ui: {
        description: "Referral upfront commission percentage (e.g. 20 = 20% of first payment)"
      }
    }),
    /** Referral commission percentage for recurring payments (e.g. 10 = 10%) */
    referralRecurringCommissionPct: (0, import_fields47.float)({
      ui: {
        description: "Referral recurring commission percentage per billing period (e.g. 10 = 10%)"
      }
    }),
    /** Billing frequency: weekly, monthly, or annual */
    frequency: (0, import_fields47.select)({
      type: "string",
      options: [...PLAN_FREQUENCY_OPTIONS],
      ui: { description: "Billing frequency (weekly, monthly, annual)" }
    }),
    /** ISO 4217 currency code for Stripe (e.g. mxn, usd) */
    currency: (0, import_fields47.text)({
      defaultValue: "mxn",
      ui: { description: "Stripe currency code (e.g. mxn, usd)" }
    }),
    leadLimit: (0, import_fields47.integer)({
      ui: {
        description: "Max leads that can be synced per month for this plan"
      }
    }),
    /**
     * Plan features: what this plan offers. JSON array of { key, name, description? }.
     * key: used in code to enable/check feature (e.g. "lead_sync", "reports", "api_access").
     * name: display name. description: optional.
     * Copied to SaasCompanySubscription.planFeatures when subscribing.
     */
    planFeatures: (0, import_fields47.json)({
      ui: {
        description: 'Features included in this plan. Array of { "key": "lead_sync", "name": "Lead sync", "description": "Optional" }. Key is used to enable features in the app.'
      }
    }),
    /** Payments associated with this plan */
    saasPayments: (0, import_fields47.relationship)({
      ref: "SaasPayment.plan",
      many: true,
      ui: { description: "Payments for this plan" }
    }),
    /** Shown in app and available for new signups */
    active: (0, import_fields47.checkbox)({
      defaultValue: true,
      ui: { description: "Plan enabled in app (visible for new signups)" }
    }),
    bestSeller: (0, import_fields47.checkbox)({
      defaultValue: false,
      ui: { description: "Plan best seller" }
    }),
    /** Stripe Price ID (e.g. price_xxx). Required to create subscriptions. */
    stripePriceId: (0, import_fields47.text)({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        description: "Stripe Price ID (from Stripe Dashboard or API when creating Price)"
      }
    }),
    /** Stripe Product ID (e.g. prod_xxx). Product that contains this price. */
    stripeProductId: (0, import_fields47.text)({
      db: { isNullable: true },
      ui: {
        description: "Stripe Product ID (optional, from Stripe when creating Product)"
      }
    }),
    /** Companies currently on this plan */
    companies: (0, import_fields47.relationship)({
      ref: "SaasCompany.plan",
      many: true,
      ui: { description: "Companies on this plan" }
    }),
    subscriptions: (0, import_fields47.relationship)({
      ref: "SaasCompanySubscription.plan",
      many: true,
      ui: { description: "Subscriptions for this plan" }
    }),
    saasSubscriptionLogs: (0, import_fields47.relationship)({
      ref: "SaasSubscriptionLog.plan",
      many: true,
      ui: { description: "Logs de intentos de suscripci\xF3n a este plan" }
    }),
    createdAt: (0, import_fields47.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields47.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/SaasCompanyMonthlyLeadSync/SaasCompanyMonthlyLeadSync.ts
var import_core48 = require("@keystone-6/core");
var import_fields48 = require("@keystone-6/core/fields");

// models/Saas/SaasCompanyMonthlyLeadSync/SaasCompanyMonthlyLeadSync.access.ts
var getCompanyId9 = (session2) => session2?.data?.company?.id;
var saasCompanyMonthlyLeadSyncAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]) || !!getCompanyId9(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId9(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId9(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId9(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Saas/SaasCompanyMonthlyLeadSync/SaasCompanyMonthlyLeadSync.ts
var SaasCompanyMonthlyLeadSync_default = (0, import_core48.list)({
  access: saasCompanyMonthlyLeadSyncAccess,
  ui: {
    listView: {
      initialColumns: ["company", "year", "month", "syncedCount"]
    }
  },
  fields: {
    company: (0, import_fields48.relationship)({
      ref: "SaasCompany.monthlyLeadSyncRecords",
      many: false
    }),
    year: (0, import_fields48.integer)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Year of the sync period" }
    }),
    month: (0, import_fields48.integer)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Month of the sync period (1-12)" }
    }),
    /** Number of leads synced in this month for this company (used vs plan leadLimit) */
    syncedCount: (0, import_fields48.integer)({
      defaultValue: 0,
      ui: { description: "Number of leads synced this month (for quota tracking)" }
    }),
    createdAt: (0, import_fields48.timestamp)({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } }
    }),
    updatedAt: (0, import_fields48.timestamp)({
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } }
    })
  }
});

// models/Saas/SaasCompanySubscription/SaasCompanySubscription.ts
var import_core49 = require("@keystone-6/core");
var import_fields49 = require("@keystone-6/core/fields");

// models/Saas/SaasCompanySubscription/SaasCompanySubscription.access.ts
var getCompanyId10 = (session2) => session2?.data?.company?.id;
var saasCompanySubscriptionAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]) || !!getCompanyId10(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId10(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId10(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId10(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Saas/SaasCompanySubscription/SaasCompanySubscription.ts
var SaasCompanySubscription_default = (0, import_core49.list)({
  access: saasCompanySubscriptionAccess,
  ui: {
    listView: {
      initialColumns: [
        "company",
        "planName",
        "planCost",
        "planLeadLimit",
        "planFeatures",
        "status",
        "activatedAt",
        "stripeSubscriptionId"
      ]
    }
  },
  fields: {
    /** Company that owns this subscription */
    company: (0, import_fields49.relationship)({
      ref: "SaasCompany.subscriptions",
      many: false,
      ui: { description: "Company that paid for this subscription" }
    }),
    /** Snapshot: plan name at time of contract (no relation to SaasPlan) */
    planName: (0, import_fields49.text)({
      ui: { description: "Plan name as contracted (snapshot)" }
    }),
    /** Snapshot: plan cost at time of contract */
    planCost: (0, import_fields49.float)({
      ui: { description: "Plan cost as contracted (snapshot)" }
    }),
    /** Snapshot: billing frequency (weekly, monthly, annual) */
    planFrequency: (0, import_fields49.text)({
      ui: { description: "Plan frequency as contracted (snapshot)" }
    }),
    /** Snapshot: lead limit at time of contract */
    planLeadLimit: (0, import_fields49.integer)({
      ui: { description: "Lead limit as contracted (snapshot)" }
    }),
    /** Snapshot: Stripe Price ID at time of contract */
    planStripePriceId: (0, import_fields49.text)({
      ui: { description: "Stripe Price ID as contracted (snapshot)" }
    }),
    /** Snapshot: currency at time of contract */
    planCurrency: (0, import_fields49.text)({
      ui: { description: "Currency as contracted (snapshot, e.g. mxn)" }
    }),
    planFeatures: (0, import_fields49.json)({
      ui: {
        description: "Features included in this subscription (snapshot from plan at contract time). Check subscription.planFeatures for enabled features."
      }
    }),
    /** Subscription status (e.g. active, cancelled). Use query subscriptionStatus to verify against Stripe and get activeInStripe. */
    status: (0, import_fields49.select)({
      type: "string",
      options: [...SUBSCRIPTION_STATUS_OPTIONS],
      defaultValue: "active",
      ui: { description: "Current subscription status" }
    }),
    /** Date when the subscription was activated */
    activatedAt: (0, import_fields49.calendarDay)({
      ui: { description: "Date when the subscription was activated" }
    }),
    /** End of current billing period (Stripe current_period_end) */
    currentPeriodEnd: (0, import_fields49.calendarDay)({
      ui: { description: "End of current billing period" }
    }),
    /** Stripe Subscription ID (e.g. sub_xxx) */
    stripeSubscriptionId: (0, import_fields49.text)({
      db: { isNullable: true },
      ui: { description: "Stripe Subscription ID" }
    }),
    /** Stripe Customer ID if needed (e.g. cus_xxx) */
    stripeCustomerId: (0, import_fields49.text)({
      db: { isNullable: true },
      ui: { description: "Stripe Customer ID" }
    }),
    /** Payments associated with this subscription */
    saasPayments: (0, import_fields49.relationship)({
      ref: "SaasPayment.subscription",
      many: true,
      ui: { description: "Payments for this subscription" }
    }),
    /** Subscription plan for this company */
    plan: (0, import_fields49.relationship)({
      ref: "SaasPlan.subscriptions",
      many: false,
      ui: {
        description: "Subscription plan (defines cost, frequency, lead limit)"
      }
    }),
    saasSubscriptionLogs: (0, import_fields49.relationship)({
      ref: "SaasSubscriptionLog.createdSubscription",
      many: true,
      ui: { description: "Logs de creaci\xF3n que generaron o referencian esta suscripci\xF3n" }
    }),
    createdAt: (0, import_fields49.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields49.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/SaasPaymentMethod/SaasPaymentMethod.ts
var import_core50 = require("@keystone-6/core");
var import_fields50 = require("@keystone-6/core/fields");

// models/Saas/SaasPaymentMethod/SaasPaymentMethod.access.ts
var getCompanyId11 = (session2) => session2?.data?.company?.id;
var getUserId2 = (session2) => session2?.data?.id;
function paymentMethodFilter(session2) {
  if (hasRole(session2, ["admin" /* ADMIN */])) {
    return true;
  }
  const userId = getUserId2(session2);
  if (!userId) return false;
  const companyId = getCompanyId11(session2);
  if (companyId) {
    return { user: { company: { id: { equals: companyId } } } };
  }
  return { user: { id: { equals: userId } } };
}
var saasPaymentMethodAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]) || !!getUserId2(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => paymentMethodFilter(session2),
    update: ({ session: session2 }) => paymentMethodFilter(session2),
    delete: ({ session: session2 }) => paymentMethodFilter(session2)
  }
};

// models/Saas/SaasPaymentMethod/SaasPaymentMethod.ts
var SaasPaymentMethod_default = (0, import_core50.list)({
  access: saasPaymentMethodAccess,
  ui: {
    listView: {
      initialColumns: [
        "ownerName",
        "cardType",
        "lastFourDigits",
        "stripePaymentMethodId",
        "country"
      ]
    }
  },
  fields: {
    /** User that owns this payment method */
    user: (0, import_fields50.relationship)({
      ref: "User.saasPaymentMethods",
      many: false,
      ui: { description: "User who owns this card" }
    }),
    /** Card type (e.g. card) */
    cardType: (0, import_fields50.text)({
      ui: { description: "Payment method type from Stripe (e.g. card)" }
    }),
    /** Last 4 digits of the card */
    lastFourDigits: (0, import_fields50.text)({
      ui: { description: "Last 4 digits of the card" }
    }),
    expMonth: (0, import_fields50.text)({
      ui: { description: "Expiration month (1-12)" }
    }),
    expYear: (0, import_fields50.text)({
      ui: { description: "Expiration year" }
    }),
    /** Processor identifier (e.g. stripe), placeholder allowed */
    stripeProcessorId: (0, import_fields50.text)({
      ui: { description: "Payment processor ID (e.g. stripe)" }
    }),
    /** Stripe PaymentMethod ID (pm_xxx) */
    stripePaymentMethodId: (0, import_fields50.text)({
      isIndexed: "unique",
      ui: { description: "Stripe PaymentMethod ID" }
    }),
    address: (0, import_fields50.text)({
      db: { isNullable: true },
      ui: { description: "Billing address" }
    }),
    postalCode: (0, import_fields50.text)({
      db: { isNullable: true },
      ui: { description: "Postal / ZIP code" }
    }),
    ownerName: (0, import_fields50.text)({
      ui: { description: "Cardholder name" }
    }),
    /** Two-letter country code (e.g. US, MX) */
    country: (0, import_fields50.text)({
      db: { isNullable: true },
      ui: { description: "Country code from card" }
    }),
    /** Payments made with this payment method */
    saasPayments: (0, import_fields50.relationship)({
      ref: "SaasPayment.paymentMethod",
      many: true,
      ui: { description: "Payments that used this card" }
    }),
    createdAt: (0, import_fields50.timestamp)({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } }
    }),
    updatedAt: (0, import_fields50.timestamp)({
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } }
    })
  }
});

// models/Saas/SaasPayment/SaasPayment.ts
var import_core51 = require("@keystone-6/core");
var import_fields51 = require("@keystone-6/core/fields");

// models/Saas/SaasPayment/SaasPayment.access.ts
var getCompanyId12 = (session2) => session2?.data?.company?.id;
var getUserId3 = (session2) => session2?.data?.id;
function paymentFilter(session2) {
  if (hasRole(session2, ["admin" /* ADMIN */])) {
    return true;
  }
  const userId = getUserId3(session2);
  if (!userId) return false;
  const companyId = getCompanyId12(session2);
  if (companyId) {
    return { user: { company: { id: { equals: companyId } } } };
  }
  return { user: { id: { equals: userId } } };
}
var saasPaymentAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]) || !!getUserId3(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => paymentFilter(session2),
    update: ({ session: session2 }) => paymentFilter(session2),
    delete: ({ session: session2 }) => paymentFilter(session2)
  }
};

// models/Saas/SaasPayment/SaasPayment.ts
var SaasPayment_default = (0, import_core51.list)({
  access: saasPaymentAccess,
  ui: {
    listView: {
      initialColumns: [
        "user",
        "amount",
        "status",
        "paymentMethodType",
        "processorStripeChargeId",
        "plan",
        "subscription",
        "createdAt"
      ]
    }
  },
  fields: {
    /** User who made the payment */
    user: (0, import_fields51.relationship)({
      ref: "User.saasPayments",
      many: false,
      ui: { description: "User who made this payment" }
    }),
    /** When no linked SaasPaymentMethod (e.g. failed attempt), store type as string (e.g. 'card') */
    paymentMethodType: (0, import_fields51.text)({
      db: { isNullable: true },
      ui: {
        description: "Payment method type when no card is linked (e.g. 'card' for failed attempts)"
      }
    }),
    /** Saved payment method used (when payment succeeded and we have a method id) */
    paymentMethod: (0, import_fields51.relationship)({
      ref: "SaasPaymentMethod.saasPayments",
      many: false,
      ui: { description: "Saved payment method used for this payment" }
    }),
    amount: (0, import_fields51.decimal)({
      scale: 6,
      defaultValue: "0",
      ui: { description: "Amount charged (e.g. in cents or unit currency)" }
    }),
    status: (0, import_fields51.select)({
      type: "string",
      options: [
        { label: "Pendiente", value: "pending" },
        { label: "Procesando", value: "processing" },
        { label: "Exitoso", value: "succeeded" },
        { label: "Cancelado", value: "cancelled" },
        { label: "Fallido", value: "failed" },
        { label: "Devuelto", value: "refunded" }
      ],
      defaultValue: "pending",
      ui: { description: "Payment status" }
    }),
    processorStripeChargeId: (0, import_fields51.text)({
      defaultValue: "",
      ui: { description: "Stripe PaymentIntent or Charge ID" }
    }),
    stripeErrorMessage: (0, import_fields51.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Stripe error message (e.g. when status is failed)"
      }
    }),
    notes: (0, import_fields51.text)({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Optional notes" }
    }),
    /** Plan this payment is for (optional) */
    plan: (0, import_fields51.relationship)({
      ref: "SaasPlan.saasPayments",
      many: false,
      ui: { description: "Plan this payment is associated with" }
    }),
    /** Subscription this payment is for (optional) */
    subscription: (0, import_fields51.relationship)({
      ref: "SaasCompanySubscription.saasPayments",
      many: false,
      ui: { description: "Subscription this payment is associated with" }
    }),
    createdAt: (0, import_fields51.timestamp)({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } }
    }),
    updatedAt: (0, import_fields51.timestamp)({
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } }
    })
  }
});

// models/Saas/Project/SaasProject.ts
var import_core52 = require("@keystone-6/core");
var import_fields52 = require("@keystone-6/core/fields");

// models/Saas/Project/SaasProject.access.ts
var getCompanyId13 = (session2) => session2?.data?.company?.id;
var projectAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId13(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      const companyId = getCompanyId13(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session: session2 }) => {
      const companyId = getCompanyId13(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session: session2 }) => {
      const companyId = getCompanyId13(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Saas/Project/SaasProject.constants.ts
var PROJECT_STATUS = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  EN_REVISION: "En revisi\xF3n",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado"
};
var PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS).map(
  ([, value]) => ({ label: value, value })
);

// models/Saas/Project/SaasProject.ts
var SaasProject_default = (0, import_core52.list)({
  access: projectAccess,
  ui: {
    listView: {
      initialColumns: [
        "name",
        "serviceType",
        "status",
        "responsible",
        "startDate",
        "company"
      ]
    }
  },
  fields: {
    name: (0, import_fields52.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre del proyecto" }
    }),
    serviceType: (0, import_fields52.text)({
      isIndexed: true,
      ui: {
        description: "Tipo de servicio (ej: Desarrollo web, Remodelaci\xF3n, Tratamiento, Campa\xF1a marketing)"
      }
    }),
    responsible: (0, import_fields52.relationship)({
      ref: "User.projectsResponsible",
      many: false,
      ui: { description: "Responsable del proyecto" }
    }),
    startDate: (0, import_fields52.calendarDay)({
      ui: { description: "Fecha de inicio" }
    }),
    estimatedEndDate: (0, import_fields52.calendarDay)({
      db: { isNullable: true },
      ui: { description: "Fecha estimada de fin" }
    }),
    description: (0, import_fields52.text)({
      ui: {
        displayMode: "textarea",
        description: "Descripci\xF3n del proyecto o alcance"
      }
    }),
    status: (0, import_fields52.select)({
      type: "string",
      options: PROJECT_STATUS_OPTIONS,
      defaultValue: "Pendiente",
      isIndexed: true,
      ui: { description: "Estado del proyecto" }
    }),
    urlData: (0, import_fields52.text)({
      db: { isNullable: true },
      ui: { description: "URL de la data del proyecto" }
    }),
    company: (0, import_fields52.relationship)({
      ref: "SaasCompany.projects",
      many: false,
      ui: { description: "Empresa a la que pertenece el proyecto" }
    }),
    businessLead: (0, import_fields52.relationship)({
      ref: "TechBusinessLead.projects",
      many: false,
      ui: {
        description: "Cliente o lead del que surgi\xF3 este proyecto (venta cerrada)"
      }
    }),
    proposal: (0, import_fields52.relationship)({
      ref: "TechProposal.project",
      many: false,
      ui: {
        description: "Propuesta comprada que origin\xF3 este proyecto (opcional)"
      }
    }),
    quotations: (0, import_fields52.relationship)({
      ref: "SaasQuotation.project",
      many: true,
      ui: { description: "Cotizaciones asociadas a este proyecto" }
    }),
    createdAt: (0, import_fields52.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields52.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/Quotation/SaasQuotation.ts
var import_core53 = require("@keystone-6/core");
var import_fields53 = require("@keystone-6/core/fields");

// models/Saas/Quotation/SaasQuotation.access.ts
var getCompanyId14 = (session2) => session2?.data?.company?.id;
var quotationAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId14(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      const companyId = getCompanyId14(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session: session2 }) => {
      const companyId = getCompanyId14(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session: session2 }) => {
      const companyId = getCompanyId14(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Saas/Quotation/SaasQuotation.constants.ts
var QUOTATION_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired"
};
var QUOTATION_STATUS_OPTIONS = [
  { label: "Borrador", value: QUOTATION_STATUS.DRAFT },
  { label: "Enviada", value: QUOTATION_STATUS.SENT },
  { label: "Aceptada", value: QUOTATION_STATUS.ACCEPTED },
  { label: "Rechazada", value: QUOTATION_STATUS.REJECTED },
  { label: "Expirada", value: QUOTATION_STATUS.EXPIRED }
];
var QUOTATION_DISCOUNT_TYPE = {
  NONE: "none",
  PERCENT: "percent",
  AMOUNT: "amount"
};
var QUOTATION_DISCOUNT_TYPE_OPTIONS = [
  { label: "Sin descuento", value: QUOTATION_DISCOUNT_TYPE.NONE },
  { label: "Porcentaje", value: QUOTATION_DISCOUNT_TYPE.PERCENT },
  { label: "Monto fijo", value: QUOTATION_DISCOUNT_TYPE.AMOUNT }
];

// models/Saas/Quotation/SaasQuotation.hooks.ts
async function nextQuotationNumber(context, companyId) {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const prefix = `Q-${year}-`;
  const rows = await context.sudo().query.SaasQuotation.findMany({
    where: { company: { id: { equals: companyId } } },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    query: "quotationNumber"
  });
  let max = 0;
  for (const r of rows) {
    const qn = r.quotationNumber;
    if (qn?.startsWith(prefix)) {
      const part = qn.slice(prefix.length);
      const n = parseInt(part, 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
function applyStatusTimestamps(operation, resolvedData, item) {
  if (operation === "create") {
    const status = String(resolvedData.status ?? "");
    if (status === QUOTATION_STATUS.SENT) {
      resolvedData.sentAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    if (status === QUOTATION_STATUS.ACCEPTED) {
      resolvedData.acceptedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    return;
  }
  if (operation !== "update" || !item) return;
  const previousStatus = item.status ?? void 0;
  const nextStatus = resolvedData.status !== void 0 ? String(resolvedData.status) : previousStatus;
  if (nextStatus === QUOTATION_STATUS.SENT && previousStatus !== QUOTATION_STATUS.SENT) {
    resolvedData.sentAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (nextStatus === QUOTATION_STATUS.ACCEPTED && previousStatus !== QUOTATION_STATUS.ACCEPTED) {
    resolvedData.acceptedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
}
var quotationHooks = {
  resolveInput: async ({
    operation,
    resolvedData,
    context,
    item
  }) => {
    if (operation === "create") {
      const connect = resolvedData.company;
      const companyId = connect?.connect?.id;
      if (!companyId) return resolvedData;
      if (!resolvedData.quotationNumber || String(resolvedData.quotationNumber).trim() === "") {
        resolvedData.quotationNumber = await nextQuotationNumber(context, companyId);
      }
      const session2 = context.session;
      const userId = session2?.data?.id;
      if (userId && !resolvedData.createdBy) {
        resolvedData.createdBy = { connect: { id: userId } };
      }
      if (!resolvedData.status) {
        resolvedData.status = QUOTATION_STATUS.DRAFT;
      }
    }
    applyStatusTimestamps(operation, resolvedData, item ?? null);
    return resolvedData;
  }
};

// models/Saas/Quotation/SaasQuotation.ts
var SaasQuotation_default = (0, import_core53.list)({
  access: quotationAccess,
  hooks: quotationHooks,
  ui: {
    labelField: "quotationNumber",
    listView: {
      initialColumns: [
        "quotationNumber",
        "status",
        "company",
        "total",
        "currency",
        "validUntil",
        "createdBy"
      ]
    }
  },
  fields: {
    company: (0, import_fields53.relationship)({
      ref: "SaasCompany.quotations",
      many: false,
      ui: { description: "Empresa a la que pertenece la cotizaci\xF3n" }
    }),
    lead: (0, import_fields53.relationship)({
      ref: "TechBusinessLead.quotations",
      many: false,
      ui: { description: "Lead asociado (opcional)" }
    }),
    project: (0, import_fields53.relationship)({
      ref: "SaasProject.quotations",
      many: false,
      ui: { description: "Proyecto asociado (opcional)" }
    }),
    quotationNumber: (0, import_fields53.text)({
      isIndexed: true,
      validation: { isRequired: true },
      ui: {
        description: "Consecutivo por empresa (ej. Q-2026-0012); se asigna al crear si se deja vac\xEDo"
      }
    }),
    status: (0, import_fields53.select)({
      type: "string",
      options: [...QUOTATION_STATUS_OPTIONS],
      defaultValue: QUOTATION_STATUS.DRAFT,
      isIndexed: true,
      ui: { description: "Estado de la cotizaci\xF3n" }
    }),
    currency: (0, import_fields53.text)({
      defaultValue: "MXN",
      ui: { description: "Moneda (ISO o etiqueta interna)" }
    }),
    exchangeRate: (0, import_fields53.float)({
      defaultValue: 1,
      ui: { description: "Tipo de cambio respecto a moneda base (1 = sin conversi\xF3n)" }
    }),
    subtotal: (0, import_fields53.float)({
      defaultValue: 0,
      ui: { description: "Subtotal antes de impuestos (suma de l\xEDneas netas)" }
    }),
    discountTotal: (0, import_fields53.float)({
      defaultValue: 0,
      ui: { description: "Total descuentos en l\xEDneas" }
    }),
    taxTotal: (0, import_fields53.float)({
      defaultValue: 0,
      ui: { description: "Total impuestos" }
    }),
    total: (0, import_fields53.float)({
      defaultValue: 0,
      ui: { description: "Total a pagar" }
    }),
    validUntil: (0, import_fields53.calendarDay)({
      db: { isNullable: true },
      ui: { description: "Vigencia de la cotizaci\xF3n" }
    }),
    sentAt: (0, import_fields53.timestamp)({
      db: { isNullable: true },
      ui: { description: "Fecha de env\xEDo al cliente" }
    }),
    acceptedAt: (0, import_fields53.timestamp)({
      db: { isNullable: true },
      ui: { description: "Fecha de aceptaci\xF3n" }
    }),
    notes: (0, import_fields53.text)({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Notas internas o para el cliente" }
    }),
    terms: (0, import_fields53.text)({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "T\xE9rminos y condiciones mostrados en la cotizaci\xF3n"
      }
    }),
    createdBy: (0, import_fields53.relationship)({
      ref: "User.quotationsCreated",
      many: false,
      ui: { description: "Usuario que cre\xF3 el registro" }
    }),
    assignedSeller: (0, import_fields53.relationship)({
      ref: "User.quotationsAssignedSeller",
      many: false,
      ui: { description: "Vendedor asignado" }
    }),
    pdfFileOrUrl: (0, import_fields53.text)({
      db: { isNullable: true },
      ui: { description: "URL o clave del PDF generado (opcional)" }
    }),
    quotationProducts: (0, import_fields53.relationship)({
      ref: "SaasQuotationProduct.quotation",
      many: true,
      ui: { description: "Conceptos / partidas" }
    }),
    showDiscount: (0, import_fields53.checkbox)({
      defaultValue: true,
      ui: { description: "Mostrar descuento en la cotizaci\xF3n" }
    }),
    showNotes: (0, import_fields53.checkbox)({
      defaultValue: true,
      ui: { description: "Mostrar notas en la cotizaci\xF3n" }
    }),
    createdAt: (0, import_fields53.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields53.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/Quotation/Product/SaasQuotationProduct.ts
var import_core54 = require("@keystone-6/core");
var import_fields54 = require("@keystone-6/core/fields");

// models/Saas/Quotation/Product/SaasQuotationProduct.access.ts
var getCompanyId15 = (session2) => session2?.data?.company?.id;
var quotationProductAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId15(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      const companyId = getCompanyId15(session2);
      if (!companyId) return false;
      return { quotation: { company: { id: { equals: companyId } } } };
    },
    update: ({ session: session2 }) => {
      const companyId = getCompanyId15(session2);
      if (!companyId) return false;
      return { quotation: { company: { id: { equals: companyId } } } };
    },
    delete: ({ session: session2 }) => {
      const companyId = getCompanyId15(session2);
      if (!companyId) return false;
      return { quotation: { company: { id: { equals: companyId } } } };
    }
  }
};

// models/Saas/Quotation/quotationLineMath.ts
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}
function computeLineAmounts(args) {
  const qty = args.quantity ?? 0;
  const price = args.unitPrice ?? 0;
  const gross = qty * price;
  let discount = 0;
  if (args.discountType === QUOTATION_DISCOUNT_TYPE.PERCENT) {
    discount = gross * ((args.discountValue ?? 0) / 100);
  } else if (args.discountType === QUOTATION_DISCOUNT_TYPE.AMOUNT) {
    discount = Math.min(args.discountValue ?? 0, gross);
  }
  const lineSubtotal = roundMoney(gross - discount);
  const lineTax = roundMoney(lineSubtotal * ((args.taxRate ?? 0) / 100));
  const lineTotal = roundMoney(lineSubtotal + lineTax);
  return { lineDiscount: roundMoney(discount), lineSubtotal, lineTax, lineTotal };
}

// models/Saas/Quotation/Product/SaasQuotationProduct.hooks.ts
var pendingRecalcKey = "__saasQuotationRecalcAfterDelete";
var previousQuoteRecalcKey = "__saasQuotationRecalcPreviousQuoteId";
function resolvedDataUpdatesQuote(resolvedData) {
  return !!resolvedData && Object.prototype.hasOwnProperty.call(resolvedData, "quotation");
}
function getQuoteIdFromResolved(resolvedData, item) {
  const fromConnect = resolvedData.quotation?.connect?.id;
  if (fromConnect) return fromConnect;
  if (item?.quoteId) return String(item.quoteId);
  return null;
}
async function recalculateQuotationTotals(context, quotationId) {
  const lines = await context.sudo().query.SaasQuotationProduct.findMany({
    where: { quotation: { id: { equals: quotationId } } },
    query: "quantity unitPrice discountType discountValue taxRate"
  });
  let discountTotal = 0;
  let subtotal = 0;
  let total = 0;
  for (const line of lines) {
    const amounts = computeLineAmounts({
      quantity: line.quantity ?? 0,
      unitPrice: line.unitPrice ?? 0,
      discountType: line.discountType ?? QUOTATION_DISCOUNT_TYPE.NONE,
      discountValue: line.discountValue ?? 0,
      taxRate: line.taxRate ?? 0
    });
    discountTotal += amounts.lineDiscount;
    subtotal += amounts.lineSubtotal;
    total += amounts.lineTotal;
  }
  discountTotal = roundMoney(discountTotal);
  subtotal = roundMoney(subtotal);
  const taxTotal = roundMoney(total - subtotal);
  total = roundMoney(total);
  await context.sudo().query.SaasQuotation.updateOne({
    where: { id: quotationId },
    data: {
      subtotal,
      discountTotal,
      taxTotal,
      total
    }
  });
}
var quotationProductHooks = {
  beforeOperation: async ({
    operation,
    item,
    context,
    resolvedData
  }) => {
    const ctx = context;
    if (operation === "update" && item?.id && resolvedDataUpdatesQuote(resolvedData)) {
      const row = await context.sudo().query.SaasQuotationProduct.findOne({
        where: { id: item.id },
        query: "quotation { id }"
      });
      const prev = row?.quotation?.id;
      if (prev) ctx[previousQuoteRecalcKey] = prev;
    }
    if (operation !== "delete" || !item?.id) return;
    const rowDel = await context.sudo().query.SaasQuotationProduct.findOne({
      where: { id: item.id },
      query: "quotation { id }"
    });
    const qid = rowDel?.quotation?.id;
    if (qid) {
      ctx[pendingRecalcKey] = qid;
    }
  },
  resolveInput: async ({
    operation,
    resolvedData,
    item
  }) => {
    if (operation === "delete") return resolvedData;
    const quantity = resolvedData.quantity !== void 0 ? Number(resolvedData.quantity) : item?.quantity ?? 0;
    const unitPrice = resolvedData.unitPrice !== void 0 ? Number(resolvedData.unitPrice) : item?.unitPrice ?? 0;
    const discountType = String(
      resolvedData.discountType ?? item?.discountType ?? QUOTATION_DISCOUNT_TYPE.NONE
    );
    const discountValue = resolvedData.discountValue !== void 0 ? Number(resolvedData.discountValue) : item?.discountValue ?? 0;
    const taxRate = resolvedData.taxRate !== void 0 ? Number(resolvedData.taxRate) : item?.taxRate ?? 0;
    const { lineSubtotal, lineTotal } = computeLineAmounts({
      quantity,
      unitPrice,
      discountType,
      discountValue,
      taxRate
    });
    resolvedData.lineSubtotal = lineSubtotal;
    resolvedData.lineTotal = lineTotal;
    return resolvedData;
  },
  afterOperation: async ({
    listKey,
    operation,
    item,
    context,
    resolvedData
  }) => {
    if (listKey !== "SaasQuotationProduct") return;
    if (operation !== "create" && operation !== "update" && operation !== "delete") {
      return;
    }
    let quoteId = null;
    if (operation === "delete") {
      const ctx2 = context;
      quoteId = ctx2[pendingRecalcKey] ?? null;
      delete ctx2[pendingRecalcKey];
    } else {
      quoteId = item?.quoteId ? String(item.quoteId) : null;
      if (!quoteId && resolvedData) {
        quoteId = getQuoteIdFromResolved(resolvedData, item ?? null);
      }
    }
    const ctx = context;
    const previousQuoteId = ctx[previousQuoteRecalcKey];
    delete ctx[previousQuoteRecalcKey];
    const quoteIds = /* @__PURE__ */ new Set();
    if (quoteId) quoteIds.add(quoteId);
    if (previousQuoteId && previousQuoteId !== quoteId) {
      quoteIds.add(previousQuoteId);
    }
    if (quoteIds.size === 0) return;
    try {
      for (const id of quoteIds) {
        await recalculateQuotationTotals(context, id);
      }
    } catch (e) {
      console.error("Error recalculating quotation totals:", e);
    }
  }
};

// models/Saas/Quotation/Product/SaasQuotationProduct.ts
var SaasQuotationProduct_default = (0, import_core54.list)({
  access: quotationProductAccess,
  hooks: quotationProductHooks,
  ui: {
    listView: {
      initialColumns: ["quotation", "description", "quantity", "unitPrice", "lineTotal"]
    }
  },
  fields: {
    quotation: (0, import_fields54.relationship)({
      ref: "SaasQuotation.quotationProducts",
      many: false,
      ui: { description: "Cotizaci\xF3n" }
    }),
    description: (0, import_fields54.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea",
        description: "Concepto: servicio, producto, horas, paquete, etc."
      }
    }),
    quantity: (0, import_fields54.float)({
      defaultValue: 1,
      ui: { description: "Cantidad (puede ser fracci\xF3n, ej. horas)" }
    }),
    unitPrice: (0, import_fields54.float)({
      defaultValue: 0,
      ui: { description: "Precio unitario" }
    }),
    discountType: (0, import_fields54.select)({
      type: "string",
      options: [...QUOTATION_DISCOUNT_TYPE_OPTIONS],
      defaultValue: QUOTATION_DISCOUNT_TYPE.NONE,
      ui: { description: "Tipo de descuento en la l\xEDnea" }
    }),
    discountValue: (0, import_fields54.float)({
      defaultValue: 0,
      ui: {
        description: "Descuento: porcentaje (0\u2013100) si tipo es porcentaje; monto si tipo es monto fijo"
      }
    }),
    taxRate: (0, import_fields54.float)({
      defaultValue: 0,
      ui: { description: "Tasa de impuesto en % (ej. 16 para IVA)" }
    }),
    lineSubtotal: (0, import_fields54.float)({
      defaultValue: 0,
      ui: {
        description: "Subtotal l\xEDnea sin impuesto (cantidad \xD7 precio \u2212 descuento)"
      }
    }),
    lineTotal: (0, import_fields54.float)({
      defaultValue: 0,
      ui: { description: "Total l\xEDnea con impuesto" }
    }),
    createdAt: (0, import_fields54.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields54.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/SaasReferralCommission/SaasReferralCommission.ts
var import_core55 = require("@keystone-6/core");
var import_fields55 = require("@keystone-6/core/fields");

// models/Saas/SaasReferralCommission/SaasReferralCommission.access.ts
var getCompanyId16 = (session2) => session2?.data?.company?.id;
var getUserId4 = (session2) => session2?.data?.id;
function referralCommissionFilter(session2) {
  if (hasRole(session2, ["admin" /* ADMIN */])) {
    return true;
  }
  const userId = getUserId4(session2);
  if (!userId) return false;
  const companyId = getCompanyId16(session2);
  const orClause = [
    { referrer: { id: { equals: userId } } },
    { referredUser: { id: { equals: userId } } }
  ];
  if (companyId) {
    orClause.push({ company: { id: { equals: companyId } } });
  }
  return { OR: orClause };
}
var saasReferralCommissionAccess = {
  operation: {
    query: () => true,
    /** Las comisiones las genera el backend; solo admin crea/edita desde Admin si hace falta */
    create: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */]),
    update: () => true,
    delete: ({ session: session2 }) => hasRole(session2, ["admin" /* ADMIN */])
  },
  filter: {
    query: ({ session: session2 }) => referralCommissionFilter(session2),
    update: ({ session: session2 }) => referralCommissionFilter(session2),
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      return false;
    }
  }
};

// models/Saas/SaasReferralCommission/SaasReferralCommission.ts
var SaasReferralCommission_default = (0, import_core55.list)({
  access: saasReferralCommissionAccess,
  ui: {
    listView: {
      initialColumns: [
        "referrer",
        "referredUser",
        "company",
        "subscription",
        "plan",
        "type",
        "status",
        "amount",
        "currency",
        "notes"
      ]
    }
  },
  fields: {
    referrer: (0, import_fields55.relationship)({
      ref: "User",
      ui: { description: "User who receives the commission (referrer)" }
    }),
    referredUser: (0, import_fields55.relationship)({
      ref: "User",
      ui: { description: "User who was referred and purchased the plan" }
    }),
    company: (0, import_fields55.relationship)({
      ref: "SaasCompany",
      ui: { description: "Company associated with the subscription" }
    }),
    subscription: (0, import_fields55.relationship)({
      ref: "SaasCompanySubscription",
      ui: { description: "Subscription that originated this commission" }
    }),
    plan: (0, import_fields55.relationship)({
      ref: "SaasPlan",
      ui: { description: "Plan associated with this commission" }
    }),
    type: (0, import_fields55.select)({
      type: "string",
      options: [
        { label: "Upfront", value: "UPFRONT" },
        { label: "Recurring", value: "RECURRING" }
      ],
      ui: { displayMode: "segmented-control" }
    }),
    percentage: (0, import_fields55.float)({
      ui: { description: "Percentage applied to plan cost to compute amount" }
    }),
    amount: (0, import_fields55.float)({
      ui: { description: "Commission amount (snapshot at creation time)" }
    }),
    currency: (0, import_fields55.text)({
      defaultValue: "mxn",
      ui: { description: "Currency code, e.g. mxn, usd" }
    }),
    periodIndex: (0, import_fields55.float)({
      ui: {
        description: "0 for upfront, 1..N for recurring periods (e.g. months after signup)"
      }
    }),
    periodStart: (0, import_fields55.calendarDay)({
      db: { isNullable: true },
      ui: { description: "Start date of the commission period (if applicable)" }
    }),
    periodEnd: (0, import_fields55.calendarDay)({
      db: { isNullable: true },
      ui: { description: "End date of the commission period (if applicable)" }
    }),
    status: (0, import_fields55.select)({
      type: "string",
      options: [
        { label: "Pending", value: "PENDING" },
        { label: "Earned", value: "EARNED" },
        { label: "Cancelled", value: "CANCELLED" },
        { label: "Paid", value: "PAID" }
      ],
      defaultValue: "PENDING",
      ui: { displayMode: "segmented-control" }
    }),
    notes: (0, import_fields55.text)({
      db: { isNullable: true },
      ui: { description: "Optional notes about this commission (e.g. cancellation reason)" }
    }),
    createdAt: (0, import_fields55.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields55.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" }
      }
    })
  }
});

// models/Saas/SaasSubscriptionLog/SaasSubscriptionLog.ts
var import_core56 = require("@keystone-6/core");
var import_fields56 = require("@keystone-6/core/fields");

// models/Saas/SaasSubscriptionLog/SaasSubscriptionLog.access.ts
var getCompanyId17 = (session2) => session2?.data?.company?.id;
var saasSubscriptionLogAccess = {
  operation: {
    query: () => true,
    create: () => false,
    update: () => false,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId17(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: () => false,
    delete: ({ session: session2 }) => {
      if (hasRole(session2, ["admin" /* ADMIN */])) {
        return true;
      }
      const companyId = getCompanyId17(session2);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    }
  }
};

// models/Saas/SaasSubscriptionLog/SaasSubscriptionLog.ts
var SaasSubscriptionLog_default = (0, import_core56.list)({
  access: saasSubscriptionLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "success",
        "step",
        "emailMasked",
        "company",
        "message"
      ]
    }
  },
  fields: {
    user: (0, import_fields56.relationship)({
      ref: "User.saasSubscriptionLogs",
      many: false,
      ui: { description: "Usuario que intent\xF3 contratar (si se resolvi\xF3 por email)" }
    }),
    company: (0, import_fields56.relationship)({
      ref: "SaasCompany.saasSubscriptionLogs",
      many: false,
      ui: { description: "Empresa del usuario" }
    }),
    plan: (0, import_fields56.relationship)({
      ref: "SaasPlan.saasSubscriptionLogs",
      many: false,
      ui: { description: "Plan solicitado (si se resolvi\xF3)" }
    }),
    createdSubscription: (0, import_fields56.relationship)({
      ref: "SaasCompanySubscription.saasSubscriptionLogs",
      many: false,
      ui: { description: "Registro SaasCompanySubscription creado en un intento exitoso" }
    }),
    success: (0, import_fields56.checkbox)({
      defaultValue: false,
      ui: { description: "Si la mutaci\xF3n devolvi\xF3 success: true" }
    }),
    /** Código corto para filtrar (ej. TOTAL_MISMATCH, SUCCESS) */
    step: (0, import_fields56.text)({
      isIndexed: true,
      ui: { description: "Paso / motivo (SAAS_SUBSCRIPTION_LOG_STEP)" }
    }),
    /** Mismo mensaje que recibió el cliente en GraphQL */
    message: (0, import_fields56.text)({
      ui: { displayMode: "textarea", description: "Mensaje devuelto al cliente" }
    }),
    /** Copia del payload de respuesta (success, message, subscriptionId, paymentId, extras) */
    responseSnapshot: (0, import_fields56.json)({
      ui: { description: "Snapshot del resultado devuelto al cliente" }
    }),
    emailMasked: (0, import_fields56.text)({
      ui: { description: "Email del intento (enmascarado)" }
    }),
    planIdRequested: (0, import_fields56.text)({
      ui: { description: "planId enviado en el input" }
    }),
    totalSubmitted: (0, import_fields56.text)({
      ui: { description: "total enviado por el cliente" }
    }),
    paymentMethodIdSubmitted: (0, import_fields56.text)({
      ui: { description: "ID interno del m\xE9todo de pago" }
    }),
    paymentTypeSubmitted: (0, import_fields56.text)({
      ui: { description: "paymentType del input" }
    }),
    durationMs: (0, import_fields56.integer)({
      db: { isNullable: true },
      ui: { description: "Duraci\xF3n del intento en ms" }
    }),
    stripeCustomerId: (0, import_fields56.text)({
      db: { isNullable: true },
      ui: { description: "Stripe customer id al finalizar (si aplica)" }
    }),
    stripeSubscriptionId: (0, import_fields56.text)({
      db: { isNullable: true },
      ui: { description: "Stripe subscription id al finalizar (si aplica)" }
    }),
    createdAt: (0, import_fields56.timestamp)({
      defaultValue: { kind: "now" },
      ui: { description: "Momento del intento" }
    })
  }
});

// models/Saas/SaasWorkspace/SaasWorkspace.ts
var import_core57 = require("@keystone-6/core");
var import_fields57 = require("@keystone-6/core/fields");

// models/Saas/SaasWorkspace/SaasWorkspace.access.ts
var getCompanyId18 = (session2) => session2?.data?.company?.id;
var getUserId5 = (session2) => session2?.data?.id;
function workspaceFilter(session2) {
  if (hasRole(session2, ["admin" /* ADMIN */])) {
    return true;
  }
  const companyId = getCompanyId18(session2);
  if (hasRole(session2, ["admin_company" /* ADMIN_COMPANY */])) {
    if (!companyId) return false;
    return { company: { id: { equals: companyId } } };
  }
  const userId = getUserId5(session2);
  if (!userId) return false;
  return { members: { some: { id: { equals: userId } } } };
}
var saasWorkspaceAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId18(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => workspaceFilter(session2),
    update: ({ session: session2 }) => workspaceFilter(session2),
    delete: ({ session: session2 }) => workspaceFilter(session2)
  }
};

// models/Saas/SaasWorkspace/SaasWorkspace.hooks.ts
var DEFAULT_SEED_ROWS = [
  {
    key: "TODO",
    name: "Por Hacer",
    color: "#6B7280",
    order: 1,
    isDefault: true
  },
  {
    key: "IN_PROGRESS",
    name: "En progreso",
    color: "#2563EB",
    order: 2,
    isDefault: false
  },
  {
    key: "COMPLETED",
    name: "Completado",
    color: "#22C55E",
    order: 3,
    isDefault: false
  },
  {
    key: "CANCELLED",
    name: "Cancelado",
    color: "#EF4444",
    order: 4,
    isDefault: false
  }
];
var saasWorkspaceSeedCrmStatusesHook = {
  afterOperation: async ({ operation, item, context }) => {
    if (operation !== "create" || !item?.id) return;
    const sudo = context.sudo();
    try {
      for (const row of DEFAULT_SEED_ROWS) {
        await sudo.db.SaasWorkspaceCrmStatus.createOne({
          data: {
            workspace: { connect: { id: item.id } },
            name: row.name,
            color: row.color,
            key: row.key,
            order: row.order,
            isDefault: row.isDefault,
            isArchived: false
          }
        });
      }
    } catch (e) {
      console.error(
        "Error creando estados CRM por defecto para SaasWorkspace:",
        e
      );
    }
  }
};

// models/Saas/SaasWorkspace/SaasWorkspace.ts
var SaasWorkspace_default = (0, import_core57.list)({
  access: saasWorkspaceAccess,
  hooks: {
    afterOperation: saasWorkspaceSeedCrmStatusesHook.afterOperation
  },
  ui: {
    listView: {
      initialColumns: ["name", "company", "members"]
    }
  },
  fields: {
    name: (0, import_fields57.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre del \xE1rea (ej. Recursos Humanos, Dise\xF1o)" }
    }),
    showActivities: (0, import_fields57.checkbox)({
      defaultValue: true,
      ui: { description: "Mostrar actividades de CRM en este workspace" }
    }),
    showProposals: (0, import_fields57.checkbox)({
      defaultValue: true,
      ui: { description: "Mostrar propuestas de CRM en este workspace" }
    }),
    showFollowUpTasks: (0, import_fields57.checkbox)({
      defaultValue: true,
      ui: { description: "Mostrar tareas de seguimiento de CRM en este workspace" }
    }),
    showTasks: (0, import_fields57.checkbox)({
      defaultValue: true,
      ui: { description: "Mostrar tareas de workspace en este workspace" }
    }),
    company: (0, import_fields57.relationship)({
      ref: "SaasCompany.workspaces",
      many: false,
      ui: { description: "Empresa (tenant) a la que pertenece" }
    }),
    members: (0, import_fields57.relationship)({
      ref: "User.workspaces",
      many: true,
      ui: { description: "Usuarios con acceso a este workspace" }
    }),
    salesActivities: (0, import_fields57.relationship)({
      ref: "TechSalesActivity.workspace",
      many: true,
      ui: { hideCreate: true, description: "Actividades de CRM" }
    }),
    tasks: (0, import_fields57.relationship)({
      ref: "TechTask.workspace",
      many: true,
      ui: { hideCreate: true, description: "Tareas de workspace (CRM)" }
    }),
    proposals: (0, import_fields57.relationship)({
      ref: "TechProposal.workspace",
      many: true,
      ui: { hideCreate: true, description: "Propuestas de CRM" }
    }),
    followUpTasks: (0, import_fields57.relationship)({
      ref: "TechFollowUpTask.workspace",
      many: true,
      ui: { hideCreate: true, description: "Tareas de seguimiento de CRM" }
    }),
    crmStatuses: (0, import_fields57.relationship)({
      ref: "SaasWorkspaceCrmStatus.workspace",
      many: true,
      ui: { hideCreate: true, description: "Estados CRM din\xE1micos por tipo" }
    })
  }
});

// models/Saas/SaasWorkspaceCrmStatus/SaasWorkspaceCrmStatus.ts
var import_core58 = require("@keystone-6/core");
var import_fields58 = require("@keystone-6/core/fields");

// models/Saas/SaasWorkspaceCrmStatus/SaasWorkspaceCrmStatus.access.ts
var getCompanyId19 = (session2) => session2?.data?.company?.id;
var getUserId6 = (session2) => session2?.data?.id;
var companyWorkspaceFilter = (companyId) => ({
  workspace: { company: { id: { equals: companyId } } }
});
var memberWorkspaceFilter = (userId) => ({
  workspace: { members: { some: { id: { equals: userId } } } }
});
function workspaceCrmStatusFilter(session2) {
  if (hasRole(session2, ["admin" /* ADMIN */])) {
    return true;
  }
  const companyId = getCompanyId19(session2);
  if (hasRole(session2, ["admin_company" /* ADMIN_COMPANY */])) {
    if (!companyId) return false;
    return companyWorkspaceFilter(companyId);
  }
  const userId = getUserId6(session2);
  if (!userId) return false;
  return memberWorkspaceFilter(userId);
}
var saasWorkspaceCrmStatusAccess = {
  operation: {
    query: () => true,
    create: ({ session: session2 }) => !!getCompanyId19(session2),
    update: () => true,
    delete: () => true
  },
  filter: {
    query: ({ session: session2 }) => workspaceCrmStatusFilter(session2),
    update: ({ session: session2 }) => workspaceCrmStatusFilter(session2),
    delete: ({ session: session2 }) => workspaceCrmStatusFilter(session2)
  }
};

// utils/validation/crmStatusCrmHexColor.ts
var CRM_STATUS_HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
function isValidCrmStatusHexColor(color) {
  return CRM_STATUS_HEX_COLOR_REGEX.test(color.trim());
}

// models/Saas/SaasWorkspaceCrmStatus/SaasWorkspaceCrmStatus.hooks.ts
async function reassignRelatedToDefaultStatusCrm(context, fromStatusId, workspaceId) {
  const sudo = context.sudo();
  const [defaultRow] = await sudo.query.SaasWorkspaceCrmStatus.findMany({
    where: {
      workspace: { id: { equals: workspaceId } },
      isDefault: { equals: true }
    },
    take: 1,
    query: "id"
  });
  let targetId = defaultRow?.id;
  if (!targetId) {
    const [fallback] = await sudo.query.SaasWorkspaceCrmStatus.findMany({
      where: {
        workspace: { id: { equals: workspaceId } },
        id: { not: { equals: fromStatusId } }
      },
      orderBy: [{ order: "asc" }],
      take: 1,
      query: "id"
    });
    targetId = fallback?.id;
  }
  if (!targetId) {
    throw new Error(
      "No hay otro estado CRM en este workspace; no se puede eliminar este estado hasta crear otro o marcar uno como predeterminado."
    );
  }
  const taskRows = await sudo.query.TechFollowUpTask.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id"
  });
  for (const row of taskRows) {
    await sudo.db.TechFollowUpTask.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } }
    });
  }
  const proposalRows = await sudo.query.TechProposal.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id"
  });
  for (const row of proposalRows) {
    await sudo.db.TechProposal.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } }
    });
  }
  const activityRows = await sudo.query.TechSalesActivity.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id"
  });
  for (const row of activityRows) {
    await sudo.db.TechSalesActivity.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } }
    });
  }
  const workspaceTaskRows = await sudo.query.TechTask.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id"
  });
  for (const row of workspaceTaskRows) {
    await sudo.db.TechTask.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } }
    });
  }
}
async function clearOtherDefaults(args) {
  const { context, workspaceId, exceptId } = args;
  const sudo = context.sudo();
  const others = await sudo.query.SaasWorkspaceCrmStatus.findMany({
    where: {
      workspace: { id: { equals: workspaceId } },
      id: { not: { equals: exceptId } }
    },
    query: "id"
  });
  for (const row of others) {
    await sudo.db.SaasWorkspaceCrmStatus.updateOne({
      where: { id: row.id },
      data: { isDefault: false }
    });
  }
}
var saasWorkspaceCrmStatusHooks = {
  validateDelete: async ({ item, context, addValidationError }) => {
    if (!item?.id) return;
    const row = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
      where: { id: item.id },
      query: "id isDefault"
    });
    if (row?.isDefault === true) {
      addValidationError(
        "No puedes eliminar el estado CRM por defecto. Marca otro estado como predeterminado (isDefault) antes de eliminar este."
      );
    }
  },
  beforeOperation: async ({ operation, item, context }) => {
    if (operation !== "delete" || !item?.id) return;
    const deleting = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
      where: { id: item.id },
      query: "id isDefault workspace { id }"
    });
    if (!deleting) {
      return;
    }
    if (deleting.isDefault === true) {
      throw new Error(
        "No puedes eliminar el estado CRM por defecto. Marca otro estado como predeterminado (isDefault) antes de eliminar este."
      );
    }
    const workspaceId = deleting.workspace?.id;
    if (!workspaceId) {
      return;
    }
    await reassignRelatedToDefaultStatusCrm(context, deleting.id, workspaceId);
  },
  validateInput: async ({
    operation,
    resolvedData,
    context,
    addValidationError,
    item
  }) => {
    if (resolvedData?.color !== void 0 && resolvedData.color !== null) {
      const color = String(resolvedData.color).trim();
      if (!isValidCrmStatusHexColor(color)) {
        addValidationError(
          'El color debe ser un hex v\xE1lido de 6 d\xEDgitos (ej. "#2563EB").'
        );
      }
    }
    if (operation === "create") {
      const workspaceConnectId = typeof resolvedData?.workspace?.connect?.id === "string" ? resolvedData.workspace.connect.id : void 0;
      const key = typeof resolvedData?.key === "string" ? resolvedData.key : void 0;
      if (workspaceConnectId && key) {
        const dup = await context.sudo().query.SaasWorkspaceCrmStatus.findMany({
          where: {
            workspace: { id: { equals: workspaceConnectId } },
            key: { equals: key }
          },
          take: 1,
          query: "id"
        });
        if (dup.length > 0) {
          addValidationError(
            "Ya existe un estado CRM con esa clave (key) para este workspace."
          );
        }
      }
    }
    if (operation === "update" && resolvedData?.key !== void 0) {
      const full = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
        where: { id: item?.id },
        query: "id workspace { id } key"
      });
      if (full?.workspace?.id) {
        const dup = await context.sudo().query.SaasWorkspaceCrmStatus.findMany({
          where: {
            workspace: { id: { equals: full.workspace.id } },
            key: { equals: String(resolvedData.key) },
            id: { not: { equals: item.id } }
          },
          take: 1,
          query: "id"
        });
        if (dup.length > 0) {
          addValidationError(
            "Ya existe un estado CRM con esa clave (key) para este workspace."
          );
        }
      }
    }
  },
  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context
  }) => {
    if (operation !== "create" && operation !== "update" || !item?.id) {
      return;
    }
    if (resolvedData?.isDefault !== true) return;
    const full = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
      where: { id: item.id },
      query: "id workspace { id }"
    });
    if (!full?.workspace?.id) return;
    await clearOtherDefaults({
      context,
      workspaceId: full.workspace.id,
      exceptId: item.id
    });
  }
};

// models/Saas/SaasWorkspaceCrmStatus/SaasWorkspaceCrmStatus.ts
var SaasWorkspaceCrmStatus_default = (0, import_core58.list)({
  access: saasWorkspaceCrmStatusAccess,
  hooks: saasWorkspaceCrmStatusHooks,
  ui: {
    listView: {
      initialColumns: ["name", "key", "color", "order", "workspace"]
    }
  },
  fields: {
    workspace: (0, import_fields58.relationship)({
      ref: "SaasWorkspace.crmStatuses",
      many: false,
      ui: { description: "Workspace al que pertenece este estado" }
    }),
    name: (0, import_fields58.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre visible (p. ej. Kanban)" }
    }),
    color: (0, import_fields58.text)({
      validation: { isRequired: true },
      ui: { description: 'Color en hex de 6 d\xEDgitos, ej. "#2563EB"' }
    }),
    key: (0, import_fields58.text)({
      validation: { isRequired: true },
      isIndexed: true,
      ui: {
        description: "Clave estable para l\xF3gica de negocio (no cambiar en producci\xF3n a la ligera)"
      }
    }),
    order: (0, import_fields58.integer)({
      defaultValue: 0,
      isIndexed: true,
      ui: { description: "Orden en la UI (menor primero)" }
    }),
    isDefault: (0, import_fields58.checkbox)({
      defaultValue: false,
      ui: {
        description: "Estado por defecto al crear registros CRM en el workspace (solo uno activo por workspace)"
      }
    }),
    isArchived: (0, import_fields58.checkbox)({
      defaultValue: false,
      ui: { description: "Ocultar en selectores sin borrar historial" }
    }),
    followUpTasks: (0, import_fields58.relationship)({
      ref: "TechFollowUpTask.statusCrm",
      many: true,
      ui: { hideCreate: true }
    }),
    proposals: (0, import_fields58.relationship)({
      ref: "TechProposal.statusCrm",
      many: true,
      ui: { hideCreate: true }
    }),
    salesActivities: (0, import_fields58.relationship)({
      ref: "TechSalesActivity.statusCrm",
      many: true,
      ui: { hideCreate: true }
    }),
    tasks: (0, import_fields58.relationship)({
      ref: "TechTask.statusCrm",
      many: true,
      ui: { hideCreate: true, description: "Tareas de workspace en este estado" }
    })
  }
});

// models/schema.ts
var schema_default = {
  Ad: Ad_default,
  Animal: Animal_default,
  AnimalBreed: AnimalBreed_default,
  AnimalComment: AnimalComment_default,
  AnimalFavorite: AnimalFavorite_default,
  AnimalLog: AnimalLog_default,
  AnimalMultimedia: AnimalMultimedia_default,
  AnimalType: AnimalType_default,
  BlogSubscription: BlogSubscription_default,
  Cart: Cart_default,
  Category: Category_default,
  ContactForm: ContactForm_default,
  Order: Order_default,
  Payment: Payment_default,
  PaymentMethod: PaymentMethod_default,
  Pet: Pet_default,
  PetMultimedia: PetMultimedia_default,
  PetPlace: PetPlace_default,
  PetPlaceLike: PetPlaceLike_default,
  PetPlaceService: PetPlaceService_default,
  PetPlaceType: PetPlaceType_default,
  Post: Post_default,
  PostComment: PostComment_default,
  PostFavorite: PostFavorite_default,
  PostLike: PostLike_default,
  PostView: PostView_default,
  Product: Product_default,
  Review: Review_default,
  Role: Role_default,
  SaasCompany: SaasCompany_default,
  SaasCompanyMonthlyLeadSync: SaasCompanyMonthlyLeadSync_default,
  SaasCompanySubscription: SaasCompanySubscription_default,
  SaasPayment: SaasPayment_default,
  SaasPaymentMethod: SaasPaymentMethod_default,
  SaasPlan: SaasPlan_default,
  SaasProject: SaasProject_default,
  SaasQuotation: SaasQuotation_default,
  SaasQuotationProduct: SaasQuotationProduct_default,
  SaasReferralCommission: SaasReferralCommission_default,
  SaasSubscriptionLog: SaasSubscriptionLog_default,
  SaasWorkspace: SaasWorkspace_default,
  SaasWorkspaceCrmStatus: SaasWorkspaceCrmStatus_default,
  Schedule: Schedule_default,
  SocialMedia: SocialMedia_default,
  SystemRelease: SystemRelease_default,
  Tag: Tag_default,
  TechBusinessLead: TechBusinessLead_default,
  TechFile: TechFiles_default,
  TechLeadSyncLog: TechLeadSyncLog_default,
  TechFollowUpTask: TechFollowUpTask_default,
  TechProposal: TechProposal_default,
  TechSalesActivity: TechSalesActivity_default,
  TechTask: TechTask_default,
  TechStatusBusinessLead: TechStatusBusinessLead_default,
  TokenNotification: TokenNotification_default,
  User: User_default,
  UserAuthLog: UserAuthLog_default,
  WishList: WishList_default
};

// keystone.ts
var import_core59 = require("@keystone-6/core");

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
  sessionData: "id name lastName secondLastName username email verified profileImage { url } phone roles { name } createdAt company { id }",
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

// utils/auth/userAuthLogWrite.ts
function maskEmail(email) {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 2) return `**@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}
async function writeUserAuthLog(context, params) {
  try {
    const durationMs = Date.now() - params.startedAt;
    const snapshot = params.responseSnapshot ?? void 0;
    await context.sudo().query.UserAuthLog.createOne({
      data: {
        source: params.source,
        step: params.step,
        success: params.success,
        message: params.message,
        emailMasked: maskEmail(params.email),
        durationMs,
        responseSnapshot: snapshot,
        ...params.userId ? { user: { connect: { id: params.userId } } } : {}
      }
    });
  } catch {
  }
}

// graphql/customs/mutations/auth/customAuth.ts
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
    const startedAt = Date.now();
    const emailTrimmed = email.trim();
    try {
      const lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
      let isNewUser = false;
      let userFound = await context.sudo().query.User.findOne({
        query: "id name lastName secondLastName username email phone role birthday age verified createdAt profileImage { url } ",
        where: {
          email: emailTrimmed
        }
      });
      if (!userFound) {
        isNewUser = true;
        userFound = await context.db.User.createOne({
          data: {
            email: emailTrimmed,
            name,
            lastName,
            username: await checkUserName(name, lastName, context),
            role: "user",
            lastLoginAt
          }
        });
      } else {
        userFound = await context.sudo().query.User.updateOne({
          where: { id: userFound.id },
          data: { lastLoginAt },
          query: "id name lastName secondLastName username email phone role birthday age verified createdAt profileImage { url } "
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
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.CUSTOM_AUTH,
        step: isNewUser ? USER_AUTH_LOG_STEP.CUSTOM_AUTH_SIGNUP : USER_AUTH_LOG_STEP.CUSTOM_AUTH_LOGIN,
        success: true,
        message: "Success",
        email: emailTrimmed,
        userId: userFound.id,
        responseSnapshot: {
          success: true,
          message: "Success",
          userId: userFound.id,
          isNewUser
        }
      });
      return {
        success: true,
        message: "Success",
        data: {
          ...userFound,
          sessionToken
        }
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error de autenticaci\xF3n.";
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.CUSTOM_AUTH,
        step: USER_AUTH_LOG_STEP.CUSTOM_AUTH_FAIL,
        success: false,
        message,
        email: emailTrimmed,
        userId: null,
        responseSnapshot: {
          errorName: e instanceof Error ? e.name : "unknown"
        }
      });
      throw e;
    }
  }
};
var customAuth_default = { typeDefs, definition, resolver };

// graphql/customs/mutations/auth/authenticateUserWithGoogle.ts
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));
var import_crypto3 = require("crypto");
var typeDefs2 = `
  type UserAuthenticationWithGoogleSuccess {
    sessionToken: String!
    item: User!
  }

  type UserAuthenticationWithGoogleFailure {
    message: String!
  }

  union AuthenticateUserWithGoogleResult =
    UserAuthenticationWithGoogleSuccess
    | UserAuthenticationWithGoogleFailure
`;
var definition2 = `
  authenticateUserWithGoogle(
    idToken: String!
    referrerCode: String
  ): AuthenticateUserWithGoogleResult!
`;
async function verifyGoogleIdToken(idToken) {
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error || !data.email) return null;
    return {
      email: data.email,
      name: data.name ?? void 0,
      picture: data.picture ?? void 0,
      sub: data.sub
    };
  } catch {
    return null;
  }
}
var USER_QUERY = "id lastName name phone email profileImage { url } roles { name } secondLastName username verified lastLoginAt";
var resolver2 = {
  authenticateUserWithGoogle: async (_root, {
    idToken,
    referrerCode
  }, context) => {
    const payload = await verifyGoogleIdToken(idToken);
    if (!payload) {
      return {
        __typename: "UserAuthenticationWithGoogleFailure",
        message: "Token de Google inv\xE1lido o expirado"
      };
    }
    let user = await context.sudo().query.User.findOne({
      where: { email: payload.email },
      query: USER_QUERY
    });
    if (!user) {
      try {
        const [userRole] = await context.sudo().query.Role.findMany({
          where: { name: { equals: "user" /* USER */ } },
          take: 1,
          query: "id"
        });
        let referredByConnect;
        if (referrerCode) {
          const referrer = await context.sudo().query.User.findOne({
            where: { referralCode: referrerCode.toUpperCase() },
            query: "id"
          });
          if (referrer) {
            referredByConnect = { connect: { id: referrer.id } };
          }
        }
        const baseName = payload.name?.trim() || payload.email.split("@")[0];
        const username = await checkUserName(baseName, "", context);
        user = await context.sudo().query.User.createOne({
          data: {
            email: payload.email,
            name: baseName,
            lastName: "",
            username,
            verified: true,
            referredBy: referredByConnect,
            roles: userRole ? { connect: [{ id: userRole.id }] } : void 0
          },
          query: USER_QUERY
        });
        const company = await context.sudo().query.SaasCompany.createOne({
          data: {
            name: baseName
          },
          query: "id"
        });
        try {
          const [adminCompanyRole] = await context.sudo().query.Role.findMany({
            where: { name: { equals: "admin_company" /* ADMIN_COMPANY */ } },
            take: 1,
            query: "id"
          });
          await context.sudo().query.User.updateOne({
            where: { id: user.id },
            data: {
              company: { connect: { id: company.id } },
              ...adminCompanyRole && {
                roles: {
                  connect: [{ id: adminCompanyRole.id }]
                }
              }
            }
          });
        } catch (error) {
          console.error(
            "Error al asignar compa\xF1\xEDa y rol ADMIN_COMPANY al usuario de Google:",
            error
          );
        }
      } catch (err) {
        return {
          __typename: "UserAuthenticationWithGoogleFailure",
          message: err instanceof Error ? err.message : "Error al crear usuario"
        };
      }
    }
    user = await context.sudo().query.User.updateOne({
      where: { id: user.id },
      data: { lastLoginAt: (/* @__PURE__ */ new Date()).toISOString() },
      query: USER_QUERY
    });
    let sessionSecret2 = process.env.SESSION_SECRET;
    if (!sessionSecret2 && process.env.NODE_ENV !== "production") {
      sessionSecret2 = (0, import_crypto3.randomBytes)(32).toString("hex");
    }
    const sessionToken = import_jsonwebtoken2.default.sign(
      {
        data: {
          id: user.id,
          email: user.email
        }
      },
      sessionSecret2
    );
    const sessionStrategy = context.sessionStrategy;
    if (sessionStrategy?.start && context.res) {
      try {
        await sessionStrategy.start({
          context,
          data: { listKey: "User", itemId: user.id }
        });
      } catch (_) {
      }
    }
    return {
      __typename: "UserAuthenticationWithGoogleSuccess",
      sessionToken,
      item: user
    };
  }
};
var authenticateUserWithGoogle_default = { typeDefs: typeDefs2, definition: definition2, resolver: resolver2 };

// graphql/customs/mutations/auth/registerUser.ts
var typeDefs3 = ``;
var definition3 = `
  registerUser(data: UserCreateInput!, referrerCode: String): User
`;
var resolver3 = {
  registerUser: async (_root, {
    data,
    referrerCode
  }, context) => {
    const startedAt = Date.now();
    const emailStr = String(data?.email ?? "").trim();
    let referredByConnect;
    if (referrerCode) {
      const referrer = await context.sudo().query.User.findOne({
        where: { referralCode: referrerCode.toUpperCase() },
        query: "id"
      });
      if (!referrer) {
        await writeUserAuthLog(context, {
          startedAt,
          source: USER_AUTH_LOG_SOURCE.REGISTER_USER,
          step: USER_AUTH_LOG_STEP.REGISTER_FAIL_INVALID_REFERRER,
          success: false,
          message: "El c\xF3digo de referido no pertenece a ning\xFAn usuario.",
          email: emailStr,
          userId: null,
          responseSnapshot: {
            referrerCode: referrerCode.toUpperCase()
          }
        });
        throw new Error(
          "El c\xF3digo de referido no pertenece a ning\xFAn usuario."
        );
      }
      referredByConnect = { connect: { id: referrer.id } };
    }
    try {
      const user = await context.sudo().query.User.createOne({
        data: {
          ...data,
          referredBy: referredByConnect
        },
        query: "id name lastName secondLastName email phone username referralCode referredBy { id }"
      });
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.REGISTER_USER,
        step: USER_AUTH_LOG_STEP.REGISTER_SUCCESS,
        success: true,
        message: "Usuario registrado correctamente.",
        email: emailStr,
        userId: user.id,
        responseSnapshot: {
          userId: user.id,
          referrerCode: referrerCode ? String(referrerCode).toUpperCase() : null
        }
      });
      return user;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al registrar el usuario.";
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.REGISTER_USER,
        step: USER_AUTH_LOG_STEP.REGISTER_FAIL,
        success: false,
        message,
        email: emailStr,
        userId: null,
        responseSnapshot: {
          errorName: e instanceof Error ? e.name : "unknown"
        }
      });
      throw e;
    }
  }
};
var registerUser_default = { typeDefs: typeDefs3, definition: definition3, resolver: resolver3 };

// graphql/customs/mutations/importBusinessLeadFromGoogle.ts
var typeDefs4 = `
  input ImportBusinessLeadFromGoogleInput {
    placeId: String!
    category: String
    assignedSellerId: ID
  }

  type ImportBusinessLeadFromGoogleResult {
    success: Boolean!
    message: String!
    businessLeadId: ID
  }

  type Mutation {
    importBusinessLeadFromGoogle(input: ImportBusinessLeadFromGoogleInput!): ImportBusinessLeadFromGoogleResult!
  }
`;
var definition4 = `
  importBusinessLeadFromGoogle(input: ImportBusinessLeadFromGoogleInput!): ImportBusinessLeadFromGoogleResult!
`;
async function getPlaceDetails(placeId, apiKey) {
  const fields = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=es`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  return data.result;
}
function parseAddressComponents(components) {
  let city = "";
  let state = "";
  let country = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("country")) country = c.long_name;
  }
  return { city, state, country };
}
var resolver4 = {
  importBusinessLeadFromGoogle: async (_root, {
    input
  }, context) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        businessLeadId: null
      };
    }
    const existing = await context.sudo().query.TechBusinessLead.findOne({
      where: { googlePlaceId: input.placeId },
      query: "id"
    });
    if (existing) {
      return {
        success: false,
        message: "Este negocio ya fue importado como lead",
        businessLeadId: existing.id
      };
    }
    const verifiedSellerIds = await getVerifiedSalesPersonIds(context);
    const place = await getPlaceDetails(input.placeId, apiKey);
    if (!place) {
      return {
        success: false,
        message: "No se pudo obtener datos del lugar",
        businessLeadId: null
      };
    }
    const { city, state, country } = parseAddressComponents(
      place.address_components || []
    );
    const address = place.formatted_address || "";
    const hasWebsite = !!place.website;
    const data = {
      businessName: place.name,
      category: input.category || place.types?.[0] || "Negocio",
      phone: place.formatted_phone_number || place.international_phone_number || "",
      address,
      city: city || "",
      state: state || "",
      country: country || "",
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      hasWebsite,
      websiteUrl: place.website || "",
      source: "Google Maps",
      googlePlaceId: input.placeId,
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${input.placeId}`,
      lat: place.geometry?.location?.lat ?? null,
      lng: place.geometry?.location?.lng ?? null
    };
    const sellerId = input.assignedSellerId ? input.assignedSellerId : verifiedSellerIds.length > 0 ? verifiedSellerIds[Math.floor(0 % verifiedSellerIds.length)] : null;
    if (sellerId) {
      data.salesPerson = { connect: { id: sellerId } };
    }
    if (input.assignedSellerId) {
      data.salesPerson = { connect: { id: input.assignedSellerId } };
    }
    try {
      const lead = await context.sudo().query.TechBusinessLead.createOne({
        data
      });
      await context.sudo().query.TechStatusBusinessLead.createOne({
        data: {
          businessLead: { connect: { id: lead.id } },
          pipelineStatus: PIPELINE_STATUS.DETECTADO,
          opportunityLevel: "Media"
        }
      });
      return {
        success: true,
        message: "Lead importado correctamente",
        businessLeadId: lead.id
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error creando lead",
        businessLeadId: null
      };
    }
  }
};
async function getVerifiedSalesPersonIds(context) {
  const users = await context.sudo().query.User.findMany({
    where: {
      salesPersonVerified: { equals: true },
      roles: { some: { name: { equals: "vendedor" /* VENDEDOR */ } } }
    },
    query: "id"
  });
  return users.map((u) => u.id);
}
var importBusinessLeadFromGoogle_default = { typeDefs: typeDefs4, definition: definition4, resolver: resolver4 };

// graphql/customs/mutations/importPetPlace.ts
var typeDefs5 = `
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
var definition5 = `
  executeImportPetPlace(input: ImportPetPlaceInput!): ImportPetPlaceResult!
`;
var resolver5 = {
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
  typeDefs: typeDefs5,
  definition: definition5,
  resolver: resolver5
};

// utils/helpers/calculate_distances.ts
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => value * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// utils/helpers/tech/format_review_tech.ts
function formatReviewTech(review) {
  const author = review.author_name || "An\xF3nimo";
  const rating = review.rating ?? 0;
  const text48 = (review.text || "").trim();
  return `\u2B50 ${rating} - ${author}: ${text48}`;
}

// utils/helpers/tech/build_prompt_text.ts
var MIN_POSITIVE_REVIEW_RATING = 4;
var PROMPT_PREFIX = "";
function buildReviewsAndPrompt(details, category) {
  const positiveReviews = (details.reviews || []).filter(
    (r) => (r.rating ?? 0) >= MIN_POSITIVE_REVIEW_RATING && (r.text || "").trim()
  ).slice(0, 5).map(formatReviewTech);
  const topReviews = [
    positiveReviews[0] || "",
    positiveReviews[1] || "",
    positiveReviews[2] || "",
    positiveReviews[3] || "",
    positiveReviews[4] || ""
  ];
  const lines = [
    `Negocio: ${details.name || ""}`,
    `Categor\xEDa: ${category}`,
    `Direcci\xF3n: ${details.formatted_address || ""}`,
    `Tel\xE9fono: ${details.formatted_phone_number || ""}`,
    `Sitio web actual: ${details.website ? "S\xED" : "No tiene"}`,
    `Valoraci\xF3n: ${details.rating ?? "-"} (${details.user_ratings_total ?? 0} rese\xF1as)`,
    "",
    "Rese\xF1as positivas de Google:",
    ...positiveReviews.map((r) => `- ${r}`)
  ];
  const businessInfo = lines.join("\n");
  const websitePromptContent = PROMPT_PREFIX + businessInfo;
  return { topReviews, websitePromptContent };
}

// utils/helpers/tech/parse_address.ts
function parseAddressComponents2(components) {
  let city = "";
  let state = "";
  let country = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("country")) country = c.long_name;
  }
  return { city, state, country };
}

// utils/helpers/tech/monthly_record.ts
async function getOrCreateMonthlyRecord(context, companyId, year, month) {
  const [existing] = await context.sudo().query.SaasCompanyMonthlyLeadSync.findMany({
    where: {
      company: { id: { equals: companyId } },
      year: { equals: year },
      month: { equals: month }
    },
    take: 1,
    query: "id syncedCount"
  });
  if (existing) {
    return {
      id: existing.id,
      syncedCount: existing.syncedCount ?? 0
    };
  }
  const created = await context.sudo().query.SaasCompanyMonthlyLeadSync.createOne({
    data: {
      company: { connect: { id: companyId } },
      year,
      month,
      syncedCount: 0
    },
    query: "id syncedCount"
  });
  return {
    id: created.id,
    syncedCount: created.syncedCount ?? 0
  };
}

// utils/helpers/tech/place_details.ts
async function getPlaceDetails2(placeId, apiKey) {
  const fields = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry,reviews";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=es`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  return data.result;
}

// utils/saas/freePlanTrial.ts
function toLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseYmdAsLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const localDate = new Date(y, m - 1, d);
  if (Number.isNaN(localDate.getTime())) return null;
  return localDate;
}
function getFreePlanTrialInfo(activatedAt) {
  if (!activatedAt) {
    return { trialEnd: null, isExpired: false };
  }
  const activatedAtDate = parseYmdAsLocalDate(activatedAt);
  if (!activatedAtDate) {
    return { trialEnd: null, isExpired: false };
  }
  const trialEndDate = new Date(activatedAtDate);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS_FREE_PLAN);
  const trialEnd = toLocalYmd(trialEndDate);
  const today = toLocalYmd(/* @__PURE__ */ new Date());
  return {
    trialEnd,
    isExpired: trialEnd < today
  };
}

// graphql/customs/mutations/syncLeadsFront.ts
async function ensureStatusForLeadAssignment(context, leadId, companyId, userId, opportunityLevel = "Media") {
  const [existing] = await context.sudo().query.TechStatusBusinessLead.findMany({
    where: {
      businessLead: { id: { equals: leadId } },
      saasCompany: { id: { equals: companyId } }
    },
    take: 1,
    query: "id"
  });
  if (existing) {
    await context.sudo().query.TechStatusBusinessLead.updateOne({
      where: { id: existing.id },
      data: {
        salesPerson: { connect: { id: userId } },
        pipelineStatus: PIPELINE_STATUS.DETECTADO,
        opportunityLevel
      }
    });
  } else {
    await context.sudo().query.TechStatusBusinessLead.createOne({
      data: {
        businessLead: { connect: { id: leadId } },
        saasCompany: { connect: { id: companyId } },
        salesPerson: { connect: { id: userId } },
        pipelineStatus: PIPELINE_STATUS.DETECTADO,
        opportunityLevel
      }
    });
  }
}
var MIN_RATING = 0;
var MIN_REVIEWS = 0;
var DEFAULT_MAX_RESULTS = 60;
async function logSyncLeadsResult(context, userId, companyId, input, result) {
  if (!userId) return;
  try {
    await context.sudo().query.TechLeadSyncLog.createOne({
      data: {
        user: { connect: { id: userId } },
        ...companyId && { company: { connect: { id: companyId } } },
        success: result.success,
        message: result.message,
        created: result.created,
        alreadyInDb: result.alreadyInDb,
        skippedLowRating: result.skippedLowRating,
        syncedLeadsCount: result.syncedLeadsCount,
        syncedCount: result.syncedCount,
        leadLimit: result.leadLimit,
        lat: input.lat,
        lng: input.lng,
        radius: input.radius,
        category: input.category
      }
    });
  } catch (_) {
  }
}
var typeDefs6 = `
  input SyncLeadsFrontInput {
    lat: Float!
    lng: Float!
    radius: Float!
    category: String!
    maxResults: Int
    minRating: Float
    minReviews: Int
  }

  type SyncLeadsFrontResult {
    success: Boolean!
    message: String!
    created: Int!
    alreadyInDb: Int!
    skippedLowRating: Int!
    syncedLeadsCount: Int!
    syncedCount: Int
    leadLimit: Int
  }

  type Mutation {
    syncLeadsFront(input: SyncLeadsFrontInput!): SyncLeadsFrontResult!
  }
`;
var definition6 = `
  syncLeadsFront(input: SyncLeadsFrontInput!): SyncLeadsFrontResult!
`;
var resolver6 = {
  syncLeadsFront: async (_root, {
    input
  }, context) => {
    const emptyResult = {
      created: 0,
      alreadyInDb: 0,
      skippedLowRating: 0,
      syncedLeadsCount: 0,
      syncedCount: null,
      leadLimit: null
    };
    const session2 = context.session;
    const userId = session2?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesi\xF3n para sincronizar leads",
        ...emptyResult
      };
    }
    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }"
    });
    const company = user?.company;
    if (!company?.id) {
      const result = {
        success: false,
        message: "Tu usuario no tiene una empresa asignada",
        ...emptyResult
      };
      await logSyncLeadsResult(context, userId, void 0, input, result);
      return result;
    }
    const [activeSubscription] = await context.sudo().query.SaasCompanySubscription.findMany({
      where: {
        company: { id: { equals: company.id } },
        status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] }
      },
      orderBy: [{ activatedAt: "desc" }],
      take: 1,
      query: "id planLeadLimit planCost activatedAt"
    });
    if (!activeSubscription) {
      const result = {
        success: false,
        message: `"${company?.name ?? "La empresa"}" no tiene una suscripci\xF3n activa. Contrata o activa una suscripci\xF3n para sincronizar leads.`,
        ...emptyResult
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const sub = activeSubscription;
    const isFreePlan = sub.planCost != null && sub.planCost <= 0;
    if (isFreePlan && sub.activatedAt) {
      const { isExpired } = getFreePlanTrialInfo(sub.activatedAt);
      if (isExpired) {
        const result = {
          success: false,
          message: "Tu plan gratuito ha terminado. Contrata o activa una suscripci\xF3n para poder obtener m\xE1s clientes.",
          ...emptyResult,
          leadLimit: 0
        };
        await logSyncLeadsResult(context, userId, company.id, input, result);
        return result;
      }
    }
    const leadLimit = sub.planLeadLimit ?? null;
    if (leadLimit === null) {
      const result = {
        success: false,
        message: `La suscripci\xF3n activa de "${company?.name ?? "la empresa"}" no tiene l\xEDmite de leads configurado.`,
        ...emptyResult,
        leadLimit
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
    if (leadLimit < 1) {
      const result = {
        success: false,
        message: `La suscripci\xF3n activa de "${company?.name ?? "la empresa"}" no permite sincronizar leads.`,
        ...emptyResult,
        leadLimit
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
    const { id: recordId, syncedCount } = await getOrCreateMonthlyRecord(
      context,
      company.id,
      year,
      month
    );
    const remainingQuota = Math.max(0, leadLimit - syncedCount);
    if (remainingQuota === 0) {
      const result = {
        success: false,
        message: `Cuota mensual de tu suscripci\xF3n alcanzada (${syncedCount}/${leadLimit} leads). Pr\xF3ximo reinicio el mes siguiente.`,
        ...emptyResult,
        syncedCount,
        leadLimit
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
    const maxResults = Math.min(
      input.maxResults ?? DEFAULT_MAX_RESULTS,
      remainingQuota
    );
    const minRating = typeof input.minRating === "number" ? Math.max(0, input.minRating) : MIN_RATING;
    const minReviews = typeof input.minReviews === "number" ? Math.max(0, Math.floor(input.minReviews)) : MIN_REVIEWS;
    const {
      lat: centerLat,
      lng: centerLng,
      radius: radiusKm,
      category: inputCategory
    } = input;
    const candidates = await context.sudo().query.TechBusinessLead.findMany({
      where: {
        category: { equals: inputCategory }
      },
      take: 1e3,
      query: "id lat lng saasCompany { id }"
    });
    const existingIds = [];
    for (const lead of candidates) {
      if (existingIds.length >= maxResults) break;
      const leadLat = lead.lat;
      const leadLng = lead.lng;
      if (leadLat == null || leadLng == null) continue;
      const distanceKm = haversineDistance(
        centerLat,
        centerLng,
        leadLat,
        leadLng
      );
      if (distanceKm > radiusKm) continue;
      const alreadyAssignedToThisCompany = (lead.saasCompany ?? []).some(
        (c) => c.id === company.id
      );
      if (alreadyAssignedToThisCompany) continue;
      existingIds.push(lead.id);
    }
    let assignedFromDb = 0;
    for (const leadId of existingIds) {
      try {
        await context.sudo().query.TechBusinessLead.updateOne({
          where: { id: leadId },
          data: { saasCompany: { connect: { id: company.id } } }
          // ADD only; never replace
        });
        await ensureStatusForLeadAssignment(
          context,
          leadId,
          company.id,
          userId
        );
        assignedFromDb++;
      } catch (_) {
      }
    }
    let currentSyncedCount = syncedCount + assignedFromDb;
    let syncedThisRequest = assignedFromDb;
    if (assignedFromDb > 0) {
      await context.sudo().query.SaasCompanyMonthlyLeadSync.updateOne({
        where: { id: recordId },
        data: { syncedCount: currentSyncedCount }
      });
    }
    if (syncedThisRequest >= maxResults || leadLimit !== null && currentSyncedCount >= leadLimit) {
      const result = {
        success: true,
        message: `${assignedFromDb} leads asignados. Cuota: ${currentSyncedCount}${leadLimit !== null ? `/${leadLimit}` : ""} este mes.`,
        created: 0,
        alreadyInDb: assignedFromDb,
        skippedLowRating: 0,
        syncedLeadsCount: assignedFromDb,
        syncedCount: currentSyncedCount,
        leadLimit
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      if (syncedThisRequest > 0) {
        const result2 = {
          success: true,
          message: `${syncedThisRequest} leads asignados desde BD. GOOGLE_MAPS_API_KEY no configurada para buscar m\xE1s. Cuota: ${currentSyncedCount}${leadLimit !== null ? `/${leadLimit}` : ""} este mes.`,
          created: 0,
          alreadyInDb: assignedFromDb,
          skippedLowRating: 0,
          syncedLeadsCount: syncedThisRequest,
          syncedCount: currentSyncedCount,
          leadLimit
        };
        await logSyncLeadsResult(context, userId, company.id, input, result2);
        return result2;
      }
      const result = {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        ...emptyResult
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
    const { lat, lng, radius, category } = input;
    const radiusMeters = Math.round(radius * 1e3);
    const keyword = encodeURIComponent(category);
    let created = 0;
    let alreadyInDb = assignedFromDb;
    let skippedLowRating = 0;
    let nextPageToken;
    try {
      do {
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${keyword}&key=${apiKey}&language=es`;
        if (nextPageToken) {
          url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(nextPageToken)}&key=${apiKey}`;
          await new Promise((r) => setTimeout(r, 2e3));
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          const result2 = {
            success: false,
            message: data.error_message || data.status,
            created,
            alreadyInDb,
            skippedLowRating,
            syncedLeadsCount: syncedThisRequest,
            syncedCount: currentSyncedCount,
            leadLimit
          };
          await logSyncLeadsResult(context, userId, company.id, input, result2);
          return result2;
        }
        const results = data.results || [];
        for (const place of results) {
          if (syncedThisRequest >= maxResults) break;
          if (leadLimit !== null && currentSyncedCount >= leadLimit) break;
          const placeId = place.place_id;
          const placeRating = place.rating ?? 0;
          const userRatingsTotal = place.user_ratings_total ?? 0;
          let lead = await context.sudo().query.TechBusinessLead.findOne({
            where: { googlePlaceId: placeId },
            query: "id saasCompany { id }"
          });
          if (lead) {
            const leadCompanies = lead.saasCompany ?? [];
            const alreadyAssignedToThisCompany = leadCompanies.some(
              (c) => c.id === company.id
            );
            if (alreadyAssignedToThisCompany) {
              continue;
            }
            alreadyInDb++;
            try {
              const leadId = lead.id;
              await context.sudo().query.TechBusinessLead.updateOne({
                where: { id: leadId },
                data: { saasCompany: { connect: { id: company.id } } }
              });
              const level = placeRating >= 4.5 ? "Alta" : placeRating >= 4 ? "Media" : "Baja";
              await ensureStatusForLeadAssignment(
                context,
                leadId,
                company.id,
                userId,
                level
              );
              syncedThisRequest++;
              currentSyncedCount++;
            } catch (_) {
            }
            continue;
          }
          if (placeRating < minRating || userRatingsTotal < minReviews) {
            skippedLowRating++;
            continue;
          }
          const details = await getPlaceDetails2(placeId, apiKey);
          if (!details) continue;
          const {
            city: parsedCity,
            state,
            country
          } = parseAddressComponents2(details.address_components || []);
          const { topReviews, websitePromptContent } = buildReviewsAndPrompt(
            details,
            category
          );
          const leadData = {
            businessName: details.name,
            category,
            phone: details.formatted_phone_number || details.international_phone_number || "",
            address: details.formatted_address || "",
            city: parsedCity || "",
            state: state || "",
            country: country || "",
            rating: details.rating ?? null,
            reviewCount: details.user_ratings_total ?? null,
            hasWebsite: !!details.website,
            websiteUrl: details.website || "",
            source: "Google Maps",
            googlePlaceId: placeId,
            googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            topReview1: topReviews[0] || null,
            topReview2: topReviews[1] || null,
            topReview3: topReviews[2] || null,
            topReview4: topReviews[3] || null,
            topReview5: topReviews[4] || null,
            websitePromptContent,
            saasCompany: { connect: { id: company.id } },
            lat: details.geometry?.location?.lat ?? null,
            lng: details.geometry?.location?.lng ?? null
          };
          try {
            const newLead = await context.sudo().query.TechBusinessLead.createOne({
              data: leadData
            });
            await context.sudo().query.TechStatusBusinessLead.createOne({
              data: {
                businessLead: { connect: { id: newLead.id } },
                saasCompany: { connect: { id: company.id } },
                salesPerson: { connect: { id: userId } },
                pipelineStatus: PIPELINE_STATUS.DETECTADO,
                opportunityLevel: placeRating >= 4.5 ? "Alta" : placeRating >= 4 ? "Media" : "Baja"
              }
            });
            created++;
            syncedThisRequest++;
            currentSyncedCount++;
          } catch (_) {
          }
        }
        nextPageToken = data.next_page_token;
      } while (nextPageToken && syncedThisRequest < maxResults && (leadLimit === null || currentSyncedCount < leadLimit));
      if (syncedThisRequest > 0) {
        await context.sudo().query.SaasCompanyMonthlyLeadSync.updateOne({
          where: { id: recordId },
          data: { syncedCount: currentSyncedCount }
        });
      }
      const result = {
        success: true,
        message: `Sincronizaci\xF3n completada. Leads asignados a tu empresa: ${syncedThisRequest} ${leadLimit !== null ? ` Cuota: ${currentSyncedCount}/${leadLimit} este mes.` : ""}`,
        created,
        alreadyInDb,
        skippedLowRating,
        syncedLeadsCount: syncedThisRequest,
        syncedCount: currentSyncedCount,
        leadLimit
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    } catch (err) {
      const result = {
        success: false,
        message: err instanceof Error ? err.message : "Error en sincronizaci\xF3n",
        created,
        alreadyInDb,
        skippedLowRating,
        syncedLeadsCount: syncedThisRequest,
        syncedCount: currentSyncedCount,
        leadLimit
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
  }
};
var syncLeadsFront_default = { typeDefs: typeDefs6, definition: definition6, resolver: resolver6 };

// graphql/customs/mutations/syncBusinessLeadsFromGoogle.ts
async function getVerifiedSalesPersonIds2(context) {
  const users = await context.sudo().query.User.findMany({
    where: {
      salesPersonVerified: { equals: true },
      roles: { some: { name: { equals: "vendedor" /* VENDEDOR */ } } }
    },
    query: "id"
  });
  return users.map((u) => u.id);
}
var MIN_RATING2 = 4;
var MIN_REVIEWS2 = 20;
var DEFAULT_MAX_RESULTS2 = 60;
var typeDefs7 = `
  input SyncBusinessLeadsFromGoogleInput {
    lat: Float!
    lng: Float!
    radius: Float!
    category: String!
    assignedSellerId: ID
    maxResults: Int
  }

  type SyncBusinessLeadsFromGoogleResult {
    success: Boolean!
    message: String!
    created: Int!
    alreadyInDb: Int!
    skippedLowRating: Int!
  }

  type Mutation {
    syncBusinessLeadsFromGoogle(input: SyncBusinessLeadsFromGoogleInput!): SyncBusinessLeadsFromGoogleResult!
  }
`;
var definition7 = `
  syncBusinessLeadsFromGoogle(input: SyncBusinessLeadsFromGoogleInput!): SyncBusinessLeadsFromGoogleResult!
`;
var PROMPT_PREFIX2 = "Escribe un prompt que pueda usar en un vibe coding software para crear un sitio web atractivo, para una empresa que no tiene pagina web ahorita mismo, muestra funcionalidades que se puedan implementar en un sitio web para el negocio con la info: ";
var MIN_POSITIVE_REVIEW_RATING2 = 4;
async function getPlaceDetails3(placeId, apiKey) {
  const fields = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry,reviews";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=es`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  return data.result;
}
function formatReview(review) {
  const author = review.author_name || "An\xF3nimo";
  const rating = review.rating ?? 0;
  const text48 = (review.text || "").trim();
  return `\u2B50 ${rating} - ${author}: ${text48}`;
}
function buildReviewsAndPrompt2(details, category) {
  const positiveReviews = (details.reviews || []).filter(
    (r) => (r.rating ?? 0) >= MIN_POSITIVE_REVIEW_RATING2 && (r.text || "").trim()
  ).slice(0, 5).map(formatReview);
  const topReviews = [
    positiveReviews[0] || "",
    positiveReviews[1] || "",
    positiveReviews[2] || "",
    positiveReviews[3] || "",
    positiveReviews[4] || ""
  ];
  const lines = [
    `Negocio: ${details.name || ""}`,
    `Categor\xEDa: ${category}`,
    `Direcci\xF3n: ${details.formatted_address || ""}`,
    `Tel\xE9fono: ${details.formatted_phone_number || ""}`,
    `Sitio web actual: ${details.website ? "S\xED" : "No tiene"}`,
    `Valoraci\xF3n: ${details.rating ?? "-"} (${details.user_ratings_total ?? 0} rese\xF1as)`,
    "",
    "Rese\xF1as positivas de Google:",
    ...positiveReviews.map((r) => `- ${r}`)
  ];
  const businessInfo = lines.join("\n");
  const websitePromptContent = PROMPT_PREFIX2 + businessInfo;
  return { topReviews, websitePromptContent };
}
function parseAddressComponents3(components) {
  let city = "";
  let state = "";
  let country = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("country")) country = c.long_name;
  }
  return { city, state, country };
}
var resolver7 = {
  syncBusinessLeadsFromGoogle: async (_root, {
    input
  }, context) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        created: 0,
        alreadyInDb: 0,
        skippedLowRating: 0
      };
    }
    const {
      lat,
      lng,
      radius,
      category,
      assignedSellerId,
      maxResults = DEFAULT_MAX_RESULTS2
    } = input;
    const radiusMeters = Math.round(radius * 1e3);
    const keyword = encodeURIComponent(category);
    let created = 0;
    let alreadyInDb = 0;
    let skippedLowRating = 0;
    let nextPageToken;
    const verifiedSellerIds = await getVerifiedSalesPersonIds2(context);
    try {
      do {
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${keyword}&key=${apiKey}&language=es`;
        if (nextPageToken) {
          url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(nextPageToken)}&key=${apiKey}`;
          await new Promise((r) => setTimeout(r, 2e3));
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          return {
            success: false,
            message: data.error_message || data.status,
            created,
            alreadyInDb,
            skippedLowRating
          };
        }
        const results = data.results || [];
        for (const place of results) {
          if (created + alreadyInDb + skippedLowRating >= maxResults) break;
          const placeId = place.place_id;
          const placeRating = place.rating ?? 0;
          const userRatingsTotal = place.user_ratings_total ?? 0;
          const existing = await context.sudo().query.TechBusinessLead.findOne({
            where: { googlePlaceId: placeId },
            query: "id"
          });
          if (existing) {
            alreadyInDb++;
            continue;
          }
          if (placeRating < MIN_RATING2 || userRatingsTotal < MIN_REVIEWS2) {
            skippedLowRating++;
            continue;
          }
          const details = await getPlaceDetails3(placeId, apiKey);
          if (!details) continue;
          const { city: parsedCity, state, country } = parseAddressComponents3(
            details.address_components || []
          );
          const { topReviews, websitePromptContent } = buildReviewsAndPrompt2(
            details,
            category
          );
          const leadData = {
            businessName: details.name,
            category,
            phone: details.formatted_phone_number || details.international_phone_number || "",
            address: details.formatted_address || "",
            city: parsedCity || "",
            state: state || "",
            country: country || "",
            rating: details.rating ?? null,
            reviewCount: details.user_ratings_total ?? null,
            hasWebsite: !!details.website,
            source: "Google Maps",
            googlePlaceId: placeId,
            googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            topReview1: topReviews[0] || null,
            topReview2: topReviews[1] || null,
            topReview3: topReviews[2] || null,
            topReview4: topReviews[3] || null,
            topReview5: topReviews[4] || null,
            websitePromptContent,
            lat: details.geometry?.location?.lat ?? null,
            lng: details.geometry?.location?.lng ?? null
          };
          const sellerId = assignedSellerId ? assignedSellerId : verifiedSellerIds.length > 0 ? verifiedSellerIds[created % verifiedSellerIds.length] : null;
          if (sellerId) {
            leadData.salesPerson = { connect: { id: sellerId } };
          }
          try {
            const lead = await context.sudo().query.TechBusinessLead.createOne({
              data: leadData
            });
            await context.sudo().query.TechStatusBusinessLead.createOne({
              data: {
                businessLead: { connect: { id: lead.id } },
                pipelineStatus: PIPELINE_STATUS.DETECTADO,
                opportunityLevel: placeRating >= 4.5 ? "Alta" : placeRating >= 4 ? "Media" : "Baja"
              }
            });
            created++;
          } catch (_) {
          }
        }
        nextPageToken = data.next_page_token;
      } while (nextPageToken && created + alreadyInDb + skippedLowRating < maxResults);
      return {
        success: true,
        message: `Sincronizaci\xF3n completada. Creados: ${created}. Ya en BD: ${alreadyInDb}. Descartados (rating < ${MIN_RATING2} o rese\xF1as < ${MIN_REVIEWS2}): ${skippedLowRating}.`,
        created,
        alreadyInDb,
        skippedLowRating
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error en sincronizaci\xF3n",
        created,
        alreadyInDb,
        skippedLowRating
      };
    }
  }
};
var syncBusinessLeadsFromGoogle_default = { typeDefs: typeDefs7, definition: definition7, resolver: resolver7 };

// models/Saas/SaasSubscriptionLog/constants.ts
var SAAS_SUBSCRIPTION_LOG_STEP = {
  STRIPE_KEY_MISSING: "STRIPE_KEY_MISSING",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  NO_COMPANY: "NO_COMPANY",
  NO_PLAN_RESOLVED: "NO_PLAN_RESOLVED",
  NO_STRIPE_PRICE_ID: "NO_STRIPE_PRICE_ID",
  TOTAL_MISMATCH: "TOTAL_MISMATCH",
  PAYMENT_METHOD_NOT_FOUND: "PAYMENT_METHOD_NOT_FOUND",
  SUCCESS: "SUCCESS",
  STRIPE_OR_SERVER_ERROR: "STRIPE_OR_SERVER_ERROR"
};

// utils/saas/saasSubscriptionLogWrite.ts
function maskEmail2(email) {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 2) return `**@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}
async function writeSaasSubscriptionLog(context, params) {
  try {
    const durationMs = Date.now() - params.startedAt;
    const responseSnapshot = {
      success: params.success,
      message: params.message,
      subscriptionId: params.subscriptionId,
      paymentId: params.paymentId,
      ...params.extra ?? {}
    };
    await context.sudo().query.SaasSubscriptionLog.createOne({
      data: {
        ...params.userId ? { user: { connect: { id: params.userId } } } : {},
        ...params.companyId ? { company: { connect: { id: params.companyId } } } : {},
        ...params.planId ? { plan: { connect: { id: params.planId } } } : {},
        ...params.createdSubscriptionId ? { createdSubscription: { connect: { id: params.createdSubscriptionId } } } : {},
        success: params.success,
        step: params.step,
        message: params.message,
        responseSnapshot,
        emailMasked: maskEmail2(params.input.email),
        planIdRequested: params.input.planId,
        totalSubmitted: params.input.total,
        paymentMethodIdSubmitted: params.input.paymentMethodId,
        paymentTypeSubmitted: params.input.paymentType,
        durationMs,
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null
      }
    });
  } catch {
  }
}

// graphql/customs/mutations/createCompanySubscription.ts
var typeDefs8 = `
  input CreateCompanySubscriptionInput {
    planId: ID!
    notes: String
    nameCard: String!
    email: String!
    paymentMethodId: String!
    total: String!
    paymentType: String!
    noDuplicatePaymentMethod: Boolean
  }

  type CreateCompanySubscriptionResult {
    success: Boolean!
    message: String!
    subscriptionId: String
    paymentId: String
  }

  type Mutation {
    createCompanySubscription(input: CreateCompanySubscriptionInput!): CreateCompanySubscriptionResult!
  }
`;
var definition8 = `
  createCompanySubscription(input: CreateCompanySubscriptionInput!): CreateCompanySubscriptionResult!
`;
async function createStripeSubscription(params) {
  const subscription = await stripe_default.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    default_payment_method: params.defaultPaymentMethodId,
    payment_behavior: "error_if_incomplete",
    metadata: params.metadata,
    expand: ["latest_invoice"]
  });
  return subscription;
}
var resolver8 = {
  createCompanySubscription: async (_root, {
    input
  }, context) => {
    let stripeSubscriptionId;
    const startedAt = Date.now();
    const logInput = {
      planId: input.planId,
      email: input.email,
      total: input.total,
      paymentMethodId: input.paymentMethodId,
      paymentType: input.paymentType,
      notes: input.notes ?? null
    };
    let logUserId;
    let logCompanyId;
    let logPlanId;
    const finish = async (step, result, opts) => {
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step,
        success: result.success,
        message: result.message,
        subscriptionId: result.subscriptionId,
        paymentId: result.paymentId,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: logPlanId ?? null,
        createdSubscriptionId: opts?.createdSubscriptionId ?? null,
        stripeCustomerId: opts?.stripeCustomerId ?? null,
        stripeSubscriptionId: opts?.stripeSubscriptionId ?? null,
        extra: opts?.extra
      });
      return result;
    };
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_KEY_MISSING, {
          success: false,
          message: "STRIPE_SECRET_KEY no configurada",
          subscriptionId: null,
          paymentId: null
        });
      }
      const user = await context.sudo().query.User.findOne({
        where: { email: input.email.trim() },
        query: "id name email stripeCustomerId referredBy { id } company { id plan { id name cost frequency leadLimit currency planFeatures stripePriceId stripeProductId referralUpfrontCommissionPct referralRecurringCommissionPct } }"
      });
      if (!user) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.USER_NOT_FOUND, {
          success: false,
          message: "Usuario no encontrado con ese email",
          subscriptionId: null,
          paymentId: null
        });
      }
      logUserId = user.id;
      if (!user.stripeCustomerId) {
        const stripeCustomer = await stripe_default.customers.create({
          email: user.email ?? input.email,
          name: user.name ?? input.nameCard,
          metadata: { userId: user.id }
        });
        await context.sudo().query.User.updateOne({
          where: { id: user.id },
          data: { stripeCustomerId: stripeCustomer.id }
        });
        user.stripeCustomerId = stripeCustomer.id;
      }
      const company = user.company;
      if (!company?.id) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_COMPANY, {
          success: false,
          message: "Tu usuario no tiene una empresa asignada",
          subscriptionId: null,
          paymentId: null
        });
      }
      logCompanyId = company.id;
      let plan = company.plan ?? null;
      if (input.planId) {
        const planRecord = await context.sudo().query.SaasPlan.findOne({
          where: { id: input.planId },
          query: "id name cost frequency leadLimit currency planFeatures stripePriceId stripeProductId referralUpfrontCommissionPct referralRecurringCommissionPct"
        });
        plan = planRecord;
      }
      if (!plan?.id) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_PLAN_RESOLVED, {
          success: false,
          message: "Indica un plan (planId) o asigna un plan a la empresa",
          subscriptionId: null,
          paymentId: null
        });
      }
      logPlanId = plan.id;
      const stripePriceId = plan.stripePriceId ?? null;
      if (!stripePriceId || typeof stripePriceId !== "string") {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_STRIPE_PRICE_ID, {
          success: false,
          message: "El plan no tiene un Stripe Price ID configurado. Crea un Price recurrente en Stripe y asigna stripePriceId al plan.",
          subscriptionId: null,
          paymentId: null
        });
      }
      const planCost = plan.cost ?? 0;
      const roundedTotalBack = parseFloat(Number(planCost).toFixed(2));
      const roundedTotalFront = parseFloat(Number(input.total).toFixed(2));
      const difference = Math.abs(roundedTotalFront - roundedTotalBack);
      if (difference > 0.01) {
        return await finish(
          SAAS_SUBSCRIPTION_LOG_STEP.TOTAL_MISMATCH,
          {
            success: false,
            message: `El total no coincide con el plan. Esperado: ${roundedTotalBack}, recibido: ${roundedTotalFront}. Recarga la p\xE1gina e intenta de nuevo.`,
            subscriptionId: null,
            paymentId: null
          },
          {
            extra: {
              expectedTotal: roundedTotalBack,
              receivedTotal: roundedTotalFront
            }
          }
        );
      }
      const paymentMethod = await context.sudo().query.SaasPaymentMethod.findOne({
        where: { id: input.paymentMethodId },
        query: "id stripePaymentMethodId"
      });
      if (!paymentMethod?.stripePaymentMethodId) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND, {
          success: false,
          message: "M\xE9todo de pago no encontrado",
          subscriptionId: null,
          paymentId: null
        });
      }
      try {
        await stripe_default.paymentMethods.attach(paymentMethod.stripePaymentMethodId, {
          customer: user.stripeCustomerId
        });
      } catch (attachErr) {
        const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
        if (!msg.toLowerCase().includes("already been attached")) throw attachErr;
      }
      await stripe_default.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripePaymentMethodId
        }
      });
      const existingSubs = await context.sudo().query.SaasCompanySubscription.findMany({
        where: {
          company: { id: { equals: company.id } },
          status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] }
        },
        query: "id stripeSubscriptionId planCost"
      });
      const hadPreviousActiveSubscription = existingSubs.some(
        (sub) => sub.planCost != null && sub.planCost > 0
      );
      for (const prev of existingSubs) {
        if (prev.stripeSubscriptionId) {
          await stripe_default.subscriptions.cancel(prev.stripeSubscriptionId);
        }
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: prev.id },
          data: { status: SUBSCRIPTION_STATUS.CANCELLED }
        });
        const pendingCommissions = await context.sudo().query.SaasReferralCommission.findMany({
          where: {
            subscription: { id: { equals: prev.id } },
            status: { equals: "PENDING" }
          },
          query: "id"
        });
        for (const commission of pendingCommissions) {
          await context.sudo().query.SaasReferralCommission.updateOne({
            where: { id: commission.id },
            data: {
              status: "CANCELLED",
              notes: "Comisi\xF3n cancelada por cambio de plan: la suscripci\xF3n fue cancelada."
            }
          });
        }
      }
      const stripeSubscription = await createStripeSubscription({
        customerId: user.stripeCustomerId,
        priceId: stripePriceId,
        defaultPaymentMethodId: paymentMethod.stripePaymentMethodId,
        metadata: { companyId: company.id, planId: plan.id }
      });
      stripeSubscriptionId = stripeSubscription.id;
      const subStatus = stripeSubscription.status ?? "active";
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      let periodEnd;
      let periodEndSource = "today_missing_end";
      if (stripeSubscription.current_period_end && typeof stripeSubscription.current_period_end === "number") {
        periodEnd = new Date(stripeSubscription.current_period_end * 1e3).toISOString().slice(0, 10);
        periodEndSource = "stripe";
      } else {
        periodEnd = today;
      }
      let fallbackBranch = null;
      if (periodEnd <= today) {
        const [y, m, day] = today.split("-").map(Number);
        const d = new Date(y, m - 1, day);
        const freq = (plan.frequency ?? "").toLowerCase();
        if (freq === PLAN_FREQUENCY.ANNUAL) {
          d.setFullYear(d.getFullYear() + 1);
          fallbackBranch = "annual";
        } else if (freq === PLAN_FREQUENCY.WEEKLY) {
          d.setDate(d.getDate() + 7);
          fallbackBranch = "weekly";
        } else {
          d.setMonth(d.getMonth() + 1);
          fallbackBranch = "monthly_default";
        }
        periodEnd = d.toISOString().slice(0, 10);
      }
      const subscription = await context.sudo().query.SaasCompanySubscription.createOne({
        data: {
          company: { connect: { id: company.id } },
          planName: plan.name ?? "",
          planCost,
          planFrequency: plan.frequency ?? "",
          planLeadLimit: plan.leadLimit ?? 0,
          planCurrency: plan.currency ?? "",
          planStripePriceId: stripePriceId,
          planFeatures: plan.planFeatures ?? void 0,
          status: subStatus === "active" || subStatus === "trialing" ? SUBSCRIPTION_STATUS.ACTIVE : subStatus,
          activatedAt: today,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: user.stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscription.id
        },
        query: "id"
      });
      const subscriptionId = subscription?.id;
      const referrer = user.referredBy;
      const upfrontPct = plan.referralUpfrontCommissionPct ?? 0;
      const recurringPct = plan.referralRecurringCommissionPct ?? 0;
      if (!hadPreviousActiveSubscription && referrer && (upfrontPct > 0 || recurringPct > 0) && subscriptionId) {
        const baseCost = planCost;
        const currency = plan.currency ?? "mxn";
        const [actYear, actMonth, actDay] = today.split("-").map(Number);
        const activationDate = new Date(actYear, actMonth - 1, actDay);
        const addMonths = (date, months) => {
          const d = new Date(date);
          d.setMonth(d.getMonth() + months);
          return d;
        };
        if (upfrontPct > 0) {
          const upfrontAmount = Math.round(baseCost * (upfrontPct / 100));
          await context.sudo().query.SaasReferralCommission.createOne({
            data: {
              referrer: { connect: { id: referrer.id } },
              referredUser: { connect: { id: user.id } },
              company: { connect: { id: company.id } },
              subscription: { connect: { id: subscriptionId } },
              plan: { connect: { id: plan.id } },
              type: "UPFRONT",
              percentage: upfrontPct,
              amount: upfrontAmount,
              currency,
              periodIndex: 0,
              periodStart: today,
              periodEnd: today,
              status: "PENDING"
            }
          });
        }
        if (recurringPct > 0) {
          const recurringAmount = Math.round(baseCost * (recurringPct / 100));
          const monthsToGenerate = 12;
          for (let i = 1; i <= monthsToGenerate; i++) {
            const periodStartDate = addMonths(activationDate, i - 1);
            const periodEndDate = addMonths(activationDate, i);
            const periodStartStr = periodStartDate.toISOString().slice(0, 10);
            const periodEndPlus5 = new Date(periodEndDate);
            periodEndPlus5.setDate(periodEndPlus5.getDate() + 5);
            const periodEndStr = periodEndPlus5.toISOString().slice(0, 10);
            await context.sudo().query.SaasReferralCommission.createOne({
              data: {
                referrer: { connect: { id: referrer.id } },
                referredUser: { connect: { id: user.id } },
                company: { connect: { id: company.id } },
                subscription: { connect: { id: subscriptionId } },
                plan: { connect: { id: plan.id } },
                type: "RECURRING",
                percentage: recurringPct,
                amount: recurringAmount,
                currency,
                periodIndex: i,
                periodStart: periodStartStr,
                periodEnd: periodEndStr,
                status: "PENDING"
              }
            });
          }
        }
      }
      await context.sudo().query.SaasCompany.updateOne({
        where: { id: company.id },
        data: { plan: { connect: { id: plan.id } } }
      });
      return await finish(
        SAAS_SUBSCRIPTION_LOG_STEP.SUCCESS,
        {
          success: true,
          message: "Suscripci\xF3n creada correctamente. El cobro recurrente usar\xE1 el m\xE9todo de pago guardado.",
          subscriptionId: subscriptionId ?? null,
          paymentId: null
        },
        {
          createdSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: user.stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscriptionId ?? null
        }
      );
    } catch (e) {
      if (stripeSubscriptionId) {
        try {
          await stripe_default.subscriptions.cancel(stripeSubscriptionId);
        } catch (_) {
        }
      }
      const message = e instanceof Error ? e.message : "Error de comunicaci\xF3n con el servidor. Intenta de nuevo.";
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step: SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
        success: false,
        message,
        subscriptionId: null,
        paymentId: null,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: logPlanId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        extra: {
          errorName: e instanceof Error ? e.name : "unknown"
        }
      });
      return {
        success: false,
        message,
        subscriptionId: null,
        paymentId: null
      };
    }
  }
};
var createCompanySubscription_default = { typeDefs: typeDefs8, definition: definition8, resolver: resolver8 };

// graphql/customs/mutations/addOwnLead.ts
var ADD_OWN_LEADS_FEATURE_KEY = "add_own_leads";
function subscriptionHasFeature(planFeatures, featureKey) {
  if (!Array.isArray(planFeatures)) return false;
  return planFeatures.some((f) => f.key === featureKey);
}
var typeDefs9 = `
  input AddOwnLeadInput {
    businessName: String!
    category: String
    phone: String
    address: String
    city: String
    state: String
    country: String
    email: String
    websiteUrl: String
    instagram: String
    facebook: String
    xTwitter: String
    tiktok: String
    lat: Float
    lng: Float
    source: String
    notes: String
    opportunityLevel: String
    topReview1: String
    topReview2: String
    topReview3: String
    topReview4: String
    topReview5: String
  }

  type AddOwnLeadResult {
    success: Boolean!
    message: String!
    leadId: String
  }

  type Mutation {
    addOwnLead(input: AddOwnLeadInput!): AddOwnLeadResult!
  }
`;
var definition9 = `
  addOwnLead(input: AddOwnLeadInput!): AddOwnLeadResult!
`;
var resolver9 = {
  addOwnLead: async (_root, {
    input
  }, context) => {
    const session2 = context.session;
    const userId = session2?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesi\xF3n para agregar leads",
        leadId: null
      };
    }
    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }"
    });
    const company = user?.company;
    if (!company?.id) {
      return {
        success: false,
        message: "Tu usuario no tiene una empresa asignada",
        leadId: null
      };
    }
    const [activeSubscription] = await context.sudo().query.SaasCompanySubscription.findMany({
      where: {
        company: { id: { equals: company.id } },
        status: {
          in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING]
        }
      },
      orderBy: [{ activatedAt: "desc" }],
      take: 1,
      query: "id planFeatures"
    });
    if (!activeSubscription) {
      return {
        success: false,
        message: `"${company.name ?? "La empresa"}" no tiene una suscripci\xF3n activa.`,
        leadId: null
      };
    }
    const sub = activeSubscription;
    if (!subscriptionHasFeature(sub.planFeatures, ADD_OWN_LEADS_FEATURE_KEY)) {
      return {
        success: false,
        message: "Tu plan actual no incluye la funcionalidad de agregar leads propios. Actualiza tu suscripci\xF3n para desbloquear esta funci\xF3n.",
        leadId: null
      };
    }
    const validSources = Object.values(LEAD_SOURCE);
    const source = input.source && validSources.includes(input.source) ? input.source : LEAD_SOURCE.OTRO;
    try {
      const newLead = await context.sudo().query.TechBusinessLead.createOne({
        data: {
          businessName: input.businessName,
          category: input.category ?? "",
          phone: input.phone ?? "",
          email: input.email ?? "",
          address: input.address ?? "",
          city: input.city ?? "",
          state: input.state ?? "",
          country: input.country ?? "",
          hasWebsite: !!input.websiteUrl,
          websiteUrl: input.websiteUrl ?? "",
          instagram: input.instagram ?? "",
          facebook: input.facebook ?? "",
          xTwitter: input.xTwitter ?? "",
          tiktok: input.tiktok ?? "",
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          source,
          topReview1: input.topReview1 ?? "",
          topReview2: input.topReview2 ?? "",
          topReview3: input.topReview3 ?? "",
          topReview4: input.topReview4 ?? "",
          topReview5: input.topReview5 ?? "",
          saasCompany: { connect: { id: company.id } },
          salesPerson: { connect: { id: userId } }
        }
      });
      await context.sudo().query.TechStatusBusinessLead.createOne({
        data: {
          businessLead: { connect: { id: newLead.id } },
          saasCompany: { connect: { id: company.id } },
          salesPerson: { connect: { id: userId } },
          pipelineStatus: PIPELINE_STATUS.DETECTADO,
          opportunityLevel: ["Alta", "Media", "Baja"].includes(input.opportunityLevel ?? "") ? input.opportunityLevel : "Media",
          notes: input.notes ?? ""
        }
      });
      return {
        success: true,
        message: "Lead agregado exitosamente",
        leadId: newLead.id
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error al crear el lead",
        leadId: null
      };
    }
  }
};
var addOwnLead_default = { typeDefs: typeDefs9, definition: definition9, resolver: resolver9 };

// graphql/customs/mutations/index.ts
var customMutation = {
  typeDefs: `
    ${customAuth_default.typeDefs}
    ${authenticateUserWithGoogle_default.typeDefs}
    ${registerUser_default.typeDefs}
    ${importPetPlace_default.typeDefs}
    ${importBusinessLeadFromGoogle_default.typeDefs}
    ${syncBusinessLeadsFromGoogle_default.typeDefs}
    ${syncLeadsFront_default.typeDefs}
    ${createCompanySubscription_default.typeDefs}
    ${addOwnLead_default.typeDefs}
  `,
  definitions: `
    ${customAuth_default.definition}
    ${authenticateUserWithGoogle_default.definition}
    ${registerUser_default.definition}
    ${importPetPlace_default.definition}
    ${importBusinessLeadFromGoogle_default.definition}
    ${syncBusinessLeadsFromGoogle_default.definition}
    ${syncLeadsFront_default.definition}
    ${createCompanySubscription_default.definition}
    ${addOwnLead_default.definition}
  `,
  resolvers: {
    ...customAuth_default.resolver,
    ...authenticateUserWithGoogle_default.resolver,
    ...registerUser_default.resolver,
    ...importPetPlace_default.resolver,
    ...importBusinessLeadFromGoogle_default.resolver,
    ...syncBusinessLeadsFromGoogle_default.resolver,
    ...syncLeadsFront_default.resolver,
    ...createCompanySubscription_default.resolver,
    ...addOwnLead_default.resolver
  },
  extraResolvers: {
    AuthenticateUserWithGoogleResult: {
      __resolveType: (obj) => obj.__typename ?? null
    }
  }
};
var mutations_default = customMutation;

// graphql/customs/queries/nearbyAnimals.ts
var typeDefs10 = `
  type AnimalMultimediaImage {
    id: ID!
    url: String
  }

  type NearbyAnimalUser {
    name: String
    profileImage: NearbyAnimalUserProfileImage
  }

  type NearbyAnimalUserProfileImage {
    url: String
  }

  type NearbyAnimal {
    id: ID!
    name: String
    sex: String
    distance: Float
    status: String
    lat: String
    lng: String
    address: String
    city: String
    state: String
    country: String
    animal_type: AnimalType
    animal_breed: AnimalBreed
    user: NearbyAnimalUser
    multimedia: [AnimalMultimediaImage]
    createdAt: String
  }

  type NearbyAnimalsResult {
    success: Boolean!
    message: String!
    animals: [NearbyAnimal!]
    total: Int!
  }

  input NearbyAnimalsInput {
    lat: Float
    lng: Float
    limit: Int = 10
    skip: Int = 0
    radius: Float = 10
    animalType: ID
    status: String
    breed: ID
    location: String
  }

  type Query {
    getNearbyAnimals(input: NearbyAnimalsInput!): NearbyAnimalsResult!
  }
`;
var definition10 = `
  getNearbyAnimals(input: NearbyAnimalsInput!): NearbyAnimalsResult!
`;
function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");
  return `${month}/${day}/${year}, ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}
async function getLatestAnimalLogs(animalIds, context) {
  if (animalIds.length === 0) {
    return /* @__PURE__ */ new Map();
  }
  const logs = await context.sudo().query.AnimalLog.findMany({
    where: { animal: { id: { in: animalIds } } },
    orderBy: { createdAt: "desc" },
    query: `
      id
      status
      lat
      lng
      address
      city
      state
      country
      createdAt
      animal {
        id
      }
    `
  });
  const latestLogsMap = /* @__PURE__ */ new Map();
  const seenAnimals = /* @__PURE__ */ new Set();
  for (const log of logs) {
    const animalId = log.animal?.id;
    if (animalId && !seenAnimals.has(animalId)) {
      latestLogsMap.set(animalId, log);
      seenAnimals.add(animalId);
    }
  }
  return latestLogsMap;
}
var resolver10 = {
  getNearbyAnimals: async (root, {
    input
  }, context) => {
    const {
      lat,
      lng,
      limit = 10,
      skip = 0,
      radius = 10,
      animalType,
      status,
      breed,
      location
    } = input;
    const animalWhere = {};
    if (animalType) {
      animalWhere.animal_type = { id: { equals: animalType } };
    }
    if (breed) {
      animalWhere.animal_breed = { id: { equals: breed } };
    }
    const animals = await context.sudo().query.Animal.findMany({
      where: animalWhere,
      query: `
        id
        name
        sex
        animal_type {
          id
          name
        }
        animal_breed {
          id
          breed
        }
        user {
          name
          profileImage {
            url
          }
        }
        createdAt
      `
    });
    const animalIds = animals.map((a) => a.id);
    const latestLogsMap = await getLatestAnimalLogs(animalIds, context);
    const processedAnimals = [];
    for (const animal of animals) {
      const latestLog = latestLogsMap.get(animal.id);
      if (!latestLog) {
        continue;
      }
      if (status && latestLog.status !== status) {
        continue;
      }
      if (location) {
        const searchTerm = location.toLowerCase();
        const cityMatch = latestLog.city?.toLowerCase().includes(searchTerm) || false;
        const stateMatch = latestLog.state?.toLowerCase().includes(searchTerm) || false;
        const countryMatch = latestLog.country?.toLowerCase().includes(searchTerm) || false;
        const addressMatch = latestLog.address?.toLowerCase().includes(searchTerm) || false;
        if (!cityMatch && !stateMatch && !countryMatch && !addressMatch) {
          continue;
        }
      }
      let distance = null;
      if (lat !== void 0 && lng !== void 0 && latestLog.lat && latestLog.lng) {
        const logLat = parseFloat(latestLog.lat);
        const logLng = parseFloat(latestLog.lng);
        if (!isNaN(logLat) && !isNaN(logLng)) {
          distance = haversineDistance(lat, lng, logLat, logLng);
        }
      }
      if (lat !== void 0 && lng !== void 0) {
        if (distance === null || distance > radius) {
          continue;
        }
      }
      const userObj = animal.user ? {
        name: animal.user.name,
        profileImage: animal.user.profileImage ? {
          url: animal.user.profileImage.url
        } : null
      } : null;
      processedAnimals.push({
        ...animal,
        user: userObj,
        createdAt: formatDate(animal.createdAt),
        distance,
        status: latestLog.status,
        lat: latestLog.lat,
        lng: latestLog.lng,
        address: latestLog.address,
        city: latestLog.city,
        state: latestLog.state,
        country: latestLog.country
      });
    }
    if (lat !== void 0 && lng !== void 0) {
      processedAnimals.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    } else {
      processedAnimals.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
    }
    const total = processedAnimals.length;
    const paginatedAnimals = processedAnimals.slice(skip, skip + limit);
    const paginatedAnimalIds = paginatedAnimals.map((a) => a.id);
    const multimediaData = await context.sudo().query.AnimalMultimedia.findMany({
      where: { animal: { id: { in: paginatedAnimalIds } } },
      query: `
        id
        image {
          id
          url
        }
        animal {
          id
        }
      `
    });
    const multimediaByAnimal = /* @__PURE__ */ new Map();
    for (const media of multimediaData) {
      const animalId = media.animal?.id;
      if (animalId) {
        if (!multimediaByAnimal.has(animalId)) {
          multimediaByAnimal.set(animalId, []);
        }
        const imageObj = media.image ? {
          id: media.image.id,
          url: media.image.url
        } : null;
        multimediaByAnimal.get(animalId).push(imageObj);
      }
    }
    const animalsWithMultimedia = paginatedAnimals.map((animal) => ({
      ...animal,
      multimedia: multimediaByAnimal.get(animal.id) || []
    }));
    return {
      success: true,
      message: animalsWithMultimedia.length > 0 ? "Animals found" : "No animals found",
      animals: animalsWithMultimedia,
      total
    };
  }
};
var nearbyAnimals_default = { typeDefs: typeDefs10, definition: definition10, resolver: resolver10 };

// utils/helpers/nearby_petplaces.ts
function convertGoogleTimeToHours(timeString) {
  if (!timeString || timeString.length !== 4) {
    return 0;
  }
  const hours = parseInt(timeString.substring(0, 2), 10);
  return isNaN(hours) ? 0 : hours;
}
function parseAddressComponents4(addressComponents) {
  const result = {
    street: "",
    municipality: "",
    state: "",
    country: "",
    cp: ""
  };
  if (!Array.isArray(addressComponents)) {
    return result;
  }
  let streetNumber = "";
  let route = "";
  for (const component of addressComponents) {
    const types = component.types || [];
    const longName = component.long_name || "";
    if (types.includes("street_number")) {
      streetNumber = longName;
    }
    if (types.includes("route")) {
      route = longName;
    }
    if (types.includes("locality")) {
      result.municipality = longName;
    }
    if (types.includes("administrative_area_level_1")) {
      result.state = longName;
    }
    if (types.includes("country")) {
      result.country = longName;
    }
    if (types.includes("postal_code")) {
      result.cp = longName;
    }
  }
  if (streetNumber && route) {
    result.street = `${streetNumber} ${route}`.trim();
  } else if (streetNumber) {
    result.street = streetNumber;
  } else if (route) {
    result.street = route;
  }
  return result;
}
async function createPetPlaceFromGoogleResult(place, type, apiKey, context) {
  if (!place.name) {
    return null;
  }
  const address = place.formatted_address || "";
  const lat = place.geometry?.location?.lat?.toString() || "";
  const lng = place.geometry?.location?.lng?.toString() || "";
  const rating = place.rating || 0;
  const userRatingsTotal = place.user_ratings_total || 0;
  const placeId = place.place_id || "";
  if (!placeId) {
    return null;
  }
  const addressData = place.address_components ? parseAddressComponents4(place.address_components) : { street: "", municipality: "", state: "", country: "", cp: "" };
  const existingPlace = await context.sudo().query.PetPlace.findOne({
    where: { google_place_id: placeId },
    query: "id"
  });
  if (existingPlace) {
    return null;
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
      console.error(`Type ${type} not found in TYPES_PET_SHELTER`);
      return null;
    }
  }
  const result = await context.sudo().query.PetPlace.createOne({
    data: {
      name: place.name,
      description: `Place located at ${address}. ${rating > 0 ? `Rating: ${rating}/5 (${userRatingsTotal} reviews)` : ""}`,
      types: { connect: [{ id: petPlaceType.id }] },
      phone: "",
      website: "",
      street: addressData.street,
      municipality: addressData.municipality,
      state: addressData.state,
      country: addressData.country,
      cp: addressData.cp,
      lat,
      lng,
      views: 0,
      address,
      google_place_id: placeId
    }
  });
  if (placeId) {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,opening_hours,international_phone_number,address_components&key=${apiKey}&language=es`;
      const detailsResponse = await fetch(detailsUrl);
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        if (detailsData.status === "OK" && detailsData.result) {
          const updateData = {};
          if (detailsData.result.international_phone_number) {
            updateData.phone = detailsData.result.international_phone_number;
          }
          if (detailsData.result.address_components) {
            const addressData2 = parseAddressComponents4(detailsData.result.address_components);
            if (addressData2.street) updateData.street = addressData2.street;
            if (addressData2.municipality) updateData.municipality = addressData2.municipality;
            if (addressData2.state) updateData.state = addressData2.state;
            if (addressData2.country) updateData.country = addressData2.country;
            if (addressData2.cp) updateData.cp = addressData2.cp;
          }
          if (detailsData.result.opening_hours && Array.isArray(detailsData.result.opening_hours.weekday_text)) {
            updateData.google_opening_hours = detailsData.result.opening_hours.weekday_text.join("\n");
          }
          if (Object.keys(updateData).length > 0) {
            await context.sudo().query.PetPlace.updateOne({
              where: { id: result.id },
              data: updateData
            });
          }
          if (detailsData.result.opening_hours && Array.isArray(detailsData.result.opening_hours.periods)) {
            for (const period of detailsData.result.opening_hours.periods) {
              try {
                if (period.open && period.close) {
                  const day = period.open.day;
                  const openTime = convertGoogleTimeToHours(period.open.time);
                  const closeTime = convertGoogleTimeToHours(period.close.time);
                  const dayName = dayNames[day];
                  if (dayName) {
                    await context.sudo().query.Schedule.createOne({
                      data: {
                        day: dayName,
                        timeIni: openTime,
                        timeEnd: closeTime,
                        pet_place: { connect: { id: result.id } }
                      }
                    });
                  }
                }
              } catch (scheduleError) {
                console.error(`Error saving schedule for ${place.name}:`, scheduleError);
              }
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
                console.error(`Error saving review for ${place.name}:`, reviewError);
              }
            }
          }
        }
      }
    } catch (detailsError) {
      console.error(`Error getting details for ${place.name}:`, detailsError);
    }
  }
  return result;
}
async function searchPlacesByLocation(lat, lng, type, radius, limit, context) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured in environment variables");
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
  const radiusInMeters = Math.round(radius * 1e3);
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=${encodeURIComponent(searchTerm)}&key=${apiKey}&language=es`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || "Unknown error"}`);
    }
    if (!data.results || data.results.length === 0) {
      return [];
    }
    const createdPlaces = [];
    for (const place of data.results.slice(0, limit)) {
      try {
        const createdPlace = await createPetPlaceFromGoogleResult(place, type, apiKey, context);
        if (createdPlace) {
          createdPlaces.push(createdPlace);
        }
      } catch (error) {
        console.error(`Error creating place ${place.name}:`, error);
      }
    }
    return createdPlaces;
  } catch (error) {
    console.error("Error searching places in Google Places:", error);
    return [];
  }
}
async function getPetPlacesHelper(context, whereClause) {
  return await context.sudo().query.PetPlace.findMany({
    where: whereClause,
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
          pet_place_ads { id }
          google_place_id
          google_opening_hours
          reviewsCount
          averageRating
          createdAt
        `
  });
}

// graphql/customs/queries/nearbyPetPlaces.ts
var typeDefs11 = `
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
    reviewsCount: Int
    averageRating: Float
  }

  type NearbyPetPlacesResult {
    success: Boolean!
    message: String!
    petPlaces: [NearbyPetPlace!]
  }

  input NearbyPetPlacesInput {
    lat: Float
    lng: Float
    limit: Int = 10
    radius: Float = 10
    type: String
  }

  type Query {
    getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
  }
`;
var definition11 = `
  getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
`;
var resolver11 = {
  getNearbyPetPlaces: async (root, { input }, context) => {
    const { lat, lng, limit = 10, radius = 10, type } = input;
    if (lat === void 0 || lat === null || lng === void 0 || lng === null) {
      const searchType2 = type || "veterinary";
      const seedRadius = 15;
      const feedLimit = 20;
      try {
        await searchPlacesByLocation(
          PET_PLACES_SEED_LOCATION.lat,
          PET_PLACES_SEED_LOCATION.lng,
          searchType2,
          seedRadius,
          feedLimit,
          context
        );
      } catch (err) {
        console.error("Error alimentando BD desde Google (Caso A):", err);
      }
      const whereClause = {};
      if (type) {
        const petPlaceType = await context.sudo().query.PetPlaceType.findOne({
          where: { value: type },
          query: "id"
        });
        if (petPlaceType) {
          whereClause.types = {
            some: { id: { equals: petPlaceType.id } }
          };
        }
      }
      const petPlaces2 = await getPetPlacesHelper(context, whereClause);
      const sortedPlaces = [...petPlaces2].sort((a, b) => {
        const ratingA = a.averageRating || 0;
        const ratingB = b.averageRating || 0;
        return ratingB - ratingA;
      });
      const result2 = sortedPlaces.slice(0, limit).map((place) => ({
        ...place,
        pet_place_reviews: place.pet_place_reviews ?? [],
        distance: null
        // No distance when lat/lng not provided
      }));
      return {
        success: true,
        message: result2.length > 0 ? "PetPlaces found" : "No PetPlaces found",
        petPlaces: result2
      };
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        success: false,
        message: "Invalid latitude and longitude",
        petPlaces: []
      };
    }
    const searchType = type || "veterinary";
    try {
      await searchPlacesByLocation(lat, lng, searchType, radius, limit, context);
    } catch (err) {
      console.error("Error alimentando BD desde Google (Caso C):", err);
    }
    const petPlaces = await getPetPlacesHelper(context, {});
    const withDistance = petPlaces.map((place) => {
      const placeLat = parseFloat(place.lat);
      const placeLng = parseFloat(place.lng);
      if (isNaN(placeLat) || isNaN(placeLng)) return null;
      const distance = haversineDistance(lat, lng, placeLat, placeLng);
      return { ...place, distance };
    }).filter((place) => place && place.distance <= radius);
    withDistance.sort((a, b) => a.distance - b.distance);
    const result = withDistance.slice(0, limit).map((place) => ({
      ...place,
      pet_place_reviews: place.pet_place_reviews ?? []
    }));
    return {
      success: true,
      message: result.length > 0 ? "PetPlaces found" : "No PetPlaces found",
      petPlaces: result
    };
  }
};
var nearbyPetPlaces_default = { typeDefs: typeDefs11, definition: definition11, resolver: resolver11 };

// graphql/customs/queries/saas/stripePaymentMethods.ts
var typeDefs12 = `
  type StripeCard {
    brand: String
    country: String
    exp_month: Int
    exp_year: Int
    last4: String
  }

  type StripePaymentMethod {
    id: String
    object: String
    customer: String
    type: String
    card: StripeCard
    created: Int
    livemode: Boolean
    metadata: JSON
  }

  type StripePaymentMethodsData {
    data: [StripePaymentMethod]
  }

  type StripePaymentMethodsType {
    message: String,
    success: Boolean,
    data: StripePaymentMethodsData
  }

  type Query {
    StripePaymentMethods(email: String!): StripePaymentMethodsType
  }
`;
var definition12 = `
  StripePaymentMethods(email: String!): StripePaymentMethodsType
`;
var resolver12 = {
  StripePaymentMethods: async (_root, { email }, context) => {
    const user = await context.query.User.findOne({
      where: { email },
      query: "id name stripeCustomerId"
    });
    const stripeCustomerId = user?.stripeCustomerId;
    if (!stripeCustomerId) {
      return {
        message: "Missing stripe customer id",
        success: false,
        data: { data: [] }
      };
    }
    try {
      const paymentMethods = await stripe_default.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card"
      });
      return {
        message: "",
        success: true,
        data: {
          data: paymentMethods.data
        }
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        message,
        success: false,
        data: { data: [] }
      };
    }
  }
};
var stripePaymentMethods_default = { typeDefs: typeDefs12, definition: definition12, resolver: resolver12 };

// utils/saas/stripeSubscription.ts
var STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
async function getStripeSubscription(subscriptionId) {
  if (!STRIPE_SECRET) {
    return { status: null, currentPeriodEnd: null, active: false };
  }
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          Accept: "application/json"
        }
      }
    );
    if (!res.ok) return { status: null, currentPeriodEnd: null, active: false };
    const data = await res.json();
    const status = data.status ?? null;
    const active = status === "active" || status === "trialing";
    return {
      status,
      currentPeriodEnd: data.current_period_end ?? null,
      active
    };
  } catch {
    return { status: null, currentPeriodEnd: null, active: false };
  }
}

// graphql/customs/queries/saas/subscriptionStatus.ts
function stripeStatusToLocal(stripeStatus) {
  if (!stripeStatus) return SUBSCRIPTION_STATUS.CANCELLED;
  const s = stripeStatus.toLowerCase();
  if (s === "active") return SUBSCRIPTION_STATUS.ACTIVE;
  if (s === "trialing") return SUBSCRIPTION_STATUS.TRIALING;
  if (s === "past_due") return SUBSCRIPTION_STATUS.PAST_DUE;
  if (s === "canceled" || s === "cancelled") return SUBSCRIPTION_STATUS.CANCELLED;
  if (s === "unpaid") return SUBSCRIPTION_STATUS.UNPAID;
  return s;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  const now = /* @__PURE__ */ new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diffMs = endOfDay.getTime() - startOfToday.getTime();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1e3));
  return days < 0 ? 0 : days;
}
var typeDefs13 = `
  type SubscriptionData {
    id: ID
    activatedAt: String
    planCost: Float
    planCurrency: String
    planFrequency: String
    planLeadLimit: Int
    planName: String
    planFeatures: JSON
    status: String
    stripeCustomerId: String
    stripeSubscriptionId: String
    currentPeriodEnd: String
  }

  type SubscriptionStatusResult {
    success: Boolean!
    message: String
    daysUntilNextBilling: Int
    subscriptionActive: Boolean
    subscription: SubscriptionData
  }

  type Query {
    subscriptionStatus(companyId: ID): SubscriptionStatusResult
  }
`;
var definition13 = `
  subscriptionStatus(companyId: ID): SubscriptionStatusResult
`;
var resolver13 = {
  subscriptionStatus: async (_root, { companyId }, context) => {
    const session2 = context.session;
    const userId = session2?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesi\xF3n para ver el estado de la suscripci\xF3n",
        daysUntilNextBilling: null,
        subscriptionActive: false,
        subscription: null
      };
    }
    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }"
    });
    const userCompany = user?.company;
    const companyIdToUse = companyId ?? userCompany?.id;
    if (!companyIdToUse) {
      return {
        success: false,
        message: "No se encontr\xF3 un negocio asignado.",
        daysUntilNextBilling: null,
        subscriptionActive: false,
        subscription: null
      };
    }
    const [subscription] = await context.sudo().query.SaasCompanySubscription.findMany({
      where: {
        company: { id: { equals: companyIdToUse } },
        status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] }
      },
      orderBy: [{ activatedAt: "desc" }],
      take: 1,
      query: "id status activatedAt currentPeriodEnd planCost planCurrency planFrequency planLeadLimit planName planFeatures stripeCustomerId stripeSubscriptionId"
    });
    if (!subscription) {
      return {
        success: true,
        message: "Tu negocio no tiene una suscripci\xF3n activa. Contrata o activa una suscripci\xF3n para poder obtener m\xE1s clientes.",
        daysUntilNextBilling: null,
        subscriptionActive: false,
        subscription: null
      };
    }
    const sub = subscription;
    const isFreePlan = sub.planCost != null && sub.planCost <= 0;
    let newStatus = sub.status;
    let periodEnd = sub.currentPeriodEnd;
    let subscriptionActive = false;
    if (sub.stripeSubscriptionId) {
      const stripeInfo = await getStripeSubscription(sub.stripeSubscriptionId);
      subscriptionActive = stripeInfo.active;
      if (stripeInfo.currentPeriodEnd) {
        periodEnd = new Date(stripeInfo.currentPeriodEnd * 1e3).toISOString().slice(0, 10);
      }
      const mappedStatus = stripeStatusToLocal(stripeInfo.status);
      if (mappedStatus !== sub.status) {
        newStatus = mappedStatus;
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: sub.id },
          data: {
            status: newStatus,
            ...periodEnd ? { currentPeriodEnd: periodEnd } : {}
          }
        });
        if (newStatus === SUBSCRIPTION_STATUS.CANCELLED || newStatus === SUBSCRIPTION_STATUS.UNPAID || newStatus === SUBSCRIPTION_STATUS.PAST_DUE) {
          const pendingCommissions = await context.sudo().query.SaasReferralCommission.findMany({
            where: {
              subscription: { id: { equals: sub.id } },
              status: { equals: "PENDING" }
            },
            query: "id"
          });
          for (const commission of pendingCommissions) {
            await context.sudo().query.SaasReferralCommission.updateOne({
              where: { id: commission.id },
              data: {
                status: "CANCELLED",
                notes: "Comisi\xF3n cancelada porque el cliente cancel\xF3 o dej\xF3 de pagar la suscripci\xF3n."
              }
            });
          }
        }
      }
    } else if (isFreePlan && sub.activatedAt) {
      const { trialEnd: trialEndStr, isExpired } = getFreePlanTrialInfo(
        sub.activatedAt
      );
      if (!trialEndStr) {
        periodEnd = null;
        subscriptionActive = false;
      } else if (isExpired) {
        newStatus = SUBSCRIPTION_STATUS.PAST_DUE;
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: sub.id },
          data: { status: newStatus }
        });
        periodEnd = trialEndStr;
        subscriptionActive = false;
      } else {
        periodEnd = trialEndStr;
        subscriptionActive = true;
      }
    } else {
      subscriptionActive = newStatus === SUBSCRIPTION_STATUS.ACTIVE || newStatus === SUBSCRIPTION_STATUS.TRIALING;
    }
    const daysUntilNextBilling = periodEnd ? daysUntil(periodEnd) : null;
    const subscriptionData = {
      id: sub.id,
      activatedAt: sub.activatedAt,
      planCost: sub.planCost,
      planCurrency: sub.planCurrency,
      planFrequency: sub.planFrequency,
      planLeadLimit: sub.planLeadLimit,
      planName: sub.planName,
      planFeatures: sub.planFeatures,
      status: newStatus,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      currentPeriodEnd: periodEnd
    };
    return {
      success: true,
      message: null,
      daysUntilNextBilling,
      subscriptionActive,
      subscription: subscriptionData
    };
  }
};
var subscriptionStatus_default = { typeDefs: typeDefs13, definition: definition13, resolver: resolver13 };

// graphql/customs/queries/index.ts
var customQuery = {
  typeDefs: `
    ${nearbyAnimals_default.typeDefs}
    ${nearbyPetPlaces_default.typeDefs}
    ${stripePaymentMethods_default.typeDefs}
    ${subscriptionStatus_default.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals_default.definition}
    ${nearbyPetPlaces_default.definition}
    ${stripePaymentMethods_default.definition}
    ${subscriptionStatus_default.definition}
  `,
  resolvers: {
    ...nearbyAnimals_default.resolver,
    ...nearbyPetPlaces_default.resolver,
    ...stripePaymentMethods_default.resolver,
    ...subscriptionStatus_default.resolver
  }
};
var queries_default = customQuery;

// graphql/extendedSchema.ts
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: `
      ${mutations_default.typeDefs}
      ${queries_default.typeDefs}
      type Mutation {
        ${mutations_default.definitions}
      }
      type Query {
        ${queries_default.definitions}
      }
    `,
    resolvers: {
      Mutation: {
        ...mutations_default.resolvers
      },
      Query: {
        ...queries_default.resolvers
      },
      ...mutations_default.extraResolvers ?? {}
    }
  });
}

// keystone.ts
var path2 = require("path");
var dotenv2 = require("dotenv");
dotenv2.config({ path: path2.resolve(process.cwd(), "config", ".env.dev") });
var {
  S3_BUCKET_NAME: bucketName = "",
  S3_REGION: region = "",
  S3_ACCESS_KEY_ID: accessKeyId = "",
  S3_SECRET_ACCESS_KEY: secretAccessKey = ""
} = process.env;
var hasS3 = !!(region && bucketName);
var storage = {
  my_local_images: {
    kind: "local",
    type: "image",
    generateUrl: (path3) => `http://${process.env.DB_HOST}:3000/images${path3}`,
    serverRoute: { path: "/images" },
    storagePath: "public/images"
  },
  ...hasS3 ? {
    s3_files: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, signed: { expiry: 3600 } },
    s3_categories: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/categories/" : "categories/", signed: { expiry: 3600 } },
    s3_posts: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/posts/" : "posts/", signed: { expiry: 3600 } },
    s3_profile: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/profiles/" : "profiles/", signed: { expiry: 3600 } },
    s3_animals: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/animals/" : "animals/", signed: { expiry: 3600 } },
    s3_pets: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/pets/" : "pets/", signed: { expiry: 3600 } },
    s3_ads: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/ads/" : "ads/", signed: { expiry: 3600 } },
    s3_tech_files: { kind: "s3", type: "file", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/tech-files/" : "tech-files/", signed: { expiry: 3600 } },
    s3_company_logo: { kind: "s3", type: "file", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/company-logo/" : "company-logo/", signed: { expiry: 3600 } }
  } : {
    s3_files: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_categories: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_posts: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_profile: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_animals: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_pets: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_ads: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
    s3_tech_files: { kind: "local", type: "file", serverRoute: { path: "/files" }, storagePath: "public/files" },
    s3_company_logo: { kind: "local", type: "file", serverRoute: { path: "/images" }, storagePath: "public/images" }
  }
};
var keystone_default = withAuth(
  (0, import_core59.config)({
    db: {
      provider: "postgresql",
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connect_timeout=300`
    },
    ui: {
      isAccessAllowed: (context) => !!context.session?.data
    },
    server: {
      cors: true,
      maxFileSize: 200 * 1024 * 1024,
      port: 3001
    },
    storage,
    graphql: {
      extendGraphqlSchema
    },
    lists: schema_default,
    session
  })
);
//# sourceMappingURL=config.js.map
