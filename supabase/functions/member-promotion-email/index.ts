import { createClient } from "@supabase/supabase-js";

const productionOrigin = Deno.env.get("MALL_ALLOWED_ORIGIN") ??
  "https://mall-virtual-one-ten.vercel.app";
const configuredOrigins = (Deno.env.get("MALL_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  productionOrigin,
  "https://maucore.cl",
  "https://www.maucore.cl",
  "https://staging.maucore.cl",
  "https://mall-virtual-one-ten.vercel.app",
  "https://mall-virtual-one-mu.vercel.app",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  ...configuredOrigins,
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : productionOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function createJsonResponse(request: Request) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders(request),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (request) => {
  const json = createJsonResponse(request);
  const origin = request.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "Origen no autorizado" }, 403);
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("PROMOTION_FROM_EMAIL");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Configuracion Supabase incompleta" }, 500);
  if (!resendKey || !fromEmail) return json({ error: "Configura RESEND_API_KEY y PROMOTION_FROM_EMAIL" }, 503);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sesion requerida" }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sesion invalida" }, 401);

  const payload = await request.json().catch(() => ({}));
  const mode = String(payload?.mode || "claim");
  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (mode === "announce-active") {
    const { data: isAdmin, error: adminError } = await authClient.rpc("is_mall_admin");
    if (adminError || isAdmin !== true) return json({ error: "Acceso administrador requerido" }, 403);

    const now = new Date().toISOString();
    const { data: promotions, error: promotionsError } = await admin
      .from("mall_promotions")
      .select("id, title, description, reward_label")
      .eq("active", true)
      .eq("notify_by_email", true)
      .is("announcement_sent_at", null)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .limit(10);
    if (promotionsError) return json({ error: promotionsError.message }, 500);
    if (!promotions?.length) return json({ ok: true, sent: 0 });

    const { data: members, error: membersError } = await admin
      .from("mall_members")
      .select("email, nickname")
      .eq("marketing_opt_in", true)
      .limit(5000);
    if (membersError) return json({ error: membersError.message }, 500);

    let sent = 0;
    for (const promotion of promotions) {
      const emails = (members || []).filter(member => member.email).map(member => ({
        from: fromEmail,
        to: [member.email],
        subject: `Nueva promocion en Mall Creaciones: ${promotion.title}`,
        html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:620px;margin:auto"><h1 style="font-size:24px">${escapeHtml(promotion.title)}</h1><p>Hola ${escapeHtml(member.nickname || "visitante")},</p><p>${escapeHtml(promotion.description || "Tenemos una nueva promocion para miembros inscritos.")}</p><p><strong>${escapeHtml(promotion.reward_label || "Revisa el mall para participar.")}</strong></p><p><a href="${escapeHtml(productionOrigin)}/">Entrar al Mall Creaciones</a></p></div>`,
      }));

      let promotionSent = true;
      for (let index = 0; index < emails.length; index += 100) {
        const batch = emails.slice(index, index + 100);
        if (!batch.length) continue;
        const response = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          promotionSent = false;
          break;
        }
        sent += batch.length;
      }
      if (promotionSent) {
        await admin.from("mall_promotions").update({ announcement_sent_at: new Date().toISOString() }).eq("id", promotion.id);
      }
    }
    return json({ ok: true, sent });
  }

  const promotionId = String(payload?.promotion_id || "").trim();
  const claimId = String(payload?.claim_id || "").trim();
  if (!promotionId) return json({ error: "promotion_id es obligatorio" }, 400);

  let claimQuery = admin
    .from("mall_promotion_claims")
    .select("id, promotion_id, auth_user_id, claimed_at, email_notification_status")
    .eq("promotion_id", promotionId)
    .eq("auth_user_id", authData.user.id);
  if (claimId) claimQuery = claimQuery.eq("id", claimId);
  const { data: claim, error: claimError } = await claimQuery.maybeSingle();
  if (claimError || !claim) return json({ error: "Participacion no encontrada" }, 404);
  if (claim.email_notification_status === "sent") return json({ ok: true, already_sent: true });

  const [{ data: promotion }, { data: member }] = await Promise.all([
    admin.from("mall_promotions").select("title, description, reward_label, notify_by_email").eq("id", promotionId).maybeSingle(),
    admin.from("mall_members").select("email, nickname, marketing_opt_in").eq("auth_user_id", authData.user.id).maybeSingle(),
  ]);
  const recipient = member?.email || authData.user.email;
  if (!promotion || !recipient) return json({ error: "Faltan datos de promocion o correo" }, 422);
  if (!promotion.notify_by_email) {
    await admin.from("mall_promotion_claims").update({ email_notification_status: "skipped" }).eq("id", claim.id);
    return json({ ok: true, skipped: true });
  }

  const title = escapeHtml(promotion.title || "Beneficio Mall Creaciones");
  const reward = escapeHtml(promotion.reward_label || "Beneficio registrado");
  const nickname = escapeHtml(member?.nickname || "visitante");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:620px;margin:auto">
      <h1 style="font-size:24px">${title}</h1>
      <p>Hola ${nickname}, registramos correctamente tu participacion en Mall Creaciones.</p>
      <p><strong>Beneficio:</strong> ${reward}</p>
      <p>${escapeHtml(promotion.description || "")}</p>
      <p style="color:#777;font-size:12px">Este correo fue enviado automaticamente a la cuenta inscrita en el mall.</p>
    </div>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient],
      subject: `Mall Creaciones: ${promotion.title}`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    await admin.from("mall_promotion_claims").update({ email_notification_status: "failed" }).eq("id", claim.id);
    return json({ error: "No se pudo enviar el correo", detail }, 502);
  }

  await admin
    .from("mall_promotion_claims")
    .update({ email_notification_status: "sent", email_notification_sent_at: new Date().toISOString() })
    .eq("id", claim.id);

  return json({ ok: true });
});
