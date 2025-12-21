import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderID } = await req.json();

    if (!orderID) {
      return Response.json({ error: 'Missing orderID' }, { status: 400 });
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

    // PayPal Payment erfassen
    const captureResponse = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const capture = await captureResponse.json();

    if (capture.status === 'COMPLETED') {
      // Donor-Status setzen
      await base44.auth.updateMe({ donor_status: true });

      // Public Profile aktualisieren
      const profiles = await base44.asServiceRole.entities.PublicProfile.list();
      const existingProfile = profiles.find(p => p.user_email?.toLowerCase() === user.email?.toLowerCase());

      if (existingProfile) {
        await base44.asServiceRole.entities.PublicProfile.update(existingProfile.id, {
          donor_status: true
        });
      }

      return Response.json({ 
        success: true, 
        message: 'Vielen Dank für deine Spende! 💚 Du hast jetzt den Donor-Status freigeschaltet!' 
      });
    } else {
      return Response.json({ error: 'Payment not completed' }, { status: 400 });
    }

  } catch (error) {
    console.error('PayPal Capture Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});