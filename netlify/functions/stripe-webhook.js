const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Netlify Identity API helper
async function netlifyIdentityRequest(method, path, body) {
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_ACCESS_TOKEN;

  const res = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/identity/users${path}`,
    {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netlify Identity error ${res.status}: ${text}`);
  }

  const text = await res.text();
  if (!text || text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch(e) {
    console.error('Could not parse Netlify Identity response:', text.slice(0, 200));
    return {};
  }
}

async function findUserByEmail(email) {
  try {
    const data = await netlifyIdentityRequest('GET', `?email=${encodeURIComponent(email)}`);
    const users = data.users || (Array.isArray(data) ? data : []);
    return users.length > 0 ? users[0] : null;
  } catch(e) {
    console.error('findUserByEmail error:', e.message);
    return null;
  }
}

async function setUserRole(userId, role) {
  await netlifyIdentityRequest('PUT', `/${userId}`, {
    app_metadata: { roles: [role] }
  });
}

async function removeUserRole(userId) {
  await netlifyIdentityRequest('PUT', `/${userId}`, {
    app_metadata: { roles: ['free'] }
  });
}

async function inviteUser(email) {
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_ACCESS_TOKEN;

  const res = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/identity/users/invite`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    }
  );

  const responseText = await res.text();
  console.log(`Invite response status: ${res.status}`);
  console.log(`Invite response body: ${responseText.slice(0, 300)}`);

  if (!res.ok) {
    console.error(`Invite failed with status ${res.status}: ${responseText}`);
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch(e) {
    console.error('Could not parse invite response:', responseText.slice(0, 200));
    return null;
  }
}

function getTierFromAmount(amount) {
  if (amount >= 1200) return 'bound';
  if (amount >= 500) return 'devoted';
  return 'free';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch(err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {

      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const email = session.customer_details?.email || session.customer_email;
        if (!email) {
          console.log('No email found in session — skipping');
          break;
        }

        console.log(`Processing checkout for ${email}`);

        let tier = 'devoted';
        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const amount = subscription.items.data[0]?.price?.unit_amount || 500;
            tier = getTierFromAmount(amount);
            console.log(`Subscription amount: ${amount} cents → tier: ${tier}`);
          } catch(e) {
            console.error('Could not retrieve subscription:', e.message);
          }
        }

        console.log(`Tier determined: ${tier}`);

        let user = await findUserByEmail(email);
        if (user) {
          await setUserRole(user.id, tier);
          console.log(`Updated ${email} to role: ${tier}`);
        } else {
          console.log(`User not found, inviting ${email}...`);
          const invited = await inviteUser(email);
          if (invited && invited.id) {
            await setUserRole(invited.id, tier);
            console.log(`Invited ${email} with role: ${tier}`);
          } else {
            console.error('Invite did not return a valid user ID');
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const customerId = subscription.customer;
        const customer = await stripe.customers.retrieve(customerId);
        const email = customer.email;
        if (!email) break;

        const user = await findUserByEmail(email);
        if (user) {
          await removeUserRole(user.id);
          console.log(`Removed paid role from ${email}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch(err) {
    console.error('Webhook handler error:', err.message);
    console.error(err.stack);
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
