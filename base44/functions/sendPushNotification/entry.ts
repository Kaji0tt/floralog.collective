import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Supabase env not configured');
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

    // Authentifizierung prüfen
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipientEmail, title, body, data } = await req.json();

    if (!recipientEmail || !title || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // VAPID Keys aus Environment Variables
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return Response.json({ error: 'Push notifications not configured' }, { status: 500 });
    }

    // Web-push konfigurieren
    webpush.setVapidDetails(
      'mailto:noreply@plantdex.app',
      vapidPublicKey,
      vapidPrivateKey
    );

    // Empfänger-Subscription abrufen
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('PublicProfile')
      .select('id, user_email, push_subscription')
      .eq('user_email', recipientEmail)
      .single();

    if (recipientError || !recipient || !recipient.push_subscription) {
      console.log('User has no push subscription:', recipientEmail);
      return Response.json({ 
        success: false, 
        message: 'User has not enabled push notifications' 
      });
    }

    // Push Notification senden
    const payload = JSON.stringify({
      title,
      body,
      icon: 'https://blauzahn.eu/PlantDexIcon.png',
      badge: 'https://blauzahn.eu/PlantDexIcon.png',
      data: data || {}
    });

    try {
      await webpush.sendNotification(
        JSON.parse(recipient.push_subscription),
        payload
      );

      return Response.json({ 
        success: true, 
        message: 'Push notification sent' 
      });
    } catch (error) {
      console.error('Failed to send push notification:', error);
      
      // Wenn Subscription ungültig ist, entfernen
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabaseAdmin
          .from('PublicProfile')
          .update({ push_subscription: null })
          .eq('id', recipient.id);
      }
      
      return Response.json({ 
        success: false, 
        message: 'Failed to send notification',
        error: error.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});