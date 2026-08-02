import {
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  fetchCategories,
  updateCategory as apiUpdateCategory,
  type Category,
} from "@/services/categories";
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";
import { shouldUseLocalPersonalLedger } from "@/lib/local-first/ledger-scope";

export async function dalFetchCategories(
  options: {
    includeArchived?: boolean;
    organizationId?: string | null;
  } = {},
): Promise<Category[]> {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(options.organizationId)) {
    return fetchCategories(options);
  }
  const local = await import("./categories.local");
  return local.fetchLocalCategories(options);
}

export async function dalCreateCategory(payload: {
  name: string;
  type: string;
  flow?: "credit" | "debit";
  description?: string;
  color?: string;
  organizationId?: string | null;
}) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(payload.organizationId)) {
    return apiCreateCategory(payload);
  }
  const local = await import("./categories.local");
  return local.createLocalCategory(payload);
}

export async function dalUpdateCategory(
  categoryId: string,
  payload: {
    name?: string;
    type?: string;
    flow?: "credit" | "debit";
    description?: string;
    color?: string;
  },
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiUpdateCategory(categoryId, payload);
  }
  const local = await import("./categories.local");
  return local.updateLocalCategory(categoryId, payload);
}

export async function dalDeleteCategory(categoryId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiDeleteCategory(categoryId);
  }
  const local = await import("./categories.local");
  return local.deleteLocalCategory(categoryId);
}
