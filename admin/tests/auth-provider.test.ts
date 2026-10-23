import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdminAuthProvider, createGoogleCallbackHandler, type AuthGateway, type AdminProfile } from "../src/features/auth/auth-provider";

function setup(role: AdminProfile["role"] = "super_admin", archived_at: string | null = null) {
  let signouts = 0;
  let exchanges = 0;
  const gateway: AuthGateway = {
    signIn: async () => ({ userId: "admin" }),
    startGoogleSignIn: async () => {},
    exchangeCode: async () => { exchanges++; },
    getUser: async () => ({ id: "admin" }),
    getProfile: async () => ({ id: "admin", full_name: "Admin", avatar_url: null, role, archived_at }),
    signOut: async () => { signouts++; },
  };
  return { gateway, provider: createAdminAuthProvider(() => gateway), signouts: () => signouts, exchanges: () => exchanges };
}
const credentials = { email: "admin@example.com", password: "password123" };

test("both eligible admin roles can sign in and log out", async () => {
  for (const role of ["super_admin", "general_supervisor"] as const) {
    const context = setup(role);
    assert.equal((await context.provider.login(credentials)).success, true);
    assert.equal((await context.provider.check()).authenticated, true);
    assert.equal((await context.provider.logout({})).success, true);
    assert.equal(context.signouts(), 1);
  }
});
test("archived admins and missing profiles are denied and signed out", async () => {
  const context = setup("super_admin", "2026-01-01");
  assert.equal((await context.provider.login(credentials)).success, false);
  context.gateway.getProfile = async () => null;
  assert.equal((await context.provider.login(credentials)).success, false);
  assert.equal(context.signouts(), 2);
});
test("a customer cannot enter the admin app", async () => {
  const context = setup("customer");
  assert.equal((await context.provider.login(credentials)).success, false);
  assert.equal((await context.provider.check()).authenticated, false);
  assert.equal(context.signouts(), 1);
});
test("profile read failures deny access and clean up a new session", async () => {
  const context = setup();
  context.gateway.getProfile = async () => { throw new Error("unavailable"); };
  assert.equal((await context.provider.login(credentials)).success, false);
  assert.equal((await context.provider.check()).authenticated, false);
  assert.equal(context.signouts(), 1);
});
test("unconfigured auth returns a normal failure", async () => {
  const provider = createAdminAuthProvider(() => null);
  assert.equal((await provider.login(credentials)).success, false);
  assert.equal((await provider.check()).authenticated, false);
});
test("Google callback shares duplicate exchange and rechecks role", async () => {
  const context = setup();
  const complete = createGoogleCallbackHandler(() => context.gateway);
  const results = await Promise.all([complete({ code: "one-use" }), complete({ code: "one-use" })]);
  assert.ok(results.every(result => result.success));
  assert.equal(context.exchanges(), 1);
  context.gateway.getProfile = async () => null;
  assert.equal((await complete({ code: "different-code" })).success, false);
  assert.equal(context.signouts(), 1);
});
