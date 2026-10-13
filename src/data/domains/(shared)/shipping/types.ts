

export type ShippingRate = {
  governorate: string;
  /** The city or district within it — Cairo and Shorouk are not the same trip. */
  city: string;
  fee: number;
};

export type ShippingRateRow = ShippingRate & {
  id: string;
  isActive: boolean;
};
