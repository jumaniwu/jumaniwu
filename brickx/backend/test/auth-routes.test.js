// Route-level tests for the critical auth flow. Supabase is mocked with a tiny
// queue-driven stub so we exercise the real Express handlers WITHOUT a database.
// This catches the class of bug where a handler references an undefined helper
// (e.g. the historical generateReferralCode crash): the route would 500 and
// these assertions would fail.

jest.mock("@supabase/supabase-js", () => require("./helpers/supabaseMock"));

const request = require("supertest");
const app = require("../server");

beforeEach(() => {
  global.__SB_QUEUE__ = [];
  global.__SB_WRITES__ = [];
});

describe("POST /api/auth/register", () => {
  test("400 when required fields are missing", async () => {
    const r = await request(app).post("/api/auth/register").send({ email: "a@b.com" });
    expect(r.status).toBe(400);
  });

  test("400 when terms are not accepted", async () => {
    const r = await request(app)
      .post("/api/auth/register")
      .send({ firstName: "A", lastName: "B", email: "a@b.com", password: "password123" });
    expect(r.status).toBe(400);
  });

  test("400 when the wallet address is missing or invalid", async () => {
    const r = await request(app).post("/api/auth/register").send({
      firstName: "A", lastName: "B", email: "a@b.com", password: "password123", acceptedTerms: true,
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/wallet/i);

    const r2 = await request(app).post("/api/auth/register").send({
      firstName: "A", lastName: "B", email: "a@b.com", password: "password123", acceptedTerms: true, walletAddress: "0xnotavalidaddress",
    });
    expect(r2.status).toBe(400);
    expect(r2.body.error).toMatch(/wallet/i);
  });

  test("201 + requiresOtp on a valid registration", async () => {
    global.__SB_QUEUE__ = [
      { data: null, error: null }, // duplicate-email check → none
      { data: null, error: null }, // wallet-uniqueness check → not taken
      { data: { id: "u1", email: "new@user.com", first_name: "A", referral_code: "BRX-TEST1234" }, error: null }, // insert
      { data: null, error: null }, // issueOtp update
    ];
    const r = await request(app).post("/api/auth/register").send({
      firstName: "A", lastName: "B", email: "new@user.com", password: "password123", acceptedTerms: true,
      walletAddress: "0x" + "a".repeat(40),
    });
    expect(r.status).toBe(201);
    expect(r.body.requiresOtp).toBe(true);
    expect(r.body.email).toBe("new@user.com");

    // The insert must carry a backend-generated BRX- referral code — proves
    // generateReferralCode() exists and ran (the bug we previously shipped).
    const ins = (global.__SB_WRITES__ || []).find((w) => w.op === "insert");
    expect(ins).toBeTruthy();
    expect(String(ins.obj.referral_code)).toMatch(/^BRX-/);
    expect(ins.obj.email).toBe("new@user.com");
    expect(ins.obj.email_verified).toBe(false);
    expect(String(ins.obj.wallet_address)).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe("POST /api/auth/login", () => {
  test("400 when fields missing", async () => {
    const r = await request(app).post("/api/auth/login").send({ email: "a@b.com" });
    expect([400, 401]).toContain(r.status);
  });
});

describe("GET /api/health", () => {
  test("reports db ok and an email mode", async () => {
    global.__SB_QUEUE__ = [{ data: [{ id: 1 }], error: null }];
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body.db).toBe("ok");
    expect(["configured", "console-only"]).toContain(r.body.email);
  });
});
