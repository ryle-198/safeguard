// supabase/functions/payfast-itn/index.ts
// MUST be deployed with: supabase functions deploy payfast-itn --no-verify-jwt
// (PayFast has no Supabase JWT, so the checks below ARE the authentication.)
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const SANDBOX = Deno.env.get("PAYFAST_SANDBOX") === "true";
const HOST = SANDBOX ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
const PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
const MERCHANT_ID = Deno.env.get("PAYFAST_MERCHANT_ID")!;
const MEMBERSHIP_DAYS = 30;

const enc = (v: string) =>
  encodeURIComponent(v)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const params = new URLSearchParams(body);

  // Rebuild the param string in the order received, minus the signature.
  // (Unlike checkout, ITN signing includes empty fields.)
  const paramString = [...params.entries()]
    .filter(([k]) => k !== "signature")
    .map(([k, v]) => `${k}=${enc(v)}`)
    .join("&");

  // CHECK 1: signature
  const sigString = PASSPHRASE ? `${paramString}&passphrase=${enc(PASSPHRASE)}` : paramString;
  if (md5(sigString) !== params.get("signature")) {
    console.error("ITN rejected: bad signature");
    return new Response("Bad signature", { status: 400 });
  }

  // CHECK 2: it is addressed to our merchant account
  if (params.get("merchant_id") !== MERCHANT_ID) {
    console.error("ITN rejected: merchant mismatch");
    return new Response("Bad merchant", { status: 400 });
  }

  // CHECK 3: we know this payment and the amount matches what we expected
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const mPaymentId = params.get("m_payment_id") ?? "";
  const { data: payment } = await admin
    .from("payments")
    .select("amount, status")
    .eq("m_payment_id", mPaymentId)
    .maybeSingle();

  if (!payment) {
    console.error("ITN rejected: unknown payment", mPaymentId);
    return new Response("Unknown payment", { status: 400 });
  }
  const gross = parseFloat(params.get("amount_gross") ?? "0");
  if (Math.abs(gross - Number(payment.amount)) > 0.01) {
    console.error("ITN rejected: amount mismatch", gross, payment.amount);
    return new Response("Amount mismatch", { status: 400 });
  }

  // CHECK 4: ask PayFast to confirm it really sent this
  const confirm = await fetch(`${HOST}/eng/query/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: paramString,
  });
  if ((await confirm.text()).trim() !== "VALID") {
    console.error("ITN rejected: PayFast did not confirm");
    return new Response("Not valid", { status: 400 });
  }

  // All checks passed. Act on the status.
  const status = params.get("payment_status");
  const raw = Object.fromEntries(params.entries());

  if (status === "COMPLETE") {
    const { error } = await admin.rpc("activate_membership", {
      p_m_payment_id: mPaymentId,
      p_pf_payment_id: params.get("pf_payment_id"),
      p_raw: raw,
      p_days: MEMBERSHIP_DAYS,
    });
    if (error) {
      console.error(error);
      return new Response("DB error", { status: 500 }); // 500 makes PayFast retry
    }
  } else if (status === "FAILED" || status === "CANCELLED") {
    await admin
      .from("payments")
      .update({ status, raw_itn: raw })
      .eq("m_payment_id", mPaymentId)
      .neq("status", "COMPLETE");
  }

  return new Response("OK", { status: 200 });
});