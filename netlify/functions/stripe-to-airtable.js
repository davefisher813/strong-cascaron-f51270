// Stripe to Airtable bridge for Bar Olympics registrations.
// Stripe sends a checkout.session.completed webhook here after a guest pays
// through the Bar Olympics payment link. The handler verifies the Stripe
// signature, reads the registration details carried on the payment, and
// creates one registration record in the Bar Olympics Airtable base.
// Airtable stays the single record of registrations. No guest facing form.
//
// Env vars (Netlify):
//   STRIPE_WEBHOOK_SECRET   required. Signing secret from the Stripe webhook endpoint.
//   STRIPE_SECRET_KEY       used to read the checkout line items for the player count.
//   AIRTABLE_TOKEN          Airtable token. AIRTABLE_BAR_TOKEN wins when set, for a
//                           token scoped to the Bar Olympics base only.
//   AIRTABLE_BAR_BASE_ID    defaults to the Bar Olympics registrations base.
//   AIRTABLE_BAR_TABLE      table name or id in that base. Defaults to Registrations.
//   STRIPE_BAR_PAYMENT_LINK payment link id to accept. Sessions from other links are ignored.
//
// Uses only Node built in modules, matching save-to-airtable.js in this repo.

const https = require("https");
const crypto = require("crypto");

const BASE_ID = process.env.AIRTABLE_BAR_BASE_ID || "app9yQCidfDEkBUHM";
const TABLE = process.env.AIRTABLE_BAR_TABLE || "Registrations";
const PAYMENT_LINK = process.env.STRIPE_BAR_PAYMENT_LINK || "plink_1USRbDHMtYcVn8hul4OaHUbn";
const PRICE_CENTS = 8500;

