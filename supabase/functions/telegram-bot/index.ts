import { createClient } from "@supabase/supabase-js";

const allowedOrigin =
  Deno.env.get("MALL_ALLOWED_ORIGIN") ??
  "https://mall-virtual-one-ten.vercel.app";
const telegramWebhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const internalNotifySecret = Deno.env.get("MALL_INTERNAL_NOTIFY_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-mall-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!telegramBotToken) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN en la Edge Function.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );

  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.description || "Telegram no aceptó el envío.");
  }
  return result;
}

function escapeTelegramText(value: string) {
  return String(value || "").replace(/[<>]/g, "");
}

async function handleNotifyMessage(payload: Record<string, unknown>) {
  const localCode = String(payload.local_code || "").trim();
  const storeId = String(payload.store_id || "").trim();
  const senderName = escapeTelegramText(
    String(payload.sender_name || "Visitante"),
  );
  const senderEmail = escapeTelegramText(
    String(payload.sender_email || "Sin correo"),
  );
  const message = escapeTelegramText(String(payload.message || ""));

  if (!message || (!localCode && !storeId)) {
    return json(
      { ok: false, error: "Falta local_code/store_id o message." },
      400,
    );
  }

  const query = adminClient
    .from("stores")
    .select(
      "id, local_code, name, telegram_notifications_enabled, telegram_chat_id, telegram_chat_username, service_status",
    )
    .limit(1);

  const { data: store, error } = localCode
    ? await query.eq("local_code", localCode).maybeSingle()
    : await query.eq("id", storeId).maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!store)
    return json(
      { ok: false, error: "No encontré el local para notificar." },
      404,
    );
  if (!store.telegram_notifications_enabled || !store.telegram_chat_id) {
    return json({
      ok: true,
      skipped: true,
      reason: "Local sin Telegram conectado.",
    });
  }

  const text =
    `Nuevo mensaje en el Mall\n` +
    `Local: ${escapeTelegramText(store.local_code || store.id)} - ${escapeTelegramText(store.name || "Sin nombre")}\n` +
    `De: ${senderName}\n` +
    `Correo: ${senderEmail}\n` +
    `Estado local: ${escapeTelegramText(store.service_status || "active")}\n\n` +
    `${message}`;

  await sendTelegramMessage(store.telegram_chat_id, text);
  return json({ ok: true });
}

function isMessageInsertWebhook(payload: Record<string, unknown>) {
  const eventType = String(payload.type || "").toUpperCase();
  const table = String(payload.table || "");
  return (
    eventType === "INSERT" &&
    (table === "mall_messages" || table === "contact_messages")
  );
}

function normalizeWebhookRecord(record: Record<string, unknown>) {
  return {
    local_code: record.local_code,
    store_id: record.store_id,
    sender_name: record.sender_name || record.name,
    sender_email: record.sender_email || record.email,
    message: record.message || record.requirement,
  };
}

function validateInternalNotifySecret(request: Request) {
  if (!internalNotifySecret) {
    return json(
      { ok: false, error: "Notificacion directa deshabilitada." },
      403,
    );
  }

  const receivedSecret = request.headers.get("x-mall-notify-secret") ?? "";
  if (receivedSecret !== internalNotifySecret) {
    return json({ ok: false, error: "Notificacion no autorizada." }, 401);
  }

  return null;
}

async function handleTelegramWebhook(update: Record<string, unknown>) {
  const message = (update.message || update.edited_message) as
    | Record<string, unknown>
    | undefined;
  const chat = message?.chat as Record<string, unknown> | undefined;
  const from = message?.from as Record<string, unknown> | undefined;
  const text = String(message?.text || "").trim();
  const chatId = chat?.id ? String(chat.id) : "";
  const username = String(from?.username || "").trim() || null;

  if (!chatId || !text) return json({ ok: true, ignored: true });

  if (text.toLowerCase() === "/stop") {
    const { error } = await adminClient
      .from("stores")
      .update({
        telegram_notifications_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("telegram_chat_id", chatId);

    if (!error) {
      await sendTelegramMessage(
        chatId,
        "Notificaciones desactivadas. Puedes reactivarlas desde el panel del local.",
      );
    }
    return json({ ok: true });
  }

  const match = text.match(/^\/start\s+mall_([^_]+)_([A-Z0-9]+)$/i);
  if (!match) {
    await sendTelegramMessage(
      chatId,
      "Hola. Abre el enlace del bot desde tu panel del local para conectar Telegram con el mall.",
    );
    return json({ ok: true, ignored: true });
  }

  const [, localCode, linkCode] = match;
  const { data: store, error } = await adminClient
    .from("stores")
    .select("id, local_code, name, telegram_link_code")
    .eq("local_code", localCode)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (
    !store ||
    String(store.telegram_link_code || "")
      .trim()
      .toUpperCase() !== String(linkCode).trim().toUpperCase()
  ) {
    await sendTelegramMessage(
      chatId,
      "No pude validar este enlace. Regenera el código desde el panel del local e inténtalo otra vez.",
    );
    return json({ ok: true, linked: false });
  }

  const { error: updateError } = await adminClient
    .from("stores")
    .update({
      telegram_notifications_enabled: true,
      telegram_chat_id: chatId,
      telegram_chat_username: username,
      telegram_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", store.id);

  if (updateError) {
    await sendTelegramMessage(
      chatId,
      "Se validó el enlace, pero no pude guardar la conexión del local.",
    );
    return json({ ok: false, error: updateError.message }, 500);
  }

  await sendTelegramMessage(
    chatId,
    `Telegram conectado correctamente al local ${escapeTelegramText(store.local_code || store.id)} - ${escapeTelegramText(store.name || "Sin nombre")}. Desde ahora recibirás avisos de mensajes nuevos.`,
  );
  return json({ ok: true, linked: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      { ok: false, error: "Faltan credenciales de Supabase en la Function." },
      500,
    );
  }

  const body = await request.json().catch(() => ({}));

  if (body && typeof body === "object" && "update_id" in body) {
    if (!telegramWebhookSecret) {
      return json(
        { ok: false, error: "Falta TELEGRAM_WEBHOOK_SECRET en la Function." },
        500,
      );
    }
    const receivedSecret =
      request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (receivedSecret !== telegramWebhookSecret) {
      return json({ ok: false, error: "Webhook no autorizado." }, 401);
    }
    return handleTelegramWebhook(body as Record<string, unknown>);
  }

  if (
    body &&
    typeof body === "object" &&
    isMessageInsertWebhook(body as Record<string, unknown>)
  ) {
    const authError = validateInternalNotifySecret(request);
    if (authError) return authError;

    const record = (body.record || {}) as Record<string, unknown>;
    return handleNotifyMessage(normalizeWebhookRecord(record));
  }

  if (body?.action === "notify_message") {
    const authError = validateInternalNotifySecret(request);
    if (authError) return authError;
    return handleNotifyMessage((body.payload || {}) as Record<string, unknown>);
  }

  return json({ ok: false, error: "Payload no reconocido." }, 400);
});
