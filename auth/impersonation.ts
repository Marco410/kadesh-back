import { GraphQLError, Kind, type OperationDefinitionNode } from "graphql";
import type { Impersonation } from "./sessionGuards";

/** "Entrar como" dura una hora: suficiente para revisar un problema, poco para olvidarse dentro. */
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

/** Lo único que se puede ejecutar viendo como otra persona. */
const ALLOWED_MUTATIONS: ReadonlySet<string> = new Set([
  "endImpersonation",
  "trackEvents",
  "endSession",
  // Es una lectura (créditos del mes) declarada como mutación; el panel la pide al cargar.
  "remainingCredits",
]);

export const IMPERSONATION_READ_ONLY_MESSAGE =
  "Estás viendo el panel como otra persona en modo solo lectura: no se pueden guardar cambios.";

export function getImpersonation(session: unknown): Impersonation | null {
  const impersonation = (session as { impersonation?: Impersonation } | null | undefined)
    ?.impersonation;
  return impersonation?.adminId ? impersonation : null;
}

function rootFields(operation: OperationDefinitionNode): Array<string | null> {
  return operation.selectionSet.selections.map((selection) =>
    selection.kind === Kind.FIELD ? selection.name.value : null,
  );
}

/**
 * Plugin de Apollo: con un token de "entrar como" ninguna mutación pasa (salvo la lista de arriba).
 * Se revisa en un solo lugar para no depender de que cada list o mutación lo recuerde.
 */
export const impersonationReadOnlyPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation(requestContext: {
        contextValue?: { session?: unknown };
        operation?: OperationDefinitionNode | null;
        operationName?: string | null;
      }) {
        if (!getImpersonation(requestContext.contextValue?.session)) return;
        const operation = requestContext.operation;
        if (!operation || operation.operation !== "mutation") return;
        const fields = rootFields(operation);
        const allowed = fields.every((field) => field !== null && ALLOWED_MUTATIONS.has(field));
        if (allowed) return;
        console.info(
          `[impersonation] mutación bloqueada (solo lectura): ${requestContext.operationName ?? "sin nombre"} → ${fields.join(", ")}`,
        );
        // Estado 200: el front lo recibe como error de GraphQL con su mensaje (con 500, Apollo lo
        // trata como falla de red y en desarrollo tapa la pantalla).
        throw new GraphQLError(IMPERSONATION_READ_ONLY_MESSAGE, {
          extensions: { code: "IMPERSONATION_READ_ONLY", http: { status: 200 } },
        });
      },
    };
  },
};
