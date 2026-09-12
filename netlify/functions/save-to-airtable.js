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
  contact: "tbltno6crGDeiUOvq",        // Contacts
  sponsor: "tbltno6crGDeiUOvq",        // Sponsors live in Contacts with sponsor fields
  application: "tblSl803SSFkQN08q"     // Student Applications
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

// Turn a value into a Number if it looks numeric, otherwise leave it out.
function num(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
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

  // Sponsor signups: write Contacts with sponsor-specific columns.
  if (data._table === "sponsor") {
    const sf = {};
    sf["Name"] = (data.name || "").trim() || "(no name)";
    if (data.email) sf["Email"] = data.email;
    if (data.phone) sf["Phone"] = data.phone;
    sf["Source"] = ["Sponsor"];
    if (data.tier) sf["Sponsor Tier"] = data.tier;
    if (Array.isArray(data.sports) && data.sports.length) sf["Sponsor Sports"] = data.sports;
    if (Array.isArray(data.background) && data.background.length) sf["Sponsor Background"] = data.background;
    if (data.story) sf["Sponsor Story"] = data.story;
    if (data.knownAthlete) sf["Known Athlete"] = data.knownAthlete;
    sf["Sponsor Status"] = "New";
    const sres = await airtablePost(tableId, sf);
    return {
      statusCode: sres.ok ? 200 : 502,
      headers: cors,
      body: JSON.stringify(sres.ok ? { ok: true } : { ok: false, detail: sres.body })
    };
  }

  // Student applications: write directly to Student Applications with real field names.
  if (data._table === "application") {
    const af = {};
    af["Full Name"] = (data.name || "").trim() || "(no name)";
    if (data.dob) af["Date of Birth"] = data.dob;
    if (data.gender) af["Gender"] = data.gender;
    if (data.phone) af["Phone"] = data.phone;
    if (data.email) af["Email"] = data.email;
    if (data.address) af["Address"] = data.address;
    if (data.school) af["School"] = data.school;
    if (data.grade) af["Grade"] = data.grade;
    const gradyear = num(data.gradyear); if (gradyear !== undefined) af["Graduation Year"] = gradyear;
    const gpa = num(data.gpa); if (gpa !== undefined) af["GPA"] = gpa;
    if (data.p1name) af["Parent 1 Name"] = data.p1name;
    if (data.p1phone) af["Parent 1 Phone"] = data.p1phone;
    if (data.p1email) af["Parent 1 Email"] = data.p1email;
    if (data.p2name) af["Parent 2 Name"] = data.p2name;
    if (data.p2phone) af["Parent 2 Phone"] = data.p2phone;
    if (data.p2email) af["Parent 2 Email"] = data.p2email;
    const household = num(data.household); if (household !== undefined) af["Household Size"] = household;
    if (Array.isArray(data.benefits) && data.benefits.length) af["Federal Benefits"] = data.benefits;
    const income = num(data.income); if (income !== undefined) af["Parents Adjusted Total Income"] = income;
    if (data.sports) af["Sports and Coaches"] = data.sports;
    if (data.video) af["Highlight Video URL"] = data.video;
    if (data.extra) af["Extracurriculars"] = data.extra;
    if (data.why) af["Why BFFSA"] = data.why;
    if (data.goals) af["Goals"] = data.goals;
    if (data.heard) af["How Heard"] = data.heard;
    af["Photo/Media Release"] = !!data.release;
    if (data.signature) af["Athlete Signature"] = data.signature;

    const ares = await airtablePost(tableId, af);
    if (ares.ok) {
      // Best-effort: also add the applicant to the Mailing List so they're on file.
      try {
        const pf = { Name: af["Full Name"] };
        if (data.email) pf.Email = data.email;
        await airtablePost(PEOPLE_TABLE, pf);
      } catch (e) {}
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 502, headers: cors, body: JSON.stringify({ ok: false, detail: ares.body }) };
  }

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

  // Fixed: this used to fall through to an unconditional 502 even on success.
  if (result.ok) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, saved: true }) };
  }
  return {
    statusCode: 502,
    headers: cors,
    body: JSON.stringify({ saved: false, status: result.status, detail: result.body })
  };
};
