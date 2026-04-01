import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
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

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from('PublicProfile')
      .select('role')
      .eq('user_email', user.email)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Verwende Service Role für Admin-Operationen
    const { notification_type, user_email, message, title, description, action_url } = await req.json();

    if (!notification_type || !user_email || !message) {
      return Response.json({ 
        error: 'Missing required fields: notification_type, user_email, message' 
      }, { status: 400 });
    }

    // Erstelle Benachrichtigung
    const { data: notification, error: insertError } = await supabaseAdmin
      .from('UserNotification')
      .insert({
      user_email,
      notification_type,
      message,
      title: title || "Neue Benachrichtigung",
      description: description || "",
      action_url: action_url || "Home",
      seen: false,
      display_location: "modal",
      priority: "medium",
        created_by: "system"
      })
      .select()
      .single();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      notification 
    });

  } catch (error) {
    console.error("Fehler beim Erstellen der Benachrichtigung:", error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});