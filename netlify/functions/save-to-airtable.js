// Universal form-to-Airtable saver for bffsa.org
// Any form on the site can POST here. Writes named columns when they exist,
// and ALWAYS writes a full labeled text block into "Details" so nothing is ever lost.
// Uses Node's built-in https (no fetch dependency). Reads AIRTABLE_TOKEN from Netlify env.

const https = require("https");

const BASE_ID = "app8fDCTTFMfNghmw";
// Table map: friendly form target -> Airtable table id.
// "event" (golf, summer classic registrations) goes to Event Registrations.
// Anything unknown falls back to Event Registrations too, so data is never dropped.
const TABLES = {
  event: "tbljHSZNvGUwZO5Xu",          // Event Registrations
  contact: "tbltno6crGDeiUOvq"         // Contacts
};
const DEFAULT_TABLE = "tbljHSZNvGUwZO5Xu";

function airtablePost(tableId, fields) {
  return new Promise((resolve, reject) => {
    const token = process.env.AIRTABLE_TOKEN;
    if (!token) return reject(new Error("AIRTABLE_TOKEN env var is not set in Netlify."));
    const payload = JSON.stringify({ records: [{ fields }], typecast: true });
    const req = https.request(
      {
        hostname: "api.airtable.com",
        path: "/v0/" + BASE_ID + "/" + tableId,
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, body });
          } else {
            resolve({ ok: false, status: res.statusCode, body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// Build a human-readable labeled block from whatever the form sent.
function buildDetails(data) {
  const lines = [];
  const order = [
    ["package", "Package"], ["amount", "Amount"], ["eventName", "Event"],
    ["firstName", "First Name"], ["lastName", "Last Name"],
    ["email", "Email"], ["phone", "Phone"], ["company", "Company"]
  ];
  order.forEach(([k, label]) => {
    if (data[k]) lines.push(label + ": " + data[k]);
  });
  // Foursome players 2-4
  for (let i = 2; i <= 4; i++) {
    const f = data["g" + i + "_first"] || "";
    const l = data["g" + i + "_last"] || "";
    const e = data["g" + i + "_email"] || "";
    const nm = (f + " " + l).trim();
    if (nm || e) lines.push("Player " + i + ": " + (nm || "(no name)") + (e ? " | " + e : ""));
  }
  if (data.notes) lines.push("Notes: " + data.notes);
  // Capture anything else not already covered, so no field is ever silently dropped.
  const known = new Set(order.map(o => o[0]).concat(
    ["g2_first","g2_last","g2_email","g3_first","g3_last","g3_email","g4_first","g4_last","g4_email","notes","_table"]
  ));
  Object.keys(data).forEach((k) => {
    if (!known.has(k) && data[k]) lines.push(k + ": " + data[k]);
  });
  return lines.join("\n");
}

exports.handler = async function (event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Use POST" }) };

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON" }) };
  }

  const tableId = TABLES[data._table] || DEFAULT_TABLE;
  const details = buildDetails(data);

  // Primary attempt: write friendly named columns + Details.
  const niceFields = {};
  if (data.firstName || data.lastName)
    niceFields["Name"] = ((data.firstName || "") + " " + (data.lastName || "")).trim();
  if (data.email) niceFields["Email"] = data.email;
  if (data.phone) niceFields["Phone"] = data.phone;
  if (data.company) niceFields["Company"] = data.company;
  if (data.package) niceFields["Package"] = data.package;
  if (data.amount) niceFields["Amount"] = data.amount;
  if (data.eventName) niceFields["Event"] = data.eventName;
  niceFields["Details"] = details;

  let result = await airtablePost(tableId, niceFields);

  // If named columns don't exist (422), retry with ONLY Details so the data still lands.
  if (!result.ok && result.status === 422) {
    result = await airtablePost(tableId, { Details: details });
  }
  // Final safety net: if Details also doesn't exist, write to the table's primary
  // text column "Name", which always exists, packing everything into it.
  if (!result.ok && result.status === 422) {
    result = await airtablePost(tableId, { Name: details.slice(0, 100000) });
  }

  if (result.ok) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ saved: true }) };
  }
  return {
    statusCode: 502,
    headers: cors,
    body: JSON.stringify({ saved: false, status: result.status, detail: result.body })
  };
};
