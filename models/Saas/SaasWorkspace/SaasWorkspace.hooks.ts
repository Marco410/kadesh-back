const DEFAULT_SEED_ROWS: {
  key: string;
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
}[] = [
  {
    key: "TODO",
    name: "Por Hacer",
    color: "#6B7280",
    order: 1,
    isDefault: true,
  },
  {
    key: "IN_PROGRESS",
    name: "En progreso",
    color: "#2563EB",
    order: 2,
    isDefault: false,
  },
  {
    key: "COMPLETED",
    name: "Completado",
    color: "#22C55E",
    order: 3,
    isDefault: false,
  },
  {
    key: "CANCELLED",
    name: "Cancelado",
    color: "#EF4444",
    order: 4,
    isDefault: false,
  },
];

/** Al crear un workspace, genera los cuatro estados CRM por defecto (compartidos por tareas, propuestas y actividades). */
export const saasWorkspaceSeedCrmStatusesHook = {
  afterOperation: async ({ operation, item, context }: any) => {
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
            isArchived: false,
          },
        });
      }
    } catch (e) {
      console.error(
        "Error creando estados CRM por defecto para SaasWorkspace:",
        e,
      );
    }
  },
};
