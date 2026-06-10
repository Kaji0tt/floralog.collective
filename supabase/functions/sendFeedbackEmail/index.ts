import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const {
      name,
      email,
      message,
      reportType,
      subjectSuffix,
      source,
      platform,
      notifyUpdates,
    } = await req.json()

    const normalizedReportType = reportType === "bug"
      ? "bug"
      : reportType === "playtest_signup"
        ? "playtest_signup"
        : "feedback"
    const normalizedSubjectSuffix = typeof subjectSuffix === "string" ? subjectSuffix.trim() : ""
    const normalizedEmail = String(email || "").trim().toLowerCase()
    const normalizedPlatform = platform === "ios" ? "ios" : platform === "android" ? "android" : null
    const normalizedNotifyUpdates = Boolean(notifyUpdates)

    const hasMissingFeedbackFields = normalizedReportType !== "playtest_signup" && (!name || !normalizedEmail || !message)
    const hasMissingPlaytestFields = normalizedReportType === "playtest_signup" && (!normalizedEmail || !normalizedPlatform)

    if (hasMissingFeedbackFields || hasMissingPlaytestFields) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    const feedbackToAddress = Deno.env.get("FEEDBACK_TO_EMAIL") || "info@floralog.de"
    const bugReportToAddress = Deno.env.get("BUG_REPORT_TO_EMAIL") || "info@floralog.de"
    const playtestToAddress = Deno.env.get("PLAYTEST_TO_EMAIL") || "info@floralog.de"
    const fromAddress = Deno.env.get("FEEDBACK_FROM_EMAIL") || "noreply@floralog.de"
    const toAddress = normalizedReportType === "bug"
      ? bugReportToAddress
      : normalizedReportType === "playtest_signup"
        ? playtestToAddress
        : feedbackToAddress
    const subject = normalizedReportType === "bug"
      ? `[Bug-Report] ${normalizedSubjectSuffix || "Floralog"}`
      : normalizedReportType === "playtest_signup"
        ? `[Playtest Signup] ${normalizedPlatform === "ios" ? "iOS" : "Android"}`
        : normalizedSubjectSuffix
          ? `Floralog Feedback: ${normalizedSubjectSuffix}`
          : `Floralog Feedback von ${name}`

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    if (normalizedReportType === "playtest_signup") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")
      const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Supabase service not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })

      const { error: upsertError } = await adminClient
        .from("playtest_waitlist")
        .upsert({
          email: normalizedEmail,
          platform: normalizedPlatform,
          wants_updates: normalizedNotifyUpdates,
          source: source || "guest-playtest-direct",
          updated_at: new Date().toISOString(),
        }, { onConflict: "email" })

      if (upsertError) {
        console.error("playtest_waitlist upsert error:", upsertError)
        return new Response(JSON.stringify({ error: "Failed to persist signup" }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }
    }

    const bodyText = normalizedReportType === "playtest_signup"
      ? [
        `Typ: ${normalizedReportType}`,
        source ? `Quelle: ${source}` : null,
        `Google-E-Mail: ${normalizedEmail}`,
        `Plattform: ${normalizedPlatform}`,
        `Ueber Neuigkeiten informieren: ${normalizedNotifyUpdates ? "Ja" : "Nein"}`,
      ].filter(Boolean).join("\n")
      : [
        `Typ: ${normalizedReportType}`,
        source ? `Quelle: ${source}` : null,
        `Name: ${name}`,
        `E-Mail: ${normalizedEmail}`,
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
        reply_to: normalizedEmail,
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