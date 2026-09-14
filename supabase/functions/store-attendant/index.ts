import { createClient } from "@supabase/supabase-js";

const allowedOrigins = new Set([
  "https://maucore.cl",
  "https://www.maucore.cl",
  "https://staging.maucore.cl",
  "https://mall-virtual-one-ten.vercel.app",
  "https://mall-virtual-one-mu.vercel.app",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://mall-virtual-one-ten.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function limitWords(value: unknown, maxWords: number) {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? words.join(" ") : `${words.slice(0, maxWords).join(" ")}…`;
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output || [])
    .flatMap((item: any) => item?.content || [])
    .map((item: any) => item?.text || "")
    .filter(Boolean)
    .join("\n");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function directAnswer(question: string, store: any, products: any[], faq: any[]) {
  const q = normalize(question);
  const whatsapp = store.whatsapp || store.contact_phone || "";
  const email = store.contact_email || "";

  if (/\b(whatsapp|telefono|celular|contacto|contactar)\b/.test(q) && whatsapp) {
    return { source: "direct", answer: `Puedes contactar a ${store.name} por WhatsApp al ${whatsapp}${email ? ` o por correo a ${email}` : ""}.` };
  }
  if (/\b(correo|email|mail)\b/.test(q) && email) {
    return { source: "direct", answer: `El correo de ${store.name} es ${email}.` };
  }

  const storeBrief = String(store?.store_brief || "").trim();
  if (storeBrief && /\b(de que trata|quienes son|que ofrecen|que hacen|de que se trata|sobre la tienda|sobre ustedes|cuentame de la tienda|cuentame del local|informacion de la tienda|informacion del local)\b/.test(q)) {
    return { source: "direct", answer: storeBrief };
  }

  const productMatch = products.find((product) => {
    const name = normalize(product.name);
    return name && (q.includes(name) || name.split(" ").some((part: string) => part.length > 3 && q.includes(part)));
  });
  if (productMatch) {
    const description = String(productMatch.description || "").trim();
    return {
      source: "direct",
      answer: `${productMatch.name}${productMatch.price ? ` cuesta ${productMatch.price}` : " está disponible"}.${description ? ` ${description}` : ""}`,
    };
  }
  if (/\b(producto|productos|catalogo|venden|tienen|ofrecen)\b/.test(q) && products.length) {
    const sample = products.slice(0, 5).map((product) => `${product.name}${product.price ? ` (${product.price})` : ""}`).join(", ");
    return { source: "direct", answer: `En ${store.name} puedes encontrar: ${sample}. Puedes abrir la placa dorada del local para ver el catálogo completo.` };
  }

  const questionTerms = new Set(q.split(" ").filter((term) => term.length > 3));
  let bestFaq: any = null;
  let bestScore = 0;
  for (const item of faq || []) {
    const terms = normalize(item?.question).split(" ").filter((term) => term.length > 3);
    const score = terms.filter((term) => questionTerms.has(term)).length;
    if (score > bestScore) {
      bestScore = score;
      bestFaq = item;
    }
  }
  if (bestFaq && bestScore >= 1 && bestFaq.answer) return { source: "faq", answer: String(bestFaq.answer) };
  return null;
}

function directMallAnswer(question: string, settings: any) {
  const q = normalize(question);
  const brief = String(settings?.mall_brief || '').trim();
  if (brief && /\b(que es|de que trata|que ofrece|que hay|locales|tiendas|mall|centro comercial|informacion general|horario|ubicacion|como llegar|servicios)\b/.test(q)) {
    return { source: "direct", answer: brief };
  }
  const questionTerms = new Set(q.split(" ").filter((term) => term.length > 3));
  let bestFaq: any = null;
  let bestScore = 0;
  for (const item of Array.isArray(settings?.faq) ? settings.faq : []) {
    const terms = normalize(item?.question).split(" ").filter((term) => term.length > 3);
    const score = terms.filter((term) => questionTerms.has(term)).length;
    if (score > bestScore) {
      bestScore = score;
      bestFaq = item;
    }
  }
  if (bestFaq && bestScore >= 1 && bestFaq.answer) return { source: "faq", answer: String(bestFaq.answer) };
  return null;
}

async function loadStore(admin: any, code: string, mallId = "") {
  let byLocalQuery = admin.from("stores").select("*").ilike("local_code", code);
  if (mallId) byLocalQuery = byLocalQuery.eq("mall_id", mallId);
  const byLocal = await byLocalQuery.maybeSingle();
  if (byLocal.data) return byLocal.data;
  let byIdQuery = admin.from("stores").select("*").ilike("id", code);
  if (mallId) byIdQuery = byIdQuery.eq("mall_id", mallId);
  const byId = await byIdQuery.maybeSingle();
  return byId.data || null;
}

async function sendLeadEmail(store: any, lead: any) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("BOT_FROM_EMAIL") || Deno.env.get("PROMOTION_FROM_EMAIL");
  if (!resendKey || !fromEmail || !store.contact_email) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [store.contact_email],
      subject: `Nueva consulta desde el asistente de ${store.name}`,
      text: `Nombre: ${lead.visitor_name}\nEmail: ${lead.email || "-"}\nWhatsApp: ${lead.phone || "-"}\nPreferencia: ${lead.contact_preference}\nConsulta: ${lead.question_summary || "-"}`,
    }),
  });
  return response.ok;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(request, { error: "Configuración Supabase incompleta." }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const body = await request.json().catch(() => ({}));
  const storeCode = String(body?.store_code || "").trim().slice(0, 40);
  const mallId = String(body?.mall_id || "").trim();
  const sessionKey = String(body?.session_id || "").trim().slice(0, 120);
  const action = String(body?.action || "message");
  const isMallAssistant = body?.scope === "mall" || action === "mall_message";
  if (!sessionKey) return json(request, { error: "Falta la sesión." }, 400);
  if (isMallAssistant && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mallId)) {
    return json(request, { error: "Falta un mall válido." }, 400);
  }

  let store: any = null;
  let settings: any = null;
  if (isMallAssistant) {
    const result = await admin
      .from("mall_assistant_settings")
      .select("*")
      .eq("id", 1)
      .eq("mall_id", mallId)
      .maybeSingle();
    settings = result.data;
    if (result.error || !settings?.enabled) return json(request, { error: "El asistente del mall no está activo." }, 404);
  } else {
    if (!storeCode) return json(request, { error: "Falta el local." }, 400);
    store = await loadStore(admin, storeCode, mallId);
    if (!store || !store.owner_id) return json(request, { error: "Este local no tiene un asistente disponible." }, 404);
    const { data, error: settingsError } = await admin
      .from("store_bot_settings")
      .select("*")
      .eq("store_id", store.id)
      .maybeSingle();
    settings = data;
    if (settingsError || !settings?.enabled) return json(request, { error: "El asistente de este local no está activo." }, 404);
  }

  if (action === "lead" && !isMallAssistant) {
    const visitorName = String(body?.visitor_name || "").trim().slice(0, 120);
    const email = String(body?.email || "").trim().slice(0, 200);
    const phone = String(body?.phone || "").trim().slice(0, 40);
    const preference = ["email", "whatsapp", "cualquiera"].includes(body?.contact_preference) ? body.contact_preference : "cualquiera";
    const summary = String(body?.question_summary || "").trim().slice(0, 1000);
    if (visitorName.length < 2 || (!email && !phone) || body?.consent !== true) {
      return json(request, { error: "Ingresa tu nombre, un medio de contacto y autoriza el envío." }, 422);
    }
    const existingLead = await admin
      .from("store_bot_leads")
      .select("id")
      .eq("store_id", store.id)
      .eq("session_key", sessionKey)
      .maybeSingle();
    if (existingLead.data?.id) return json(request, { ok: true, lead_id: existingLead.data.id, duplicate: true, emailed: false });

    const leadIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("cf-connecting-ip")
      || "unknown";
    const leadClientHash = await sha256(`${serviceRoleKey.slice(-24)}:${store.id}:lead:${leadIp}`);
    const { data: leadRate } = await admin
      .from("store_bot_rate_limits")
      .select("request_count, window_started_at")
      .eq("store_id", store.id)
      .eq("client_hash", leadClientHash)
      .maybeSingle();
    const leadWindowExpired = !leadRate || Date.now() - new Date(leadRate.window_started_at).getTime() >= 60 * 60 * 1000;
    const leadRequestCount = leadWindowExpired ? 1 : Number(leadRate.request_count || 0) + 1;
    if (!leadWindowExpired && leadRequestCount > 5) return json(request, { error: "Alcanzaste el límite temporal de solicitudes de contacto." }, 429);
    await admin.from("store_bot_rate_limits").upsert({
      store_id: store.id,
      client_hash: leadClientHash,
      request_count: leadRequestCount,
      window_started_at: leadWindowExpired ? new Date().toISOString() : leadRate.window_started_at,
      updated_at: new Date().toISOString(),
    });
    const lead = {
      store_id: store.id,
      session_key: sessionKey,
      visitor_name: visitorName,
      email: email || null,
      phone: phone || null,
      contact_preference: preference,
      question_summary: summary || null,
      consent_at: new Date().toISOString(),
    };
    const { data: savedLead, error } = await admin.from("store_bot_leads").insert(lead).select("id").single();
    if (error) return json(request, { error: error.message }, 500);
    const emailed = await sendLeadEmail(store, lead).catch(() => false);
    return json(request, { ok: true, lead_id: savedLead.id, emailed });
  }
  if (action === "lead" && isMallAssistant) return json(request, { error: "El asistente del mall usa el formulario de reclamos y sugerencias." }, 400);

  const question = String(body?.question || "").trim();
  const conversationHistory = (Array.isArray(body?.conversation_history) ? body.conversation_history : [])
    .filter((message: any) => message?.role === "user" || message?.role === "assistant")
    .slice(-6)
    .map((message: any) => ({
      role: message.role,
      content: String(message?.content || "").trim().slice(0, 400),
    }))
    .filter((message: any) => message.content);
  const maxChars = Number(settings.question_max_chars || 300);
  const maxWords = Number(settings.answer_max_words || 80);
  const maxTurns = Number(settings.max_turns || 4);
  if (!question) return json(request, { error: "Escribe una pregunta." }, 400);
  if (question.length > maxChars) return json(request, { error: `La pregunta puede tener hasta ${maxChars} caracteres.` }, 422);

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown";
  const resourceKey = isMallAssistant ? `mall:${mallId}` : store.id;
  const rateTable = isMallAssistant ? "mall_assistant_rate_limits" : "store_bot_rate_limits";
  const rateColumn = isMallAssistant ? "scope_id" : "store_id";
  const clientHash = await sha256(`${serviceRoleKey.slice(-24)}:${resourceKey}:${forwardedFor}`);
  const { data: rateLimit } = await admin
    .from(rateTable)
    .select("request_count, window_started_at")
    .eq(rateColumn, resourceKey)
    .eq("client_hash", clientHash)
    .maybeSingle();
  const rateWindowExpired = !rateLimit || Date.now() - new Date(rateLimit.window_started_at).getTime() >= 60 * 60 * 1000;
  const requestCount = rateWindowExpired ? 1 : Number(rateLimit.request_count || 0) + 1;
  if (!rateWindowExpired && requestCount > 30) {
    return json(request, { error: "Alcanzaste el límite temporal de consultas para esta tienda. Intenta más tarde." }, 429);
  }
  await admin.from(rateTable).upsert({
    [rateColumn]: resourceKey,
    client_hash: clientHash,
    request_count: requestCount,
    window_started_at: rateWindowExpired ? new Date().toISOString() : rateLimit.window_started_at,
    updated_at: new Date().toISOString(),
  });

  const now = Date.now();
  const sessionTable = isMallAssistant ? "mall_assistant_sessions" : "store_bot_sessions";
  const sessionColumn = isMallAssistant ? "scope_id" : "store_id";
  const { data: existingSession } = await admin
    .from(sessionTable)
    .select("id, turn_count, last_question_at, expires_at")
    .eq(sessionColumn, resourceKey)
    .eq("session_key", sessionKey)
    .maybeSingle();
  let turnCount = existingSession && new Date(existingSession.expires_at).getTime() > now ? Number(existingSession.turn_count || 0) : 0;
  if (turnCount >= maxTurns) {
    return json(request, { answer: settings.handoff_message, source: "handoff", handoff_required: true, turns_remaining: 0 });
  }
  if (existingSession?.last_question_at && now - new Date(existingSession.last_question_at).getTime() < 800) {
    return json(request, { error: "Espera un momento antes de enviar otra pregunta." }, 429);
  }
  turnCount += 1;
  const sessionPayload = {
    [sessionColumn]: resourceKey,
    session_key: sessionKey,
    turn_count: turnCount,
    last_question_at: new Date().toISOString(),
    expires_at: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await admin.from(sessionTable).upsert(sessionPayload, { onConflict: `${sessionColumn},session_key` });

  const productsResult = isMallAssistant
    ? { data: [] as any[] }
    : await admin
      .from("store_products")
      .select("name, price, description")
      .eq("local_code", store.local_code)
      .limit(20);
  const products = productsResult.data || [];
  const enrichedStore = isMallAssistant
    ? { name: "Mall Emprendimientos", category: "Información general" }
    : { ...store, store_brief: settings.store_brief || "" };
  const direct = isMallAssistant
    ? directMallAnswer(question, settings)
    : directAnswer(question, enrichedStore, products, Array.isArray(settings.faq) ? settings.faq : []);
  if (direct) {
    const answer = limitWords(direct.answer, maxWords);
    const usageTable = isMallAssistant ? "mall_assistant_usage" : "store_bot_usage";
    await admin.from(usageTable).insert({ [rateColumn]: resourceKey, session_key: sessionKey, response_source: direct.source });
    return json(request, { answer, source: direct.source, handoff_required: turnCount >= maxTurns, turns_remaining: Math.max(0, maxTurns - turnCount) });
  }

  const questionHash = await sha256(JSON.stringify({ conversationHistory, question: normalize(question) }));
  const cacheTable = isMallAssistant ? "mall_assistant_answer_cache" : "store_bot_answer_cache";
  const { data: cached } = await admin
    .from(cacheTable)
    .select("answer")
    .eq(rateColumn, resourceKey)
    .eq("question_hash", questionHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached?.answer) {
    const usageTable = isMallAssistant ? "mall_assistant_usage" : "store_bot_usage";
    await admin.from(usageTable).insert({ [rateColumn]: resourceKey, session_key: sessionKey, response_source: "cache" });
    return json(request, { answer: limitWords(cached.answer, maxWords), source: "cache", handoff_required: turnCount >= maxTurns, turns_remaining: Math.max(0, maxTurns - turnCount) });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const usageTable = isMallAssistant ? "mall_assistant_usage" : "store_bot_usage";
  if (!openaiKey) {
    const answer = isMallAssistant
      ? "No encontré esa información en la inducción del mall. Puedes dejar un reclamo o sugerencia para que la administración lo revise."
      : "No encontré esa información en el catálogo de la tienda. Puedo ayudarte con productos, precios o datos de contacto; también puedes dejar tus datos para que te responda la persona encargada.";
    await admin.from(usageTable).insert({ [rateColumn]: resourceKey, session_key: sessionKey, response_source: "fallback" });
    return json(request, { answer, source: "fallback", handoff_required: true, turns_remaining: Math.max(0, maxTurns - turnCount) });
  }

  const productContext = (products || []).slice(0, 12).map((product: any) => ({
    name: product.name,
    price: product.price,
    description: String(product.description || "").slice(0, 180),
  }));
  const faqContext = (Array.isArray(settings.faq) ? settings.faq : []).slice(0, 12);
  const briefField = isMallAssistant ? settings.mall_brief : settings.store_brief;
  const briefContext = String(briefField || "").trim().slice(0, 4000);
  const prompt = isMallAssistant
    ? `Entidad: Mall Emprendimientos\nInducción general: ${briefContext || "sin inducción adicional"}\nPreguntas frecuentes: ${JSON.stringify(faqContext)}\nConversación reciente: ${JSON.stringify(conversationHistory)}\nPregunta actual: ${question}`
    : `Local: ${store.name}\nCategoría: ${store.category || "Comercio"}\nContacto: ${store.whatsapp || store.contact_phone || "sin WhatsApp"}; ${store.contact_email || "sin correo"}\nInducción del local: ${briefContext || "sin inducción adicional"}\nProductos: ${JSON.stringify(productContext)}\nFAQ: ${JSON.stringify(faqContext)}\nConversación reciente: ${JSON.stringify(conversationHistory)}\nPregunta actual: ${question}`;
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      store: false,
      max_output_tokens: 180,
      instructions: `${isMallAssistant ? "Eres el asistente de informaciones del Mall Emprendimientos." : "Eres el asistente virtual de una tienda del Mall Emprendimientos."} Responde en español con un estilo cercano, simpático y cordial, usando entusiasmo moderado. La interfaz ya saludó al visitante: no vuelvas a decir hola, bienvenido ni te presentes en cada respuesta. Continúa naturalmente la conversación reciente y evita repetir información ya entregada salvo que sea necesaria. Habla de forma breve y respetuosa, y usa el nombre de la entidad cuando resulte apropiado. No presiones al visitante ni exageres. Usa exclusivamente la información entregada: no inventes productos, precios, descuentos, horarios, políticas ni contactos. Si falta información, dilo con amabilidad y ofrece dejar un reclamo o sugerencia para la administración. Máximo ${maxWords} palabras.`,
      input: prompt,
    }),
  });
  if (!openaiResponse.ok) {
    const detail = await openaiResponse.text();
    console.error("OpenAI response error", openaiResponse.status, detail.slice(0, 500));
    const answer = isMallAssistant
      ? "No pude completar esa respuesta ahora. Puedes dejar un reclamo o sugerencia para que la administración lo revise."
      : "No pude completar esa respuesta ahora. Puedo registrar tus datos para que la persona encargada de la tienda te contacte.";
    await admin.from(usageTable).insert({ [rateColumn]: resourceKey, session_key: sessionKey, response_source: "fallback" });
    return json(request, { answer, source: "fallback", handoff_required: true, turns_remaining: Math.max(0, maxTurns - turnCount) });
  }
  const openaiPayload = await openaiResponse.json();
  const answer = limitWords(extractResponseText(openaiPayload), maxWords) || "No encontré información suficiente. Puedo derivar tu consulta a la persona encargada.";
  await Promise.all([
    admin.from(cacheTable).upsert({ [rateColumn]: resourceKey, question_hash: questionHash, answer, expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString() }),
    admin.from(usageTable).insert({
      [rateColumn]: resourceKey,
      session_key: sessionKey,
      response_source: "openai",
      model: openaiPayload?.model || "gpt-4o-mini",
      input_tokens: Number(openaiPayload?.usage?.input_tokens || 0),
      output_tokens: Number(openaiPayload?.usage?.output_tokens || 0),
    }),
  ]);
  return json(request, { answer, source: "openai", handoff_required: turnCount >= maxTurns, turns_remaining: Math.max(0, maxTurns - turnCount) });
});
