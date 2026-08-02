import {
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  fetchCategories,
  updateCategory as apiUpdateCategory,
  type Category,
} from "@/services/categories";
import { isLocalFirstEnabled } from "@/lib/local-first/flags";

export async function dalFetchCategories(options: {
  includeArchived?: boolean;
  organizationId?: string | null;
} = {}): Promise<Category[]> {
  if (!isLocalFirstEnabled() || options.organizationId) {
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
  if (!isLocalFirstEnabled() || payload.organizationId) {
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
  if (!isLocalFirstEnabled()) {
    return apiUpdateCategory(categoryId, payload);
  }
  const local = await import("./categories.local");
  return local.updateLocalCategory(categoryId, payload);
}

export async function dalDeleteCategory(categoryId: string) {
  if (!isLocalFirstEnabled()) {
    return apiDeleteCategory(categoryId);
  }
  const local = await import("./categories.local");
  return local.deleteLocalCategory(categoryId);
}
