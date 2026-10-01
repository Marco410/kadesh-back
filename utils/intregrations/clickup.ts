/**
 * Cliente mínimo de la API v2 de ClickUp. El token personal va en
 * `Authorization` tal cual (sin `Bearer`). Si falta `CLICKUP_API_TOKEN`,
 * avisa y no llama; si la API falla, lanza un Error con el detalle.
 */

const CLICKUP_API = "https://api.clickup.com/api/v2";

export type ClickUpAttachment = {
  mimetype?: string | null;
  url?: string | null;
  size?: number | string | null;
  deleted?: boolean | null;
  title?: string | null;
};

export type ClickUpTask = {
  id: string;
  name?: string | null;
  markdown_description?: string | null;
  /** Milisegundos epoch, o null si la tarea no tiene fecha límite. */
  due_date?: string | number | null;
  list?: { id?: string | number | null; name?: string | null } | null;
  attachments?: ClickUpAttachment[] | null;
};

function apiToken(): string | undefined {
  const value = process.env.CLICKUP_API_TOKEN?.trim();
  return value || undefined;
}

function clip(text: string, max = 300): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

async function clickUpRequest(
  path: string,
  init: { method: string; body?: unknown },
): Promise<unknown | undefined> {
  const token = apiToken();
  if (!token) {
    console.warn("[clickup] CLICKUP_API_TOKEN no configurado. No se llama a la API.");
    return undefined;
  }

  const response = await fetch(`${CLICKUP_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: token,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const bodyText = await response.text();
  if (!response.ok) {
    const detail = clip(bodyText) || `HTTP ${response.status}`;
    throw new Error(
      `No se pudo completar la llamada a ClickUp (${init.method} ${path}, ${response.status}): ${detail}`,
    );
  }
  if (!bodyText) return {};
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new Error(`ClickUp respondió JSON inválido (${init.method} ${path}).`);
  }
}

function isTask(value: unknown): value is ClickUpTask {
  return Boolean(value && typeof value === "object" && typeof (value as ClickUpTask).id === "string");
}

/** GET /task/{id}?include_markdown_description=true */
export async function getTask(taskId: string): Promise<ClickUpTask | undefined> {
  const data = await clickUpRequest(
    `/task/${encodeURIComponent(taskId)}?include_markdown_description=true`,
    { method: "GET" },
  );
  if (data === undefined) return undefined;
  if (!isTask(data)) throw new Error("ClickUp no devolvió la tarea.");
  return data;
}

/** PUT /task/{id} { status } */
export async function setTaskStatus(taskId: string, status: string): Promise<void> {
  await clickUpRequest(`/task/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    body: { status },
  });
}

export type ClickUpComment = {
  id?: string | number;
  comment_text?: string | null;
  comment?: Array<{ text?: string | null }> | null;
  /** Milisegundos epoch. */
  date?: string | number | null;
};

function isComment(value: unknown): value is ClickUpComment {
  return Boolean(value && typeof value === "object");
}

/** GET /task/{id}/comment */
export async function getTaskComments(taskId: string): Promise<ClickUpComment[] | undefined> {
  const data = await clickUpRequest(`/task/${encodeURIComponent(taskId)}/comment`, {
    method: "GET",
  });
  if (data === undefined) return undefined;
  const comments = (data as { comments?: unknown }).comments;
  if (!Array.isArray(comments)) return [];
  return comments.filter(isComment);
}

/** POST /task/{id}/comment */
export async function commentTask(taskId: string, text: string): Promise<void> {
  await clickUpRequest(`/task/${encodeURIComponent(taskId)}/comment`, {
    method: "POST",
    body: { comment_text: text, notify_all: false },
  });
}

/**
 * Descarga un adjunto. ClickUp exige el mismo token en `Authorization`.
 * Corta la lectura al pasar de `maxBytes` para no guardar un archivo enorme.
 */
export async function downloadClickUpFile(url: string, maxBytes: number): Promise<Buffer> {
  const token = apiToken();
  if (!token) {
    console.warn("[clickup] CLICKUP_API_TOKEN no configurado. No se descarga el adjunto.");
    throw new Error("ClickUp no está configurado (falta CLICKUP_API_TOKEN).");
  }

  const response = await fetch(url, { headers: { Authorization: token } });
  if (!response.ok) {
    const detail = clip(await response.text());
    throw new Error(`No se pudo descargar la imagen (${response.status}): ${detail || "sin detalle"}`);
  }

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("La imagen pesa más de 8 MB.");
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error("La imagen pesa más de 8 MB.");
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("La imagen pesa más de 8 MB.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
