import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/events", () => ({ logEvent: async () => {} }));

const { verifyCheckoutSignature, verifyWebhookSignature } = await import("./razorpay");
const { giftCardCode, viewToken } = await import("./codes");
const { periodMonths } = await import("./fulfil");

const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

describe("Razorpay signatures", () => {
  beforeEach(() => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_key_secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "test_webhook_secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the checkout signature for this order and payment", () => {
    const sig = hmac("test_key_secret", "order_ABC123|pay_XYZ789");
    expect(verifyCheckoutSignature("order_ABC123", "pay_XYZ789", sig)).toBe(true);
  });

  it("rejects a signature for a different order, a forged one, or junk", () => {
    const sig = hmac("test_key_secret", "order_ABC123|pay_XYZ789");
    expect(verifyCheckoutSignature("order_OTHER1", "pay_XYZ789", sig)).toBe(false);
    expect(verifyCheckoutSignature("order_ABC123", "pay_XYZ789", hmac("wrong", "order_ABC123|pay_XYZ789"))).toBe(false);
    expect(verifyCheckoutSignature("order_ABC123", "pay_XYZ789", "not-hex")).toBe(false);
  });

  it("checks webhooks against the raw body with the webhook secret", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyWebhookSignature(body, hmac("test_webhook_secret", body))).toBe(true);
    expect(verifyWebhookSignature(`${body} `, hmac("test_webhook_secret", body))).toBe(false);
    expect(verifyWebhookSignature(body, hmac("test_key_secret", body))).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("refuses every webhook when no webhook secret is configured", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    const body = "{}";
    expect(verifyWebhookSignature(body, hmac("", body))).toBe(false);
  });
});

describe("membership periods", () => {
  it("reads the tier period", () => {
    expect(periodMonths("year")).toBe(12);
    expect(periodMonths("6 months")).toBe(6);
    expect(periodMonths("month")).toBe(1);
    expect(periodMonths("2 years")).toBe(24);
  });
});

describe("gift card codes", () => {
  it("uses the brand prefix and an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) expect(giftCardCode("Lumière")).toMatch(/^LUM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("is effectively unique and has unguessable view links", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => giftCardCode("Lumière")));
    expect(codes.size).toBe(2000);
    expect(viewToken()).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
});
