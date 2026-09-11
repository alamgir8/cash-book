/**
 * Invoice form validation lives in `./shop` together with the other shop
 * schemas (products, organization) so the pure test suite can import one
 * dependency-free module. This file is kept as a re-export so existing
 * imports of `@/lib/validations/invoice` continue to work unchanged.
 */
export * from "./shop";
