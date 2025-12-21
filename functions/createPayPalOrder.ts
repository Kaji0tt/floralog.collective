import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await req.json();

    if (!amount || amount < 1) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // PayPal OAuth Token holen
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    
    const auth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const { access_token } = await tokenResponse.json();

    // PayPal Order erstellen
    const orderResponse = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'EUR',
            value: amount.toFixed(2)
          },
          description: 'PlantDex Spende - Vielen Dank für deine Unterstützung! 🌱'
        }],
        application_context: {
          brand_name: 'PlantDex',
          user_action: 'PAY_NOW'
        }
      })
    });

    const order = await orderResponse.json();

    return Response.json({ orderID: order.id });

  } catch (error) {
    console.error('PayPal Order Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});