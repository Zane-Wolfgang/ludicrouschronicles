// Netlify Function — adds email to Brevo Newsletter list (ID 3)
// Uses native fetch (Node 18+) — no external dependencies needed

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let email;
  try {
    const body = JSON.parse(event.body);
    email = body.email;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        listIds: [3],
        updateEnabled: true,
      }),
    });

    // 201 = created, 204 = already exists (updated) — both are success
    if (res.status === 201 || res.status === 204) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    const data = await res.json();
    // Brevo returns 400 with code "duplicate_parameter" if already exists
    if (data.code === 'duplicate_parameter') {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    console.error('Brevo error:', data);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not subscribe' }) };

  } catch(e) {
    console.error('Subscribe function error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
