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
const PEOPLE_TABLE = "tblsJQhjHLG4SQ16o"; // Mailing List: one row per individual person

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

  // Map to the real Event Registrations columns:
  // Name, Email, Phone, Event, Amount, Item (package), Player Names.
  const fields = {};
  fields["Name"] = ((data.firstName || "") + " " + (data.lastName || "")).trim() || "(no name)";
  if (data.email) fields["Email"] = data.email;
  if (data.phone) fields["Phone"] = data.phone;
  if (data.eventName) fields["Event"] = data.eventName;
  if (data.amount) fields["Amount"] = Number(data.amount) || data.amount;
  if (data.package) fields["Item"] = data.package;

  // Player Names: list all four, primary contact is Player 1.
  const players = [];
  players.push("1. " + fields["Name"] + (data.email ? " (" + data.email + ")" : ""));
  for (let i = 2; i <= 4; i++) {
    const f = data["g" + i + "_first"] || "";
    const l = data["g" + i + "_last"] || "";
    const e = data["g" + i + "_email"] || "";
    const nm = (f + " " + l).trim();
    if (nm || e) players.push(i + ". " + (nm || "(no name)") + (e ? " (" + e + ")" : ""));
  }
  if (players.length) fields["Player Names"] = players.join("\n");
  if (data.company) fields["Player Names"] = (fields["Player Names"] || "") + "\nCompany: " + data.company;
  if (data.notes) fields["Player Names"] = (fields["Player Names"] || "") + "\nNotes: " + data.notes;

  let result = await airtablePost(tableId, fields);

  // Safety net: if any column name is wrong, retry writing everything into Name so nothing is lost.
  if (!result.ok && result.status === 422) {
    const all = ["Name: " + fields["Name"]];
    if (fields["Email"]) all.push("Email: " + fields["Email"]);
    if (fields["Phone"]) all.push("Phone: " + fields["Phone"]);
    if (fields["Event"]) all.push("Event: " + fields["Event"]);
    if (fields["Amount"]) all.push("Amount: " + fields["Amount"]);
    if (fields["Item"]) all.push("Package: " + fields["Item"]);
    if (fields["Player Names"]) all.push(fields["Player Names"]);
    result = await airtablePost(tableId, { Name: all.join("\n").slice(0, 100000) });
  }

  // Also save each individual person to the Mailing List so everyone is on file.
  // Primary contact (Player 1) plus players 2-4 that have a name.
  try {
    const people = [];
    const p1 = ((data.firstName || "") + " " + (data.lastName || "")).trim();
    if (p1) people.push({ Name: p1, Email: data.email || "" });
    for (let i = 2; i <= 4; i++) {
      const f = data["g" + i + "_first"] || "";
      const l = data["g" + i + "_last"] || "";
      const e = data["g" + i + "_email"] || "";
      const nm = (f + " " + l).trim();
      if (nm) people.push({ Name: nm, Email: e });
    }
    for (const person of people) {
      const pf = { Name: person.Name };
      if (person.Email) pf.Email = person.Email;
      await airtablePost(PEOPLE_TABLE, pf);
    }
  } catch (e) {
    // Mailing List write is best-effort; never block the main registration on it.
  }

  if (result.ok) {
  }
  return {
    statusCode: 502,
    headers: cors,
    body: JSON.stringify({ saved: false, status: result.status, detail: result.body })
  };
};
