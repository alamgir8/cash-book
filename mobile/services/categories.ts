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

export const fetchCategories = async (options: {
  includeArchived?: boolean;
} = {}) => {
  const { includeArchived = false } = options;
  const { data } = await api.get<{ categories: Category[] }>("/categories", {
    params: includeArchived ? { include_archived: "true" } : undefined,
  });
  return includeArchived
    ? data.categories
    : data.categories.filter((category) => category.archived !== true);
};
