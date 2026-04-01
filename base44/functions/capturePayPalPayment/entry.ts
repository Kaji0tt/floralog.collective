import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  console.log('🔵 capturePayPalPayment function called');
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🔵 User authenticated:', user?.email);

    if (authError || !user) {
      console.log('❌ User not authenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('🔵 Request body:', body);
    const { orderID } = body;

    if (!orderID) {
      console.log('❌ Missing orderID');
      return Response.json({ error: 'Missing orderID' }, { status: 400 });
    }
    console.log('🔵 OrderID:', orderID);

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

    // PayPal Payment erfassen
    console.log('🔵 Capturing payment for order:', orderID);
    const captureResponse = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const capture = await captureResponse.json();
    console.log('🔵 Capture response status:', captureResponse.status);
    console.log('🔵 Capture data:', capture);
    
    if (!captureResponse.ok) {
      console.error('❌ Capture failed:', capture);
      return Response.json({ error: 'PayPal capture failed', details: capture }, { status: 500 });
    }

    if (capture.status === 'COMPLETED') {
      console.log('✅ Payment completed successfully');
      
      // Donor-Status setzen
      console.log('🔵 Setting donor_status for user:', user.email);
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { donor_status: true }
      });
      console.log('✅ User donor_status updated');

      // Public Profile aktualisieren
      console.log('🔵 Updating PublicProfile...');
      const { error: profileError } = await supabaseAdmin
        .from('PublicProfile')
        .upsert({
          user_email: user.email,
          donor_status: true,
          updated_date: new Date().toISOString()
        }, { onConflict: 'user_email' });

      if (profileError) {
        console.error('❌ PublicProfile update failed:', profileError);
      } else {
        console.log('✅ PublicProfile updated');
      }

      return Response.json({ 
        success: true, 
        message: 'Vielen Dank für deine Spende! 💚 Du hast jetzt den Donor-Status freigeschaltet!' 
      });
    } else {
      console.log('⚠️ Payment status not COMPLETED:', capture.status);
      return Response.json({ error: 'Payment not completed', status: capture.status }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ PayPal Capture Error:', error);
    console.error('❌ Error stack:', error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});