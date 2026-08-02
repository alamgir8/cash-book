import { getDb } from "@/db/client";
import * as categoriesRepo from "@/db/repos/categories";
import type { LocalCategory } from "@/db/types";
import {
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  updateCategory as apiUpdateCategory,
  type Category,
} from "@/services/categories";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { getOrCreateDeviceId } from "@/services/device";

function toApi(row: LocalCategory): Category {
  return {
    _id: row.id,
    name: row.name,
    type: row.type,
    flow: row.flow as "credit" | "debit",
    description: row.description ?? undefined,
    color: row.color ?? undefined,
    archived: Boolean(row.archived),
  };
}

const FLOW_BY_TYPE: Record<string, "credit" | "debit"> = {
  income: "credit",
  sell: "credit",
  loan_in: "credit",
  donation_in: "credit",
  other_income: "credit",
  adjustment_in: "credit",
  expense: "debit",
  purchase: "debit",
  loan_out: "debit",
  donation_out: "debit",
  salary: "debit",
  other_expense: "debit",
  adjustment_out: "debit",
};

export async function fetchLocalCategories(options: {
  includeArchived?: boolean;
  organizationId?: string | null;
} = {}): Promise<Category[]> {
  const db = await getDb();
  const orgId = options.organizationId ?? null;
  let rows = await categoriesRepo.listCategories(
    db,
    { organizationId: orgId },
    { includeArchived: options.includeArchived },
  );
  if (orgId && rows.length === 0) {
    rows = await categoriesRepo.listCategories(
      db,
      { organizationId: null },
      { includeArchived: options.includeArchived },
    );
  }
  return rows.map(toApi);
}

export async function createLocalCategory(payload: {
  name: string;
  type: string;
  flow?: "credit" | "debit";
  description?: string;
  color?: string;
  organizationId?: string | null;
}) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const row = await categoriesRepo.createCategory(db, {
    name: payload.name,
    type: payload.type,
    flow: payload.flow || FLOW_BY_TYPE[payload.type] || "debit",
    description: payload.description,
    color: payload.color,
    organization_id: payload.organizationId ?? null,
    device_id,
  });
  if (isDualWriteEnabled()) {
    try {
      const remote = await apiCreateCategory(payload);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE categories SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          row.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write category create failed", e);
    }
  }
  return toApi(row);
}

export async function updateLocalCategory(
  categoryId: string,
  payload: {
    name?: string;
    type?: string;
    flow?: "credit" | "debit";
    description?: string;
    color?: string;
  },
) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const row = await categoriesRepo.updateCategory(db, categoryId, {
    ...payload,
    device_id,
  });
  if (isDualWriteEnabled() && row.server_id) {
    try {
      await apiUpdateCategory(row.server_id, payload);
      await db.runAsync(`UPDATE categories SET dirty = 0 WHERE id = ?`, row.id);
    } catch (e) {
      console.warn("[dal] dual-write category update failed", e);
    }
  }
  return toApi(row);
}

export async function deleteLocalCategory(categoryId: string) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const existing = await categoriesRepo.getCategoryById(db, categoryId);
  await categoriesRepo.softDeleteCategory(db, categoryId, device_id);
  if (isDualWriteEnabled() && existing?.server_id) {
    try {
      await apiDeleteCategory(existing.server_id);
      await db.runAsync(
        `UPDATE categories SET dirty = 0 WHERE id = ?`,
        categoryId,
      );
    } catch (e) {
      console.warn("[dal] dual-write category delete failed", e);
    }
  }
}
