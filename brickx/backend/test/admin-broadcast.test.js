// POST /api/admin/broadcast — "all" mode must email every user with an email
// on file, not just fully-registered (is_active=true) accounts. Whitelist-only
// pre-registrations (is_active=false, see /api/whitelist) were previously
// silently skipped here even though they're real, opted-in addresses — this
// test locks in the fix.
jest.mock("@supabase/supabase-js", () => require("./helpers/supabaseMock"));
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(async (payload) => {
        (global.__EMAILS_SENT__ = global.__EMAILS_SENT__ || []).push(payload);
        return { data: { id: "mock" }, error: null };
      }),
    },
  })),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

let app;
beforeAll(() => {
  process.env.RESEND_API_KEY = "test_key"; // resend client is built once at require-time
  app = require("../server");
});
afterAll(() => {
  delete process.env.RESEND_API_KEY;
});

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

beforeEach(() => {
  global.__SB_QUEUE__ = [];
  global.__SB_WRITES__ = [];
  global.__EMAILS_SENT__ = [];
});

describe("POST /api/admin/broadcast", () => {
  test("403 for a non-admin user", async () => {
    global.__SB_QUEUE__ = [{ data: { id: "u9", is_active: true, is_admin: false }, error: null }];
    const r = await request(app).post("/api/admin/broadcast")
      .set("Authorization", `Bearer ${tokenFor("u9")}`)
      .send({ mode: "all", subject: "Hi", message: "Hello" });
    expect(r.status).toBe(403);
  });

  test("400 when subject or message is missing", async () => {
    global.__SB_QUEUE__ = [{ data: { id: "admin1", is_active: true, is_admin: true }, error: null }];
    const r = await request(app).post("/api/admin/broadcast")
      .set("Authorization", `Bearer ${tokenFor("admin1")}`)
      .send({ mode: "all", subject: "", message: "Hello" });
    expect(r.status).toBe(400);
  });

  test("mode=all emails whitelist-pending (is_active=false) users too", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "admin1", is_active: true, is_admin: true }, error: null }, // auth lookup
      { data: [ // users select('email') — no is_active filter
        { email: "active@user.com" },
        { email: "pending@whitelist.com" },
      ], error: null },
      { data: null, error: null }, // audit_logs insert
    ];
    const r = await request(app).post("/api/admin/broadcast")
      .set("Authorization", `Bearer ${tokenFor("admin1")}`)
      .send({ mode: "all", subject: "Seed sale live", message: "It's live!" });

    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.sent).toBe(2);
    const recipients = global.__EMAILS_SENT__.map((m) => m.to);
    expect(recipients).toContain("active@user.com");
    expect(recipients).toContain("pending@whitelist.com");
  });

  test("mode=single sends only to the given address", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "admin1", is_active: true, is_admin: true }, error: null }, // auth lookup
      { data: null, error: null }, // audit_logs insert
    ];
    const r = await request(app).post("/api/admin/broadcast")
      .set("Authorization", `Bearer ${tokenFor("admin1")}`)
      .send({ mode: "single", email: "one@user.com", subject: "Hi", message: "Hello" });

    expect(r.status).toBe(200);
    expect(r.body.total).toBe(1);
    expect(global.__EMAILS_SENT__.map((m) => m.to)).toEqual(["one@user.com"]);
  });
});
