import { useState } from "react";
import { createResourceFormBaseline } from "./form-baseline";

/** Load once, then advance the baseline only on an acknowledged save. */
export function useResourceFormBaseline<TValues>(initialize: () => TValues) {
  const [baseline] = useState(() => createResourceFormBaseline(initialize()));
  return baseline;
}
