import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  console.log('🔵 createPayPalOrder function called');
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('❌ Supabase env not configured');
      return Response.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🔵 User authenticated:', user?.email);

    if (authError || !user) {
      console.log('❌ User not authenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('🔵 Request body:', body);
    const { amount } = body;

    if (!amount || amount < 1) {
      console.log('❌ Invalid amount:', amount);
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }
    console.log('🔵 Amount valid:', amount);

    // PayPal OAuth Token holen
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    console.log('🔵 Client ID exists:', !!clientId);
    console.log('🔵 Client Secret exists:', !!clientSecret);
    
    const auth = btoa(`${clientId}:${clientSecret}`);
    console.log('🔵 Requesting PayPal access token...');
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();
    console.log('🔵 Token response status:', tokenResponse.status);
    console.log('🔵 Token data:', tokenData);
    
    if (!tokenResponse.ok) {
      console.error('❌ Token request failed:', tokenData);
      return Response.json({ error: 'PayPal authentication failed', details: tokenData }, { status: 500 });
    }
    
    const { access_token } = tokenData;
    console.log('🔵 Access token received');

    // PayPal Order erstellen
    console.log('🔵 Creating PayPal order...');
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
    console.log('🔵 Order response status:', orderResponse.status);
    console.log('🔵 Order data:', order);
    
    if (!orderResponse.ok) {
      console.error('❌ Order creation failed:', order);
      return Response.json({ error: 'PayPal order creation failed', details: order }, { status: 500 });
    }
    
    console.log('✅ Order created successfully, ID:', order.id);
    return Response.json({ orderID: order.id });

  } catch (error) {
    console.error('❌ PayPal Order Error:', error);
    console.error('❌ Error stack:', error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});