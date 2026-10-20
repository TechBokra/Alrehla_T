/** Shared contract for server-side read models **/
export type QueryResult<T, Code extends string = string> =
  | { success: true; data: T }
  | { success: false; error: { code: Code; message: string } };

/** Existing readers keep their fallback behavior unless a composed query opts in. */
export interface QueryReadOptions {
  throwOnError?: boolean;
}
