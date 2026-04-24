import { isValidCrmStatusHexColor } from "../../../utils/validation/crmStatusCrmHexColor";

async function reassignRelatedToDefaultStatusCrm(
  context: any,
  fromStatusId: string,
  workspaceId: string,
): Promise<void> {
  const sudo = context.sudo();

  const [defaultRow] = await sudo.query.SaasWorkspaceCrmStatus.findMany({
    where: {
      workspace: { id: { equals: workspaceId } },
      isDefault: { equals: true },
    },
    take: 1,
    query: "id",
  });

  let targetId = defaultRow?.id as string | undefined;

  if (!targetId) {
    const [fallback] = await sudo.query.SaasWorkspaceCrmStatus.findMany({
      where: {
        workspace: { id: { equals: workspaceId } },
        id: { not: { equals: fromStatusId } },
      },
      orderBy: [{ order: "asc" }],
      take: 1,
      query: "id",
    });
    targetId = fallback?.id as string | undefined;
  }

  if (!targetId) {
    throw new Error(
      "No hay otro estado CRM en este workspace; no se puede eliminar este estado hasta crear otro o marcar uno como predeterminado.",
    );
  }

  const taskRows = await sudo.query.TechFollowUpTask.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id",
  });
  for (const row of taskRows) {
    await sudo.db.TechFollowUpTask.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } },
    });
  }

  const proposalRows = await sudo.query.TechProposal.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id",
  });
  for (const row of proposalRows) {
    await sudo.db.TechProposal.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } },
    });
  }

  const activityRows = await sudo.query.TechSalesActivity.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id",
  });
  for (const row of activityRows) {
    await sudo.db.TechSalesActivity.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } },
    });
  }

  const workspaceTaskRows = await sudo.query.TechTask.findMany({
    where: { statusCrm: { id: { equals: fromStatusId } } },
    query: "id",
  });
  for (const row of workspaceTaskRows) {
    await sudo.db.TechTask.updateOne({
      where: { id: row.id },
      data: { statusCrm: { connect: { id: targetId } } },
    });
  }
}

async function clearOtherDefaults(args: {
  context: any;
  workspaceId: string;
  exceptId: string;
}) {
  const { context, workspaceId, exceptId } = args;
  const sudo = context.sudo();
  const others = await sudo.query.SaasWorkspaceCrmStatus.findMany({
    where: {
      workspace: { id: { equals: workspaceId } },
      id: { not: { equals: exceptId } },
    },
    query: "id",
  });
  for (const row of others) {
    await sudo.db.SaasWorkspaceCrmStatus.updateOne({
      where: { id: row.id },
      data: { isDefault: false },
    });
  }
}

export const saasWorkspaceCrmStatusHooks = {
  validateDelete: async ({ item, context, addValidationError }: any) => {
    if (!item?.id) return;

    const row = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
      where: { id: item.id },
      query: "id isDefault",
    });

    if (row?.isDefault === true) {
      addValidationError(
        "No puedes eliminar el estado CRM por defecto. Marca otro estado como predeterminado (isDefault) antes de eliminar este.",
      );
    }
  },

  beforeOperation: async ({ operation, item, context }: any) => {
    if (operation !== "delete" || !item?.id) return;

    const deleting = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
      where: { id: item.id },
      query: "id isDefault workspace { id }",
    });

    if (!deleting) {
      return;
    }
    if (deleting.isDefault === true) {
      throw new Error(
        "No puedes eliminar el estado CRM por defecto. Marca otro estado como predeterminado (isDefault) antes de eliminar este.",
      );
    }

    const workspaceId = deleting.workspace?.id as string | undefined;
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
    item,
  }: any) => {
    if (resolvedData?.color !== undefined && resolvedData.color !== null) {
      const color = String(resolvedData.color).trim();
      if (!isValidCrmStatusHexColor(color)) {
        addValidationError(
          'El color debe ser un hex válido de 6 dígitos (ej. "#2563EB").',
        );
      }
    }

    if (operation === "create") {
      const workspaceConnectId =
        typeof resolvedData?.workspace?.connect?.id === "string"
          ? resolvedData.workspace.connect.id
          : undefined;
      const key =
        typeof resolvedData?.key === "string" ? resolvedData.key : undefined;
      if (workspaceConnectId && key) {
        const dup = await context.sudo().query.SaasWorkspaceCrmStatus.findMany({
          where: {
            workspace: { id: { equals: workspaceConnectId } },
            key: { equals: key },
          },
          take: 1,
          query: "id",
        });
        if (dup.length > 0) {
          addValidationError(
            "Ya existe un estado CRM con esa clave (key) para este workspace.",
          );
        }
      }
    }

    if (operation === "update" && resolvedData?.key !== undefined) {
      const full = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
        where: { id: item?.id },
        query: "id workspace { id } key",
      });
      if (full?.workspace?.id) {
        const dup = await context.sudo().query.SaasWorkspaceCrmStatus.findMany({
          where: {
            workspace: { id: { equals: full.workspace.id } },
            key: { equals: String(resolvedData.key) },
            id: { not: { equals: item.id } },
          },
          take: 1,
          query: "id",
        });
        if (dup.length > 0) {
          addValidationError(
            "Ya existe un estado CRM con esa clave (key) para este workspace.",
          );
        }
      }
    }
  },

  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context,
  }: any) => {
    if ((operation !== "create" && operation !== "update") || !item?.id) {
      return;
    }
    if (resolvedData?.isDefault !== true) return;

    const full = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
      where: { id: item.id },
      query: "id workspace { id }",
    });
    if (!full?.workspace?.id) return;

    await clearOtherDefaults({
      context,
      workspaceId: full.workspace.id,
      exceptId: item.id,
    });
  },
};