// ---------------------------------------------------------------------------
// Stripe signature check (v1 scheme: HMAC SHA256 over "timestamp.payload").
// ---------------------------------------------------------------------------
function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(",").forEach((piece) => {
    const idx = piece.indexOf("=");
    if (idx > 0) parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim();
  });
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Small https JSON helper.
// ---------------------------------------------------------------------------
function httpsJson(options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { /* leave null */ }
        resolve({ status: res.statusCode, body, json });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function airtableToken() {
  return process.env.AIRTABLE_BAR_TOKEN || process.env.AIRTABLE_TOKEN || "";
}

function airtableCreate(fields) {
  const token = airtableToken();
  if (!token) return Promise.reject(new Error("No Airtable token env var is set in Netlify."));
  const payload = JSON.stringify({ records: [{ fields }], typecast: true });
  return httpsJson(
    {
      hostname: "api.airtable.com",
      path: "/v0/" + BASE_ID + "/" + encodeURIComponent(TABLE),
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    },
    payload
  );
}

// Look for an existing record for this checkout session, so a Stripe retry
// never creates a duplicate registration.
async function airtableFindBySession(sessionId) {
  const token = airtableToken();
  if (!token) return null;
  const formula = encodeURIComponent("{Stripe Session} = '" + sessionId.replace(/'/g, "") + "'");
  const res = await httpsJson({
    hostname: "api.airtable.com",
    path: "/v0/" + BASE_ID + "/" + encodeURIComponent(TABLE) + "?filterByFormula=" + formula + "&maxRecords=1",
    method: "GET",
    headers: { Authorization: "Bearer " + token }
  });
  if (res.status >= 200 && res.status < 300 && res.json && Array.isArray(res.json.records)) {
    return res.json.records.length ? res.json.records[0] : null;
  }
  return null; // Field may not exist yet. Fall through and create the record.
}

// Player count: read the checkout line items with the Stripe secret key.
// Falls back to the amount paid divided by the $85 advance price.
async function stripeQuantity(session) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) {
    try {
      const res = await httpsJson({
        hostname: "api.stripe.com",
        path: "/v1/checkout/sessions/" + session.id + "/line_items?limit=10",
        method: "GET",
        headers: { Authorization: "Bearer " + key }
      });
      if (res.status >= 200 && res.status < 300 && res.json && Array.isArray(res.json.data)) {
        let total = 0;
        res.json.data.forEach((item) => { total += Number(item.quantity) || 0; });
        if (total > 0) return total;
      }
    } catch (e) { /* fall through to the amount based count */ }
  }
  const cents = Number(session.amount_total) || 0;
  return cents > 0 ? Math.max(1, Math.round(cents / PRICE_CENTS)) : 1;
}

// Pull one registration out of a completed checkout session.
function readRegistration(session) {
  const details = session.customer_details || {};
  const reg = {
    name: (details.name || "").trim(),
    email: (details.email || "").trim(),
    phone: (details.phone || "").trim(),
    teamName: "",
    teamMembers: "",
    notes: "",
    extras: []
  };
  (session.custom_fields || []).forEach((field) => {
    const label = ((field.label && field.label.custom) || field.key || "").toString();
    let value = "";
    if (field.text && field.text.value) value = field.text.value;
    else if (field.numeric && field.numeric.value != null) value = String(field.numeric.value);
    else if (field.dropdown && field.dropdown.value) value = field.dropdown.value;
    if (!value) return;
    const tag = (field.key + " " + label).toLowerCase().replace(/_/g, " ");
    if (tag.indexOf("names of everyone") >= 0) {
      if (!reg.teamMembers) {
        reg.teamMembers = value;
        reg.extras.push(label + ": " + value);
      }
    }
    else if (tag.indexOf("team") >= 0 && !reg.teamName) reg.teamName = value;
    else if (tag.indexOf("phone") >= 0 && !reg.phone) reg.phone = value;
    else if ((tag.indexOf("note") >= 0 || tag.indexOf("anything") >= 0 || tag.indexOf("add") >= 0) && !reg.notes) reg.notes = value;
    else reg.extras.push(label + ": " + value);
  });
  return reg;
}

function detailsBlock(session, reg, quantity, amountDollars, paidAtIso) {
  const lines = [
    "Source: Stripe",
    "Name: " + (reg.name || "(no name)"),
    "Email: " + (reg.email || ""),
    "Phone: " + (reg.phone || ""),
    "Team Name: " + (reg.teamName || ""),
    "Players: " + quantity,
    "Amount Paid: $" + amountDollars.toFixed(2),
    "Paid At: " + paidAtIso,
    "Payment Link: " + (session.payment_link || ""),
    "Stripe Session: " + session.id
  ];
  if (reg.notes) lines.push("Notes: " + reg.notes);
  reg.extras.forEach((line) => lines.push(line));
  return lines.join("\n");
}

exports.handler = async function (event) {
  // Health check for setup and monitoring.
  if (event.httpMethod === "GET") {
    return { statusCode: 200, body: "stripe-to-airtable is up" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET is not set in Netlify." }) };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  const headers = event.headers || {};
  const signatureHeader = headers["stripe-signature"] || headers["Stripe-Signature"] || "";
  if (!verifyStripeSignature(rawBody, signatureHeader, secret)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Signature check failed." }) };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bad JSON" }) };
  }

  if (payload.type !== "checkout.session.completed") {
    return { statusCode: 200, body: JSON.stringify({ received: true, ignored: payload.type || "unknown" }) };
  }

  const session = (payload.data && payload.data.object) || {};
  if (session.payment_link && PAYMENT_LINK && session.payment_link !== PAYMENT_LINK) {
    return { statusCode: 200, body: JSON.stringify({ received: true, ignored: "other payment link" }) };
  }

  const reg = readRegistration(session);
  const quantity = await stripeQuantity(session);
  const amountDollars = (Number(session.amount_total) || 0) / 100;
  const paidAtIso = session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString();
  const block = detailsBlock(session, reg, quantity, amountDollars, paidAtIso);

  // No duplicate rows when Stripe retries the webhook.
  try {
    const existing = await airtableFindBySession(session.id);
    if (existing) {
      return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true, record: existing.id }) };
    }
  } catch (e) { /* search is best effort */ }

  // Primary write: named columns, with the full labeled block in Details so
  // nothing is lost even if a column name differs in the base.
  const fields = {};
  fields["Full Name"] = reg.name || "(no name)";
  if (reg.email) fields["Email"] = reg.email;
  if (reg.phone) fields["Phone"] = reg.phone;
  if (reg.teamName) fields["Team Name"] = reg.teamName;
  if (reg.teamMembers) fields["Player Names"] = reg.teamMembers;
  fields["Players"] = quantity;
  fields["Amount Paid"] = amountDollars;
  fields["Paid At"] = paidAtIso;
  fields["Source"] = "Stripe";
  fields["Stripe Session"] = session.id;
  if (session.payment_link) fields["Payment Link"] = session.payment_link;
  if (reg.notes) fields["Notes"] = reg.notes;
  fields["Details"] = block;

  let result;
  try {
    result = await airtableCreate(fields);
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ received: true, saved: false, detail: String(e && e.message || e) })
    };
  }

  // Safety net, same pattern as save-to-airtable.js: if a column name is
  // wrong, retry with everything carried in one text field so the
  // registration still lands in the base.
  if (!(result.status >= 200 && result.status < 300) && result.status === 422) {
    result = await airtableCreate({ "Full Name": reg.name || "(no name)", Details: block });
  }
  if (!(result.status >= 200 && result.status < 300) && result.status === 422) {
    result = await airtableCreate({ Name: block.slice(0, 100000) });
  }
  if (!(result.status >= 200 && result.status < 300) && result.status === 422) {
    result = await airtableCreate({ "Full Name": block.slice(0, 100000) });
  }

  if (result.status >= 200 && result.status < 300) {
    let recordId = "";
    try { recordId = result.json.records[0].id; } catch (e) { /* fine */ }
    return { statusCode: 200, body: JSON.stringify({ received: true, saved: true, record: recordId }) };
  }
  // Return 500 so Stripe retries later instead of dropping the registration.
  return {
    statusCode: 500,
    body: JSON.stringify({ received: true, saved: false, status: result.status, detail: result.body })
  };
};
