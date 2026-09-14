import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const productionOrigin =
  Deno.env.get("MALL_ALLOWED_ORIGIN") ??
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

type ResetPasswordPayload = {
  user_id?: unknown;
  email?: unknown;
  password?: unknown;
  must_change_password?: unknown;
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : productionOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUserId(value: unknown) {
  return String(value ?? "").trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createAdminClient>,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find((user) => normalizeEmail(user.email) === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.has(origin)) {
    return json(request, { ok: false, error: "Origen no autorizado." }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { ok: false, error: "Metodo no permitido." }, 405);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, { ok: false, error: "Configuracion incompleta." }, 500);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(request, { ok: false, error: "Sesion requerida." }, 401);
  }

  const adminClient = createAdminClient();
  const { data: sessionData, error: sessionError } = await adminClient.auth
    .getUser(token);
  const requester = sessionData.user;
  if (sessionError || !requester) {
    return json(
      request,
      { ok: false, error: "Sesion invalida o vencida." },
      401,
    );
  }

  const { data: adminMembership, error: adminError } = await adminClient
    .from("admin_members")
    .select("auth_user_id")
    .eq("auth_user_id", requester.id)
    .maybeSingle();
  if (adminError) {
    return json(
      request,
      { ok: false, error: "No se pudo validar al administrador." },
      500,
    );
  }
  if (!adminMembership) {
    return json(
      request,
      { ok: false, error: "Acceso exclusivo del administrador." },
      403,
    );
  }

  let payload: ResetPasswordPayload;
  try {
    payload = await request.json();
  } catch {
    return json(request, { ok: false, error: "Solicitud JSON invalida." }, 400);
  }

  const requestedUserId = normalizeUserId(payload.user_id);
  const requestedEmail = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const mustChangePassword = payload.must_change_password !== false;

  if (!requestedUserId && !requestedEmail) {
    return json(
      request,
      { ok: false, error: "Debes enviar user_id o email." },
      400,
    );
  }
  if (requestedUserId && !isValidUuid(requestedUserId)) {
    return json(request, { ok: false, error: "user_id invalido." }, 400);
  }
  if (requestedEmail && !isValidEmail(requestedEmail)) {
    return json(request, { ok: false, error: "Correo invalido." }, 400);
  }
  if (password.length < 6 || password.length > 72) {
    return json(
      request,
      {
        ok: false,
        error: "La nueva clave debe tener entre 6 y 72 caracteres.",
      },
      400,
    );
  }

  try {
    let targetUser = null;
    if (requestedUserId) {
      const { data, error } = await adminClient.auth.admin.getUserById(
        requestedUserId,
      );
      if (error || !data.user) {
        return json(
          request,
          { ok: false, error: "No encontre el usuario solicitado." },
          404,
        );
      }
      targetUser = data.user;
    } else {
      targetUser = await findAuthUserByEmail(adminClient, requestedEmail);
      if (!targetUser) {
        return json(
          request,
          { ok: false, error: "No encontre un usuario con ese correo." },
          404,
        );
      }
    }

    const { data: updatedData, error: updateError } = await adminClient.auth
      .admin.updateUserById(targetUser.id, {
        password,
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          must_change_password: mustChangePassword,
          password_reset_by_admin: requester.id,
          password_reset_at: new Date().toISOString(),
        },
      });

    if (updateError || !updatedData.user) {
      throw updateError ?? new Error("No se pudo actualizar la clave.");
    }

    return json(request, {
      ok: true,
      user_id: updatedData.user.id,
      email: updatedData.user.email,
      must_change_password: mustChangePassword,
      message: "Clave actualizada correctamente.",
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo actualizar la clave.";
    return json(request, { ok: false, error: message }, 500);
  }
});
