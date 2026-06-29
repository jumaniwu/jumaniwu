// Money-path tests: public ICO info + the buy endpoint's auth/KYC/wallet gates.
// Supabase is mocked (no DB). A regression that crashes these handlers (e.g. an
// undefined helper) would surface as a 500 and fail here.

jest.mock("@supabase/supabase-js", () => require("./helpers/supabaseMock"));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

beforeEach(() => {
  global.__SB_QUEUE__ = [];
  global.__SB_WRITES__ = [];
});

describe("GET /api/ico/info", () => {
  test("returns round config with sane defaults when settings are empty", async () => {
    global.__SB_QUEUE__ = [
      { data: null, error: null }, // ico_settings.single() → defaults from PHASE
      { data: [], error: null },   // ico_orders.in() → no confirmed orders
    ];
    const r = await request(app).get("/api/ico/info");
    expect(r.status).toBe(200);
    expect(r.body.activeRound).toBe("seed");
    expect(r.body.saleOpen).toBe(false); // upcoming by default
    expect(Number(r.body.seedPrice)).toBeGreaterThan(0);
    expect(Number(r.body.minInvestment)).toBeGreaterThan(0);
  });
});

describe("POST /api/ico/order (gates)", () => {
  test("401 without a token", async () => {
    const r = await request(app).post("/api/ico/order").send({ usdAmount: 100, cryptoCurrency: "USDC/Polygon" });
    expect(r.status).toBe(401);
  });

  test("403 when a purchase at/over the KYC threshold needs KYC and it's not approved", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "u1", is_active: true, kyc_status: "not_started", wallet_address: "0x" + "1".repeat(40) }, error: null }, // auth lookup
      { data: { sale_status: "live", active_round: "seed", kyc_required: true }, error: null }, // ico_settings
      { data: [], error: null }, // buyer's existing orders (none)
    ];
    const r = await request(app)
      .post("/api/ico/order")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ usdAmount: 10000, cryptoCurrency: "USDC/Polygon" });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/KYC/i);
  });

  test("allows a sub-threshold purchase ($100) without KYC", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "u1", email: "u1@test.com", is_active: true, kyc_status: "not_started", wallet_address: "0x" + "1".repeat(40) }, error: null }, // auth lookup
      { data: { sale_status: "live", active_round: "seed", kyc_required: true }, error: null }, // ico_settings
      { data: [], error: null }, // existing orders (per-wallet + cumulative total)
      { data: [], error: null }, // round orders (hard-cap check)
      { data: { order_id: "ORD-1" }, error: null }, // inserted order
    ];
    const r = await request(app)
      .post("/api/ico/order")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ usdAmount: 100, cryptoCurrency: "USDC/Polygon" });
    expect(r.status).toBe(201);
    expect(r.body.brxAllocated).toBeGreaterThan(0);
  });

  test("400 when the currency is not USDT/Polygon or USDC/Polygon", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "u1", is_active: true, kyc_status: "approved", wallet_address: "0x" + "1".repeat(40) }, error: null },
    ];
    const r = await request(app)
      .post("/api/ico/order")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ usdAmount: 100, cryptoCurrency: "BNB" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/Polygon/);
  });

  test("400 when wallet address is missing", async () => {
    global.__SB_QUEUE__ = [
      { data: { id: "u1", is_active: true, kyc_status: "approved", wallet_address: "" }, error: null },
    ];
    const r = await request(app)
      .post("/api/ico/order")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ usdAmount: 100, cryptoCurrency: "USDC/Polygon" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/wallet/i);
  });
});
