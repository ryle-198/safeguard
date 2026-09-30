// supabase/functions/create-payfast-payment/index.ts
// Deploy normally (JWT verification ON): supabase functions deploy create-payfast-payment
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const SANDBOX = Deno.env.get("PAYFAST_SANDBOX") === "true";
const HOST = SANDBOX ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
const PRICE = Number(Deno.env.get("MEMBERSHIP_PRICE") ?? "99").toFixed(2);
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayFast expects PHP-style urlencode: uppercase hex, spaces as "+"
const enc = (v: string) =>
  encodeURIComponent(v.trim())
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const { native } = await req.json().catch(() => ({}));

  // Identify the user from their JWT. Never trust a user id from the request body.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Record what we EXPECT to be paid. The ITN checks against this row.
  const mPaymentId = `${user.id}_${Date.now()}`;
  const { error: insertError } = await admin.from("payments").insert({
    m_payment_id: mPaymentId,
    user_id: user.id,
    amount: PRICE,
    status: "PENDING",
  });
  if (insertError) {
    console.error(insertError);
    return new Response("Could not start payment", { status: 500, headers: cors });
  }

  // ORDER MATTERS: PayFast signs fields in exactly this order.
  const fields: [string, string][] = [
    ["merchant_id", Deno.env.get("PAYFAST_MERCHANT_ID")!],
    ["merchant_key", Deno.env.get("PAYFAST_MERCHANT_KEY")!],
["return_url", native ? `${APP_URL}/payment-success.html` : `${APP_URL}/?payment=success`],
["cancel_url", native ? `${APP_URL}/payment-success.html?status=cancelled` : `${APP_URL}/?payment=cancelled`],
    ["notify_url", `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-itn`],
  ];
  if (user.email) fields.push(["email_address", user.email]);
  fields.push(
    ["m_payment_id", mPaymentId],
    ["amount", PRICE],
    ["item_name", "SAFEGUARD Monthly Membership"],
  );

  // Sign the fields (not including the signature itself), then append it.
  let sigString = fields.map(([k, v]) => `${k}=${enc(v)}`).join("&");
  if (PASSPHRASE) sigString += `&passphrase=${enc(PASSPHRASE)}`;
  const signature = md5(sigString);

  const query = [...fields, ["signature", signature]]
    .map(([k, v]) => `${k}=${enc(v)}`)
    .join("&");

  return Response.json({ url: `${HOST}/eng/process?${query}` }, { headers: cors });
});