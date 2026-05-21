export type ProductUnit =
  | "pcs"
  | "kg"
  | "g"
  | "mg"
  | "liter"
  | "ml"
  | "meter"
  | "cm"
  | "mm"
  | "box"
  | "pack"
  | "dozen"
  | "pair"
  | "set"
  | "bag"
  | "roll"
  | "sheet"
  | "bottle"
  | "can"
  | "carton"
  | "ft"
  | "inch"
  | "yard";

export interface ProductImage {
  url: string;
  thumbnail_url?: string;
  file_name?: string;
  storage_key?: string;
  is_primary?: boolean;
  uploaded_at?: string;
}

export interface Product {
  _id: string;
  organization?: string;
  admin: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category_id?: {
    _id: string;
    name: string;
    color?: string;
    icon?: string;
  };
  unit: ProductUnit;
  purchase_price: number;
  sale_price: number;
  tax_rate: number;
  current_stock: number;
  opening_stock: number;
  low_stock_threshold: number;
  images: ProductImage[];
  meta_data?: Record<string, unknown>;
  is_active: boolean;
  track_inventory: boolean;
  is_deleted: boolean;
  total_sold: number;
  total_purchased: number;
  last_purchase_date?: string;
  last_sale_date?: string;
  // Virtuals
  is_low_stock?: boolean;
  profit_margin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  _id: string;
  product: string;
  type:
    | "purchase"
    | "sale"
    | "purchase_return"
    | "sale_return"
    | "adjustment_in"
    | "adjustment_out"
    | "opening_stock";
  quantity: number;
  unit_cost: number;
  stock_after: number;
  invoice?: { _id: string; invoice_number: string; type: string };
  party?: { _id: string; name: string };
  notes?: string;
  date: string;
  createdAt: string;
}

export interface ProductStats {
  total_products: number;
  low_stock_count: number;
  stock_purchase_value: number;
  stock_sale_value: number;
  total_sold_qty: number;
  total_purchased_qty: number;
  potential_profit: number;
}

export interface CreateProductParams {
  organization?: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category_id?: string;
  unit?: ProductUnit;
  purchase_price?: number;
  sale_price?: number;
  tax_rate?: number;
  current_stock?: number;
  low_stock_threshold?: number;
  track_inventory?: boolean;
  images?: Omit<ProductImage, "uploaded_at">[];
  meta_data?: Record<string, unknown>;
}

export interface UpdateProductParams extends Partial<CreateProductParams> {
  is_active?: boolean;
}

export interface ListProductsParams {
  organization?: string;
  search?: string;
  category_id?: string;
  is_active?: boolean;
  low_stock?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface AdjustStockParams {
  type: "adjustment_in" | "adjustment_out";
  quantity: number;
  unit_cost?: number;
  notes?: string;
  date?: string;
}
