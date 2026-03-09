import { KeystoneContext } from "@keystone-6/core/types";
import { PLAN_FREQUENCY } from "../../models/Saas/SaasPlan/constants";

export async function createSaasPlan(
  context: KeystoneContext,
): Promise<string | null> {
  const existing = await context.sudo().query.SaasPlan.findMany({
    query: "id",
  });
  if (existing.length > 0) {
    console.log("♻️  Skipped SaasPlan seeding.");
    return existing[0].id;
  }

  const free = await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Free",
      cost: 0,
      frequency: PLAN_FREQUENCY.MONTHLY,
      leadLimit: 50,
      planFeatures: [
        {
          key: "lead_sync",
          included: true,
          name: "Búsqueda de leads en mapa",
          description: "Búsqueda de leads",
        },
        {
          key: "crm",
          included: true,
          name: "CRM",
          description: "Gestión de leads y ventas",
        },
        {
          key: "edit_lead_data",
          included: true,
          name: "Editar datos del lead",
          description: "Editar datos del lead",
        },
        {
          key: "sales_activities",
          included: true,
          name: "Actividades de ventas",
          description: "Registrar actividades de ventas",
        },
        {
          key: "follow_up_tasks",
          included: true,
          name: "Tareas de seguimiento",
          description: "Crear tareas de seguimiento",
        },
        {
          key: "proposals",
          included: true,
          name: "Propuestas",
          description: "Crear y gestionar propuestas",
        },
        {
          key: "sales_person_management",
          included: true,
          name: "Gestión de vendedores",
          description: "Gestión de vendedores",
        },
        {
          key: "sales_commission",
          included: true,
          name: "Comisión de ventas",
          description: "Configurar comisión de ventas",
        },
        {
          key: "assign_sales_person",
          included: true,
          name: "Asignar vendedor",
          description: "Asignar vendedor al lead",
        },
        {
          key: "calendar_crm",
          included: true,
          name: "Gestión de calendario",
          description:
            "Gestión de propuestas, actividades de ventas y tareas de seguimiento",
        },
      ],
    },
    query: "id",
  });

  await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Starter",
      cost: 499,
      frequency: PLAN_FREQUENCY.MONTHLY,
      leadLimit: 400,
      planFeatures: [
        {
          key: "lead_sync",
          included: true,
          name: "Búsqueda de leads en mapa",
          description: "Búsqueda de leads",
        },
        {
          key: "crm",
          included: true,
          name: "CRM",
          description: "Gestión de leads y ventas",
        },
        {
          key: "edit_lead_data",
          included: true,
          name: "Editar datos del lead",
          description: "Editar datos del lead",
        },
        {
          key: "sales_activities",
          included: true,
          name: "Actividades de ventas",
          description: "Registrar actividades de ventas",
        },
        {
          key: "follow_up_tasks",
          included: true,
          name: "Tareas de seguimiento",
          description: "Crear tareas de seguimiento",
        },
        {
          key: "proposals",
          included: true,
          name: "Propuestas",
          description: "Crear y gestionar propuestas",
        },
        {
          key: "sales_person_management",
          included: true,
          name: "Gestión de vendedores",
          description: "Gestión de vendedores",
        },
        {
          key: "sales_commission",
          included: true,
          name: "Comisión de ventas",
          description: "Configurar comisión de ventas",
        },
        {
          key: "assign_sales_person",
          included: true,
          name: "Asignar vendedor",
          description: "Asignar vendedor al lead",
        },
        {
          key: "calendar_crm",
          included: true,
          name: "Gestión de calendario",
          description:
            "Gestión de propuestas, actividades de ventas y tareas de seguimiento",
        },
      ],
    },
    query: "id",
  });

  await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Pro",
      cost: 999,
      frequency: PLAN_FREQUENCY.MONTHLY,
      leadLimit: 1500,
      planFeatures: [
        {
          key: "lead_sync",
          included: true,
          name: "Búsqueda de leads en mapa",
          description: "Búsqueda de leads",
        },
        {
          key: "crm",
          included: true,
          name: "CRM",
          description: "Gestión de leads y ventas",
        },
        {
          key: "edit_lead_data",
          included: true,
          name: "Editar datos del lead",
          description: "Editar datos del lead",
        },
        {
          key: "sales_activities",
          included: true,
          name: "Actividades de ventas",
          description: "Registrar actividades de ventas",
        },
        {
          key: "follow_up_tasks",
          included: true,
          name: "Tareas de seguimiento",
          description: "Crear tareas de seguimiento",
        },
        {
          key: "proposals",
          included: true,
          name: "Propuestas",
          description: "Crear y gestionar propuestas",
        },
        {
          key: "sales_person_management",
          included: true,
          name: "Gestión de vendedores",
          description: "Gestión de vendedores",
        },
        {
          key: "sales_commission",
          included: true,
          name: "Comisión de ventas",
          description: "Configurar comisión de ventas",
        },
        {
          key: "assign_sales_person",
          included: true,
          name: "Asignar vendedor",
          description: "Asignar vendedor al lead",
        },
        {
          key: "calendar_crm",
          included: true,
          name: "Gestión de calendario",
          description:
            "Gestión de propuestas, actividades de ventas y tareas de seguimiento",
        },
      ],
      bestSeller: true,
    },
    query: "id",
  });

  await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Agencia",
      cost: 1999,
      frequency: PLAN_FREQUENCY.MONTHLY,
      leadLimit: 5000,
      planFeatures: [
        {
          key: "lead_sync",
          included: true,
          name: "Búsqueda de leads en mapa",
          description: "Búsqueda de leads",
        },
        {
          key: "crm",
          included: true,
          name: "CRM",
          description: "Gestión de leads y ventas",
        },
        {
          key: "edit_lead_data",
          included: true,
          name: "Editar datos del lead",
          description: "Editar datos del lead",
        },
        {
          key: "sales_activities",
          included: true,
          name: "Actividades de ventas",
          description: "Registrar actividades de ventas",
        },
        {
          key: "follow_up_tasks",
          included: true,
          name: "Tareas de seguimiento",
          description: "Crear tareas de seguimiento",
        },
        {
          key: "proposals",
          included: true,
          name: "Propuestas",
          description: "Crear y gestionar propuestas",
        },
        {
          key: "sales_person_management",
          included: true,
          name: "Gestión de vendedores",
          description: "Gestión de vendedores",
        },
        {
          key: "sales_commission",
          included: true,
          name: "Comisión de ventas",
          description: "Configurar comisión de ventas",
        },
        {
          key: "assign_sales_person",
          included: true,
          name: "Asignar vendedor",
          description: "Asignar vendedor al lead",
        },
        {
          key: "calendar_crm",
          included: true,
          name: "Gestión de calendario",
          description:
            "Gestión de propuestas, actividades de ventas y tareas de seguimiento",
        },
      ],
    },
    query: "id",
  });

  console.log("✅ SaasPlan seeding complete.");
  return free.id;
}
