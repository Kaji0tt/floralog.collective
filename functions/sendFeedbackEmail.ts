const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const toAddress = Deno.env.get("FEEDBACK_TO_EMAIL") || "jascha.kruse@web.de";
    const fromAddress = Deno.env.get("FEEDBACK_FROM_EMAIL") || "noreply@blauzahn.eu";

    if (!resendKey) {
      return Response.json(
        { error: "Email not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const bodyText = `Name: ${name}\nE-Mail: ${email}\n\nNachricht:\n${message}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: `Floralog Feedback <${fromAddress}>`,
        to: [toAddress],
        subject: `Floralog Feedback von ${name}`,
        text: bodyText,
        reply_to: email
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", errorText);
      return Response.json(
        { error: "Failed to send email" },
        { status: 502, headers: corsHeaders }
      );
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("sendFeedbackEmail error:", error);
    return Response.json(
      { error: "Unexpected error" },
      { status: 500, headers: corsHeaders }
    );
  }
});
