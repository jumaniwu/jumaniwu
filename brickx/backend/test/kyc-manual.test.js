// Manual-KYC submission guards. These validation paths run before any Storage
// call, so the .from()-only Supabase mock is sufficient. Also exercises the
// dedicated 10mb body parser wired for this one route.
jest.mock("@supabase/supabase-js", () => require("./helpers/supabaseMock"));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const activeUser = (over) => ({ data: { id: "u1", is_active: true, kyc_status: "not_started", ...over }, error: null });

beforeEach(() => {
  global.__SB_QUEUE__ = [];
  global.__SB_WRITES__ = [];
});

describe("POST /api/kyc/manual-submit", () => {
  test("401 without a token", async () => {
    const r = await request(app).post("/api/kyc/manual-submit").send({ docType: "passport" });
    expect(r.status).toBe(401);
  });

  test("400 when already approved", async () => {
    global.__SB_QUEUE__ = [activeUser({ kyc_status: "approved" })];
    const r = await request(app)
      .post("/api/kyc/manual-submit")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ docType: "passport", idFront: "x", selfie: "y" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/already verified/i);
  });

  test("400 for an invalid document type", async () => {
    global.__SB_QUEUE__ = [activeUser()];
    const r = await request(app)
      .post("/api/kyc/manual-submit")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ docType: "library_card", idFront: "x", selfie: "y" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/document type/i);
  });

  test("400 when ID or selfie is missing", async () => {
    global.__SB_QUEUE__ = [activeUser()];
    const r = await request(app)
      .post("/api/kyc/manual-submit")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ docType: "passport", idFront: "x" }); // no selfie
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/required/i);
  });
});
