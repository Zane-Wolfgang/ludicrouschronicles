const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Map Stripe price IDs to site roles
// These get filled in automatically from the event data
const TIER_MAP = {
  devoted: 'devoted',   // $5/mo
  bound: 'bound',       // $12/mo
};

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

  return res.json().catch(() => ({}));
}

// Find a Netlify Identity user by email
async function findUserByEmail(email) {
  try {
    const data = await netlifyIdentityRequest('GET', `?email=${encodeURIComponent(email)}`);
    return data.users && data.users.length > 0 ? data.users[0] : null;
  } catch(e) {
    return null;
  }
}

// Set a user's role
async function setUserRole(userId, role) {
  await netlifyIdentityRequest('PUT', `/${userId}`, {
    app_metadata: { roles: [role] }
  });
}

// Remove a user's paid role (revert to free)
async function removeUserRole(userId) {
  await netlifyIdentityRequest('PUT', `/${userId}`, {
    app_metadata: { roles: ['free'] }
  });
}

// Determine tier from Stripe price amount
function getTierFromAmount(amount) {
  // amount is in cents
  if (amount >= 1200) return 'bound';   // $12
  if (amount >= 500) return 'devoted';  // $5
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
        if (!email) break;

        // Get the subscription to find the price/amount
        let tier = 'devoted'; // default
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const amount = subscription.items.data[0]?.price?.unit_amount || 500;
          tier = getTierFromAmount(amount);
        }

        // Find or invite user in Netlify Identity
        let user = await findUserByEmail(email);
        if (user) {
          await setUserRole(user.id, tier);
          console.log(`Updated ${email} to role: ${tier}`);
        } else {
          // User doesn't exist yet — invite them
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
          const invited = await res.json();
          if (invited.id) {
            await setUserRole(invited.id, tier);
            console.log(`Invited ${email} with role: ${tier}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Member cancelled — revert to free
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
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
