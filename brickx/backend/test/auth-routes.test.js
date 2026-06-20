// Route-level tests for the critical auth flow. Supabase is mocked with a tiny
// queue-driven stub so we exercise the real Express handlers WITHOUT a database.
// This catches the class of bug where a handler references an undefined helper
// (e.g. the historical generateReferralCode crash): the route would 500 and
// these assertions would fail.

jest.mock("@supabase/supabase-js", () => {
  function shift() {
    const q = global.__SB_QUEUE__ || [];
    return q.length ? q.shift() : { data: null, error: null };
  }
  function builder() {
    const b = {};
    ["select", "eq", "neq", "order", "limit", "in", "gte", "lte", "gt", "lt", "filter", "range", "delete"]
      .forEach((m) => { b[m] = () => b; });
    b.single = () => Promise.resolve(shift());
    b.maybeSingle = () => Promise.resolve(shift());
    b.insert = (obj) => { (global.__SB_WRITES__ = global.__SB_WRITES__ || []).push({ op: "insert", obj }); return b; };
    b.update = (obj) => { (global.__SB_WRITES__ = global.__SB_WRITES__ || []).push({ op: "update", obj }); return b; };
    b.upsert = (obj) => { (global.__SB_WRITES__ = global.__SB_WRITES__ || []).push({ op: "upsert", obj }); return b; };
    // Makes a chain that ends WITHOUT .single() (e.g. ...update().eq()) awaitable.
    b.then = (res, rej) => Promise.resolve(shift()).then(res, rej);
    return b;
  }
  return { createClient: () => ({ from: () => builder() }) };
});

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

  test("201 + requiresOtp on a valid registration", async () => {
    global.__SB_QUEUE__ = [
      { data: null, error: null }, // duplicate-email check → none
      { data: { id: "u1", email: "new@user.com", first_name: "A", referral_code: "BRX-TEST1234" }, error: null }, // insert
      { data: null, error: null }, // issueOtp update
    ];
    const r = await request(app).post("/api/auth/register").send({
      firstName: "A", lastName: "B", email: "new@user.com", password: "password123", acceptedTerms: true,
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
