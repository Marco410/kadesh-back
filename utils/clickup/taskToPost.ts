import { PRODUCT, type SingleProduct } from "../constants/product";
import {
  excerptFromDocument,
  markdownToDocument,
  type DocumentNode,
} from "../helpers/markdownToDocument";
import type { ClickUpTask } from "../intregrations/clickup";

const TEN_MINUTES_MS = 10 * 60 * 1000;

let warnedMissingListIds = false;

export type ScheduledPostDraft = {
  title: string;
  product: SingleProduct;
  published: true;
  publishedAt: Date;
  content: DocumentNode[];
  excerpt: string;
  clickupTaskId: string;
};

/**
 * `CLICKUP_PET_LIST_ID` / `CLICKUP_SAAS_LIST_ID`. Cualquier otra lista del
 * workspace devuelve null: el webhook no comenta ni cambia el estado.
 */
export function productForClickUpList(
  listId: string | number | null | undefined,
): SingleProduct | null {
  const id = listId == null ? "" : String(listId);
  const pet = process.env.CLICKUP_PET_LIST_ID?.trim();
  const saas = process.env.CLICKUP_SAAS_LIST_ID?.trim();
  if (!pet && !saas && !warnedMissingListIds) {
    warnedMissingListIds = true;
    console.warn(
      "[clickup] faltan CLICKUP_PET_LIST_ID y CLICKUP_SAAS_LIST_ID. No se programa ningún post.",
    );
  }
  if (pet && id === pet) return PRODUCT.PET;
  if (saas && id === saas) return PRODUCT.SAAS;
  return null;
}

function cleanTitle(name: string): string {
  return name.replace(/\*\*/g, "").replace(/#/g, "").replace(/\s+/g, " ").trim();
}

function parseEpochMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

/** `due_date` de ClickUp (ms UTC). Vacío o ya vencido → ahora + 10 minutos. */
export function publishedAtFromDueDate(
  dueDate: string | number | null | undefined,
  now = new Date(),
): Date {
  const ms = parseEpochMs(dueDate);
  if (ms === null || ms <= now.getTime()) {
    return new Date(now.getTime() + TEN_MINUTES_MS);
  }
  return new Date(ms);
}

export function taskToScheduledPost(
  task: ClickUpTask,
  product: SingleProduct,
  now = new Date(),
): ScheduledPostDraft {
  const title = cleanTitle(task.name ?? "");
  if (!title) throw new Error("La tarea no tiene un título utilizable.");
  const content = markdownToDocument(task.markdown_description ?? "");
  return {
    title,
    product,
    published: true,
    publishedAt: publishedAtFromDueDate(task.due_date, now),
    content,
    excerpt: excerptFromDocument(content),
    clickupTaskId: task.id,
  };
}
