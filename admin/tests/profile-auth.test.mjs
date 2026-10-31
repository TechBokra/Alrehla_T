import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../node_modules/typescript/lib/typescript.js";

const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const modelSource = (
  await readFile(
    new URL("../src/features/profile/model.ts", import.meta.url),
    "utf8",
  )
).replace(
  '"zod"',
  JSON.stringify(new URL("../node_modules/zod/index.js", import.meta.url).href),
);
const modelUrl = `data:text/javascript;base64,${Buffer.from(compile(modelSource)).toString("base64")}`;
const model = await import(modelUrl);
const actionSource = await readFile(
  new URL("../src/features/profile/auth-actions.ts", import.meta.url),
  "utf8",
);
let sequence = 0;
async function setup(overrides = {}) {
  const calls = {
    exchange: 0,
    update: 0,
    verify: 0,
    verifierSignOut: 0,
    signOut: 0,
  };
  const storage = new Map();
  const user = {
    id: "own-user",
    email: "test@example.invalid",
    identities: [{ provider: "google" }],
  };
  let authListener;
  const auth = {
    onAuthStateChange: (callback) => {
      authListener = callback;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListener = undefined;
            },
          },
        },
      };
    },
    exchangeCodeForSession: async () => {
      calls.exchange++;
      authListener?.("PASSWORD_RECOVERY");
      return { data: { redirectType: "recovery" }, error: null };
    },
    updateUser: async () => {
      calls.update++;
      return { error: null };
    },
    signOut: async () => {
      calls.signOut++;
      return { error: null };
    },
    ...overrides.auth,
  };
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.__profileTest = {
    supabaseConnection: {
      url: "https://test.invalid",
      publishableKey: "public-test-key",
    },
    currentUser: async () =>
      overrides.getUser ? overrides.getUser() : (overrides.user ?? user),
    requireClient: () => ({ auth }),
    createClient: () => ({
      auth: {
        signInWithPassword: async () => {
          calls.verify++;
          return overrides.verification ?? { data: { user }, error: null };
        },
        signOut: async () => {
          calls.verifierSignOut++;
          return { error: null };
        },
      },
    }),
  };
  const source = actionSource.replace(/^import[\s\S]*?;\r?\n/gm, "");
  const prelude = `import {changePasswordSchema,newPasswordSchema,recoverySchema} from ${JSON.stringify(modelUrl)};\nconst {createClient,supabaseConnection,currentUser,requireClient}=globalThis.__profileTest;\n`;
  const actions = await import(
    `data:text/javascript;base64,${Buffer.from(compile(prelude + source + `\n// ${sequence++}`)).toString("base64")}`
  );
  return { actions, calls, storage };
}
const password = {
  currentPassword: "old-password",
  password: "new-long-password",
  confirmPassword: "new-long-password",
};

test("profile payload rejects role and identifier changes", () => {
  assert.equal(
    model.profileSchema.safeParse({
      full_name: "Own name",
      avatar_url: "",
      role: "super_admin",
    }).success,
    false,
  );
  assert.equal(
    model.profileSchema.safeParse({
      full_name: "Own name",
      avatar_url: "",
      id: "another-user",
    }).success,
    false,
  );
});
test("password mismatch fails before verification or update", async () => {
  const { actions, calls } = await setup();
  await assert.rejects(
    actions.changePassword({ ...password, confirmPassword: "different" }),
  );
  assert.equal(calls.verify, 0);
  assert.equal(calls.update, 0);
});
test("wrong current password blocks update and closes verification session", async () => {
  const { actions, calls } = await setup({
    verification: {
      data: { user: null },
      error: { code: "invalid_credentials" },
    },
  });
  await assert.rejects(actions.changePassword(password));
  assert.equal(calls.update, 0);
  assert.equal(calls.verifierSignOut, 1);
});
test("verification for another user cannot change this password", async () => {
  const { actions, calls } = await setup({
    verification: { data: { user: { id: "another-user" } }, error: null },
  });
  await assert.rejects(actions.changePassword(password));
  assert.equal(calls.update, 0);
});
test("valid current-password verification updates once and closes temporary session", async () => {
  const { actions, calls } = await setup();
  await actions.changePassword(password);
  assert.equal(calls.update, 1);
  assert.equal(calls.verifierSignOut, 1);
});
test("Google callback without an initiating account cannot exchange a code", async () => {
  const { actions, calls } = await setup();
  await assert.rejects(actions.completeGoogleLink("code"));
  assert.equal(calls.exchange, 0);
});
test("Google callback rejects changed account and signs out", async () => {
  const { actions, calls, storage } = await setup();
  storage.set("alrehla-google-link-user", "different-user");
  await assert.rejects(actions.completeGoogleLink("code"));
  assert.equal(calls.signOut, 1);
  assert.equal(storage.size, 0);
});
test("single-use Google code exchanges once across concurrent loaders", async () => {
  const { actions, calls, storage } = await setup();
  storage.set("alrehla-google-link-user", "own-user");
  await Promise.all([
    actions.completeGoogleLink("code"),
    actions.completeGoogleLink("code"),
  ]);
  assert.equal(calls.exchange, 1);
});
test("recovery requires a code and a recovery flow", async () => {
  const { actions, calls } = await setup({
    auth: {
      exchangeCodeForSession: async () => ({
        data: { redirectType: null },
        error: null,
      }),
    },
  });
  await assert.rejects(actions.exchangeRecoveryCode());
  await assert.rejects(actions.exchangeRecoveryCode("oauth-code"));
  assert.equal(calls.update, 0);
});
test("single-use recovery code is exchanged once", async () => {
  const { actions, calls } = await setup();
  await Promise.all([
    actions.exchangeRecoveryCode("recovery"),
    actions.exchangeRecoveryCode("recovery"),
  ]);
  assert.equal(calls.exchange, 1);
});

