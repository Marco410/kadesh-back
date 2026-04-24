type ConnectPayload = { connect?: { id?: string } };

type TechCrmListKey =
  | "TechFollowUpTask"
  | "TechProposal"
  | "TechSalesActivity" | "TechTask";

function getRelationshipConnectId(
  value: unknown,
): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const c = (value as ConnectPayload).connect;
  return typeof c?.id === "string" ? c.id : undefined;
}

async function resolveWorkspaceIdForTechItem(
  context: any,
  listKey: TechCrmListKey,
  item: { id?: string; workspaceId?: string | null } | null | undefined,
): Promise<string | undefined> {
  if (item?.workspaceId) return item.workspaceId ?? undefined;
  if (!item?.id) return undefined;
  const sudo = context.sudo();
  if (listKey === "TechFollowUpTask") {
    const row = await sudo.query.TechFollowUpTask.findOne({
      where: { id: item.id },
      query: "workspace { id }",
    });
    return row?.workspace?.id;
  }
  if (listKey === "TechProposal") {
    const row = await sudo.query.TechProposal.findOne({
      where: { id: item.id },
      query: "workspace { id }",
    });
    return row?.workspace?.id;
  }
  if (listKey === "TechTask") {
    const row = await sudo.query.TechTask.findOne({
      where: { id: item.id },
      query: "workspace { id }",
    });
    return row?.workspace?.id;
  }
  const row = await sudo.query.TechSalesActivity.findOne({
    where: { id: item.id },
    query: "workspace { id }",
  });
  return row?.workspace?.id;
}

/**
 * Valida que `statusCrm` (si viene en el input) pertenezca al mismo `workspace`.
 */
export async function validateTechStatusCrmInput(args: {
  context: any;
  resolvedData: Record<string, unknown>;
  item: { id?: string; workspaceId?: string | null } | null | undefined;
  listKey: TechCrmListKey;
  addValidationError: (message: string) => void;
}): Promise<void> {
  const { context, resolvedData, item, listKey, addValidationError } = args;

  if (!("statusCrm" in resolvedData)) return;

  const statusCrmId = getRelationshipConnectId(resolvedData.statusCrm);
  if (!statusCrmId) return;

  const workspaceIdFromInput = getRelationshipConnectId(
    resolvedData.workspace,
  );
  let workspaceId =
    workspaceIdFromInput ??
    item?.workspaceId ??
    (await resolveWorkspaceIdForTechItem(context, listKey, item));

  if (!workspaceId) {
    addValidationError(
      "Asigna un workspace antes de usar un estado CRM (statusCrm).",
    );
    return;
  }

  const status = await context.sudo().query.SaasWorkspaceCrmStatus.findOne({
    where: { id: statusCrmId },
    query: "id workspace { id }",
  });

  if (!status) {
    addValidationError("El estado CRM indicado no existe.");
    return;
  }

  if (status.workspace?.id !== workspaceId) {
    addValidationError(
      "El estado CRM debe pertenecer al mismo workspace que el registro.",
    );
  }
}
