import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
}

const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase()

const generateLegacyId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
}

const pickBaseUserFields = (row: Record<string, unknown> | null) => {
  if (!row) return null

  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    auth_id: row.auth_id,
    created_date: row.created_date,
    updated_date: row.updated_date,
  }
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
    const supabaseUrl = Deno.env.get("FLORALOG_URL")
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const body = await req.json()
    const action = body?.action

    if (action === "check") {
      const email = normalizeEmail(body?.email)
      if (!email) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      const { data, error } = await supabaseAdmin
        .from("baseUser")
        .select("id,email,display_name,auth_id,created_date,updated_date")
        .eq("email", email)
        .maybeSingle()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      return new Response(JSON.stringify({ data: pickBaseUserFields(data) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    if (action === "upsertRegistration") {
      const email = normalizeEmail(body?.email)
      const trimmedName = body?.displayName?.trim?.()
      const authId = body?.authId || null

      if (!email || !trimmedName) {
        return new Response(JSON.stringify({ error: "E-Mail und Name sind erforderlich." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      const now = new Date().toISOString()

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("baseUser")
        .select("id,email,display_name,auth_id,created_date,updated_date")
        .eq("email", email)
        .maybeSingle()

      if (existingError) {
        return new Response(JSON.stringify({ error: existingError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          email: existing.email || email,
          display_name: existing.display_name || trimmedName,
          updated_date: now,
        }

        if (authId && !existing.auth_id) {
          updatePayload.auth_id = authId
        }

        const { data: updated, error: updateError } = await supabaseAdmin
          .from("baseUser")
          .update(updatePayload)
          .eq("id", existing.id)
          .select("id,email,display_name,auth_id,created_date,updated_date")
          .single()

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          })
        }

        return new Response(JSON.stringify({ data: pickBaseUserFields(updated) }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      const insertPayload = {
        id: generateLegacyId(),
        email,
        display_name: trimmedName,
        auth_id: authId,
        created_date: now,
        updated_date: now,
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("baseUser")
        .insert(insertPayload)
        .select("id,email,display_name,auth_id,created_date,updated_date")
        .single()

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      return new Response(JSON.stringify({ data: pickBaseUserFields(inserted) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    if (action === "getProfile") {
      const email = normalizeEmail(body?.email)
      if (!email) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      const { data, error } = await supabaseAdmin
        .from("baseUser")
        .select("id,email,display_name,auth_id,created_date,updated_date")
        .eq("email", email)
        .maybeSingle()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      return new Response(JSON.stringify({ data: pickBaseUserFields(data) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