test("password recovery cannot update without an exchanged recovery code", async () => {
  const { actions, calls } = await setup();
  await assert.rejects(actions.saveRecoveredPassword(password));
  assert.equal(calls.update, 0);
});
test("password recovery cannot update a newly switched account", async () => {
  let user = { id: "own-user" };
  const { actions, calls } = await setup({ getUser: () => user });
  await actions.exchangeRecoveryCode("recovery");
  user = { id: "other-user" };
  await assert.rejects(actions.saveRecoveredPassword(password));
  assert.equal(calls.update, 0);
});

async function providerSetup() {
  const calls = { writes: [], reads: 0 };
  const row = {
    id: "own-user",
    full_name: "Own name",
    avatar_url: null,
    role: "super_admin",
  };
  const builder = {
    select: () => builder,
    eq: () => builder,
    update: (values) => {
      calls.writes.push(values);
      return builder;
    },
    single: async () => ({ data: row, error: null }),
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "own-user",
            email: "test@example.invalid",
            identities: [],
          },
        },
        error: null,
      }),
    },
    from: () => {
      calls.reads++;
      return builder;
    },
  };
  globalThis.__profileProviderTest = {
    adminDataProvider: {},
    getSupabaseClient: () => client,
  };
  const raw = (
    await readFile(
      new URL("../src/providers/refine/data-provider/account-data-provider.ts", import.meta.url),
      "utf8",
    )
  ).replace(/^import[\s\S]*?;\r?\n/gm, "");
  const prelude = `import {profileSchema} from ${JSON.stringify(modelUrl)};\nconst {adminDataProvider,getSupabaseClient}=globalThis.__profileProviderTest;\n`;
  const { profileDataProvider: provider } = await import(
    `data:text/javascript;base64,${Buffer.from(compile(prelude + raw + `\n// ${sequence++}`)).toString("base64")}`
  );
  return { provider, calls };
}
test("own-account provider blocks another user's read and update", async () => {
  const { provider, calls } = await providerSetup();
  await assert.rejects(provider.getOne({ id: "someone-else" }));
  await assert.rejects(
    provider.update({
      id: "someone-else",
      variables: { full_name: "Name", avatar_url: "" },
    }),
  );
  assert.equal(calls.reads, 0);
  assert.equal(calls.writes.length, 0);
});
test("own-account provider never writes a submitted role", async () => {
  const { provider, calls } = await providerSetup();
  await assert.rejects(
    provider.update({
      id: "own-user",
      variables: { full_name: "Name", avatar_url: "", role: "super_admin" },
    }),
  );
  assert.equal(calls.writes.length, 0);
});
test("own-account provider writes only name and normalized avatar", async () => {
  const { provider, calls } = await providerSetup();
  await provider.update({
    id: "own-user",
    variables: { full_name: "  Own name  ", avatar_url: "" },
  });
  assert.deepEqual(calls.writes, [{ full_name: "Own name", avatar_url: null }]);
});
