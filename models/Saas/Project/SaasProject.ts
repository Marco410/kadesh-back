import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  calendarDay,
  select,
  relationship,
} from "@keystone-6/core/fields";
import { projectAccess } from "./SaasProject.access";
import { PROJECT_STATUS_OPTIONS } from "./SaasProject.constants";

export default list({
  access: projectAccess,
  ui: {
    listView: {
      initialColumns: [
        "name",
        "serviceType",
        "status",
        "responsible",
        "startDate",
        "company",
      ],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre del proyecto" },
    }),
    serviceType: text({
      isIndexed: true,
      ui: {
        description:
          "Tipo de servicio (ej: Desarrollo web, Remodelación, Tratamiento, Campaña marketing)",
      },
    }),
    responsible: relationship({
      ref: "User.projectsResponsible",
      many: false,
      ui: { description: "Responsable del proyecto" },
    }),
    startDate: calendarDay({
      ui: { description: "Fecha de inicio" },
    }),
    estimatedEndDate: calendarDay({
      db: { isNullable: true },
      ui: { description: "Fecha estimada de fin" },
    }),
    description: text({
      ui: {
        displayMode: "textarea",
        description: "Descripción del proyecto o alcance",
      },
    }),
    status: select({
      type: "string",
      options: PROJECT_STATUS_OPTIONS,
      defaultValue: "Pendiente",
      isIndexed: true,
      ui: { description: "Estado del proyecto" },
    }),
    urlData: text({
      ui: { description: "URL de la data del proyecto" },
    }),
    company: relationship({
      ref: "SaasCompany.projects",
      many: false,
      ui: { description: "Empresa a la que pertenece el proyecto" },
    }),
    businessLead: relationship({
      ref: "TechBusinessLead.projects",
      many: false,
      ui: {
        description:
          "Cliente o lead del que surgió este proyecto (venta cerrada)",
      },
    }),
    proposal: relationship({
      ref: "TechProposal.project",
      many: false,
      ui: {
        description: "Propuesta comprada que originó este proyecto (opcional)",
      },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
