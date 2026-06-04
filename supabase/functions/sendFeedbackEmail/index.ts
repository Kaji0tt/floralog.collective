const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const { name, email, message, reportType, subjectSuffix, source } = await req.json()

    const normalizedReportType = reportType === "bug" ? "bug" : "feedback"
    const normalizedSubjectSuffix = typeof subjectSuffix === "string" ? subjectSuffix.trim() : ""

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    const feedbackToAddress = Deno.env.get("FEEDBACK_TO_EMAIL") || "info@floralog.de"
    const bugReportToAddress = Deno.env.get("BUG_REPORT_TO_EMAIL") || "info@floralog.de"
    const fromAddress = Deno.env.get("FEEDBACK_FROM_EMAIL") || "noreply@floralog.de"
    const toAddress = normalizedReportType === "bug" ? bugReportToAddress : feedbackToAddress
    const subject = normalizedReportType === "bug"
      ? `[Bug-Report] ${normalizedSubjectSuffix || "Floralog"}`
      : normalizedSubjectSuffix
        ? `Floralog Feedback: ${normalizedSubjectSuffix}`
        : `Floralog Feedback von ${name}`

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const bodyText = [
      `Typ: ${normalizedReportType}`,
      source ? `Quelle: ${source}` : null,
      `Name: ${name}`,
      `E-Mail: ${email}`,
      "",
      "Nachricht:",
      message,
    ].filter(Boolean).join("\n")

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `Floralog Feedback <${fromAddress}>`,
        to: [toAddress],
        subject,
        text: bodyText,
        reply_to: email,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error("Resend error:", errorText)
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error) {
    console.error("sendFeedbackEmail error:", error)
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})