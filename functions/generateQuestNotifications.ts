import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
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
    const notification = await base44.asServiceRole.entities.UserNotification.create({
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
    });

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