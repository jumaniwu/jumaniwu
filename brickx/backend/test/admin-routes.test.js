// Admin referral-overview endpoint: auth gating + per-code aggregation.
jest.mock("@supabase/supabase-js", () => require("./helpers/supabaseMock"));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

beforeEach(() => {
  global.__SB_QUEUE__ = [];
  global.__SB_WRITES__ = [];
});

describe("GET /api/admin/referrals", () => {
  test("401 without a token", async () => {
    const r = await request(app).get("/api/admin/referrals");
    expect(r.status).toBe(401);
  });

  test("403 for a non-admin user", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "u9", is_active: true, is_admin: false }, error: null }, // auth lookup
    ];
    const r = await request(app).get("/api/admin/referrals").set("Authorization", `Bearer ${tokenFor("u9")}`);
    expect(r.status).toBe(403);
  });

  test("aggregates per referral code + protocol totals", async () => {
    const ref = (code) => ({ referral_code: code, first_name: "A", last_name: "B", email: code + "@x.com" });
    global.__SB_QUEUE__ = [
      { data: { id: "admin1", is_active: true, is_admin: true }, error: null }, // auth lookup
      { data: [ // referral_bonuses
        { bonus_brx: 500, status: "activated", referrer_id: "u1", referrer: ref("BRX-AAA") },
        { bonus_brx: 500, status: "pending",   referrer_id: "u1", referrer: ref("BRX-AAA") },
        { bonus_brx: 500, status: "activated", referrer_id: "u2", referrer: ref("BRX-BBB") },
      ], error: null },
    ];
    const r = await request(app).get("/api/admin/referrals").set("Authorization", `Bearer ${tokenFor("admin1")}`);
    expect(r.status).toBe(200);
    expect(r.body.totals).toMatchObject({
      referrers: 2,
      signupsViaReferral: 3,
      successfulReferrals: 2,
      earnedBrx: 1000,
      pendingBrx: 500,
    });
    const u1 = r.body.referrers.find((x) => x.referrerId === "u1");
    expect(u1).toMatchObject({
      referralCode: "BRX-AAA",
      totalReferred: 2,
      successfulReferrals: 1,
      pendingReferrals: 1,
      earnedBrx: 500,
      pendingBrx: 500,
    });
  });
});

describe("POST /api/admin/kyc/:userId/request-fix", () => {
  test("403 for a non-admin user", async () => {
    global.__SB_QUEUE__ = [{ data: { id: "u9", is_active: true, is_admin: false }, error: null }];
    const r = await request(app).post("/api/admin/kyc/u1/request-fix")
      .set("Authorization", `Bearer ${tokenFor("u9")}`).send({ note: "blurry" });
    expect(r.status).toBe(403);
  });

  test("400 when the note is empty", async () => {
    global.__SB_QUEUE__ = [{ data: { id: "admin1", is_active: true, is_admin: true }, error: null }];
    const r = await request(app).post("/api/admin/kyc/u1/request-fix")
      .set("Authorization", `Bearer ${tokenFor("admin1")}`).send({ note: "   " });
    expect(r.status).toBe(400);
  });

  test("sets status to rejected and records the note", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "admin1", is_active: true, is_admin: true }, error: null }, // auth lookup
      { data: { id: "u1", email: "a@b.com", first_name: "Test" }, error: null }, // target user
    ];
    const r = await request(app).post("/api/admin/kyc/u1/request-fix")
      .set("Authorization", `Bearer ${tokenFor("admin1")}`)
      .send({ note: "The photo of your ID is blurry." });
    expect(r.status).toBe(200);
    const writes = global.__SB_WRITES__;
    expect(writes.find((w) => w.op === "update" && w.obj.kyc_status === "rejected")).toBeTruthy();
    expect(writes.find((w) => w.op === "insert" && w.obj.action === "kyc_resubmit_requested")).toBeTruthy();
  });
});
