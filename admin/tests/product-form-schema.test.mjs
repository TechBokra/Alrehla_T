import test from "node:test";
import assert from "node:assert/strict";
import { productPageSchema, preparationDaysSchema } from "../src/features/catalog/products/form-page/schema.ts";

const productValues = (overrides = {}) => ({
  name: "رحلة في الفضاء",
  category: "custom",
  description: "قصة مخصصة للأطفال",
  price: "250",
  electronicPrice: "",
  writingStyles: ["fusha"],
  minAge: "0",
  maxAge: "20",
  longDescription: "وصف المنتج",
  featuresText: "ميزة أولى\nميزة ثانية",
  images: [],
  isActive: false,
  ...overrides,
});

test("custom products require a writing style and accept the three known styles", () => {
  assert.equal(productPageSchema.safeParse(productValues({ writingStyles: [] })).success, false);
  assert.equal(
    productPageSchema.safeParse(productValues({ writingStyles: ["fusha", "simple", "dialect"] })).success,
    true,
  );
});

test("ages accept 0–20 only and require a valid minimum/maximum range", () => {
  assert.equal(productPageSchema.safeParse(productValues({ minAge: "0", maxAge: "20" })).success, true);
  assert.equal(productPageSchema.safeParse(productValues({ minAge: "", maxAge: "8" })).success, false);
  assert.equal(productPageSchema.safeParse(productValues({ minAge: "9", maxAge: "8" })).success, false);
  assert.equal(productPageSchema.safeParse(productValues({ minAge: "21", maxAge: "21" })).success, false);
});

test("the product image association limit is one cover plus eight gallery images", () => {
  const images = Array.from({ length: 9 }, (_, index) => ({
    kind: "saved",
    url: `https://res.cloudinary.com/demo/image/upload/${index}.jpg`,
  }));
  assert.equal(productPageSchema.safeParse(productValues({ images })).success, true);
  assert.equal(productPageSchema.safeParse(productValues({ images: [...images, { kind: "saved", url: "https://res.cloudinary.com/demo/image/upload/10.jpg" }] })).success, false);
});

test("preparation days accept blank or 1–120 and reject values outside the database range", () => {
  for (const value of ["", "1", "120"]) {
    assert.equal(preparationDaysSchema.safeParse({ electronic: value, printed: value }).success, true);
  }
  for (const value of ["0", "121", "1.5", "abc"]) {
    assert.equal(preparationDaysSchema.safeParse({ electronic: value, printed: "" }).success, false);
  }
});
