import type { GraphApiError } from "../intregrations/whatsapp";

export type FriendlyWhatsappError = {
  /** Qué pasó + qué hacer, en español, para mostrárselo tal cual al usuario. */
  message: string;
  /** Texto original de Meta (sin el prefijo interno), como detalle secundario para soporte. */
  detail: string;
};

/** Quita el prefijo interno `[whatsapp] Graph API error…:` para dejar solo lo que dijo Meta. */
function cleanMessage(raw: string): string {
  return raw.replace(/^\[whatsapp\] Graph API error[^:]*:\s*/, "");
}

/**
 * Traduce un error de Meta a "qué pasó + qué hacer". Usa `graphCode`/`graphSubcode` (datos
 * estructurados de `GraphApiError`) y solo cae al texto para los mensajes que Meta manda sin
 * código útil (p. ej. "API access blocked").
 *
 * Los subcódigos de plantilla (2388023, 2388024) se mapean a un texto prudente: no están
 * confirmados contra la documentación de Meta, así que no afirman más de lo que se sabe.
 */
export function friendlyWhatsappError(err: unknown): FriendlyWhatsappError {
  const raw = err instanceof Error ? err.message : "Error desconocido";
  const detail = cleanMessage(raw);
  const { graphCode: code, graphSubcode: subcode } = (err ?? {}) as GraphApiError;
  const lower = detail.toLowerCase();

  if (lower.includes("ai_encryption_key")) {
    return {
      message:
        "Falta configurar la clave de cifrado en el servidor de Kadesh, así que no se puede guardar el token. Avisa a soporte de Kadesh.",
      detail,
    };
  }

  if (lower.includes("api access blocked")) {
    return {
      message:
        "Meta bloqueó el acceso de esta App a la API de WhatsApp. Revisa en developers.facebook.com que la App no tenga avisos de restricción, que el token salga de esa misma App y que el usuario del sistema tenga asignadas la App y la cuenta de WhatsApp Business.",
      detail,
    };
  }

  if (subcode === 2388339) {
    return {
      message:
        "Ese número es de una cuenta de WhatsApp normal y no se puede usar con la API. Tiene que ser un número registrado en una cuenta de WhatsApp Business dentro de tu App de Meta.",
      detail,
    };
  }

  if (subcode === 2388023 || subcode === 2388024) {
    return {
      message:
        "Meta no dejó crear la plantilla de inicio de conversación. Normalmente es porque ya existe una con ese nombre e idioma o porque se está eliminando: espera unos minutos y vuelve a darle \"Probar conexión\".",
      detail,
    };
  }

  if (code === 190) {
    return {
      message:
        "El token ya no es válido (expiró o fue revocado). Genera uno permanente en Configuración de la empresa → Usuarios del sistema y pégalo de nuevo.",
      detail,
    };
  }

  if (code === 131047) {
    return {
      message:
        "Han pasado más de 24h desde el último mensaje del lead. Para escribirle primero hace falta iniciar la conversación con la plantilla.",
      detail,
    };
  }

  if (code === 200 || code === 10 || code === 3) {
    return {
      message:
        "El token no tiene los permisos necesarios. Genera uno nuevo con los dos permisos: whatsapp_business_messaging y whatsapp_business_management.",
      detail,
    };
  }

  if (code === 100) {
    return {
      message:
        "Meta no reconoció alguno de los datos o el token no tiene acceso a ellos. Revisa el App ID, el App Secret y que el token sea de esa misma App.",
      detail,
    };
  }

  return { message: detail, detail };
}
