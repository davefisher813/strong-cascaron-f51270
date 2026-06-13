// Writes BFFSA student applications to Airtable. No secrets in the browser.
const BASE_ID = 'app8fDCTTFMfNghmw';
const TABLE_ID = 'tblSl803SSFkQN08q';
const FILE_FIELD_ID = 'fldTi3XsTxLQ9bxhx'; // Personal Statement File

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  const token =
    process.env.AIRTABLE_TOKEN ||
    process.env.AIRTABLE_API_KEY ||
    process.env.AIRTABLE_PAT ||
    process.env.AIRTABLE_KEY;
  if (!token) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server is missing the Airtable token env var.' }) };
  }

  let data;
  try { data = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Bad JSON.' }) }; }

  const file = data.__file;
  delete data.__file;

  const fields = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (v === '' || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    fields[k] = v;
  }

  let recordId;
  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, headers: cors, body: JSON.stringify({ error: (json && json.error) || 'Airtable rejected the record.' }) };
    }
    recordId = json.id;
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Could not reach Airtable.' }) };
  }

  let fileUploaded = false;
  if (file && file.base64 && recordId) {
    try {
      const up = await fetch(`https://content.airtable.com/v0/${BASE_ID}/${recordId}/${FILE_FIELD_ID}/uploadAttachment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.contentType || 'application/octet-stream',
          file: file.base64,
          filename: file.filename || 'personal-statement',
        }),
      });
      fileUploaded = up.ok;
    } catch (e) { fileUploaded = false; }
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, id: recordId, fileUploaded }) };
};
