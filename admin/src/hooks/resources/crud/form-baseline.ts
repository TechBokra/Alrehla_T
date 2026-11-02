interface ResettableForm<TValues> {
  reset: (values: TValues) => void;
}

/** Holds the defaults passed back to TanStack on each render. */
export function createResourceFormBaseline<TValues>(initialValues: TValues) {
  let defaultValues = initialValues;
  return {
    get defaultValues() {
      return defaultValues;
    },
    reset(form: ResettableForm<TValues>, values: TValues) {
      // Advance the options baseline before reset notifies React subscribers.
      // The next useAppForm layout effect must see these same defaults.
      defaultValues = values;
      form.reset(values);
    },
  };
}
