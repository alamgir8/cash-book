import { api } from "../lib/api";

export type Category = {
  _id: string;
  name: string;
  type: string;
  flow: "credit" | "debit";
  description?: string;
  color?: string;
  archived?: boolean;
};

export const fetchCategories = async (
  options: {
    includeArchived?: boolean;
  } = {}
) => {
  const { includeArchived = false } = options;
  const { data } = await api.get<{ categories: Category[] }>("/categories", {
    params: includeArchived ? { include_archived: "true" } : undefined,
  });
  return includeArchived
    ? data.categories
    : data.categories.filter((category) => category.archived !== true);
};

export const createCategory = async (payload: {
  name: string;
  type: string;
  flow?: "credit" | "debit";
  description?: string;
  color?: string;
}) => {
  const { data } = await api.post<{ category: Category }>(
    "/categories",
    payload
  );
  return data.category;
};

export const updateCategory = async (
  categoryId: string,
  payload: {
    name?: string;
    type?: string;
    flow?: "credit" | "debit";
    description?: string;
    color?: string;
  }
) => {
  const { data } = await api.put<{ category: Category }>(
    `/categories/${categoryId}`,
    payload
  );
  return data.category;
};

export const archiveCategory = async (
  categoryId: string,
  archived: boolean
) => {
  const { data } = await api.patch<{ category: Category }>(
    `/categories/${categoryId}/archive`,
    { archived }
  );
  return data.category;
};

export const deleteCategory = async (categoryId: string) => {
  const { data } = await api.delete<{ message: string }>(
    `/categories/${categoryId}`
  );
  return data;
};
