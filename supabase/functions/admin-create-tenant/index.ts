import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const productionOrigin =
  Deno.env.get("MALL_ALLOWED_ORIGIN") ??
  "https://mall-virtual-one-ten.vercel.app";
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
]);

type TenantAccessPayload = {
  email?: unknown;
  password?: unknown;
  display_name?: unknown;
  application_id?: unknown;
  reset_existing_password?: unknown;
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

function json(request: Request, body: Record<string, unknown>, status = 200) {
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
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
    return json(request, { ok: false, error: "Método no permitido." }, 405);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, { ok: false, error: "Configuración incompleta." }, 500);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(request, { ok: false, error: "Sesión requerida." }, 401);
  }

  const adminClient = createAdminClient();
  const { data: sessionData, error: sessionError } =
    await adminClient.auth.getUser(token);
  const requester = sessionData.user;
  if (sessionError || !requester) {
    return json(request, { ok: false, error: "Sesión inválida o vencida." }, 401);
  }

  const { data: adminMembership, error: adminError } = await adminClient
    .from("admin_members")
    .select("auth_user_id")
    .eq("auth_user_id", requester.id)
    .maybeSingle();
  if (adminError) {
    return json(request, { ok: false, error: "No se pudo validar al administrador." }, 500);
  }
  if (!adminMembership) {
    return json(request, { ok: false, error: "Acceso exclusivo del administrador." }, 403);
  }

  let payload: TenantAccessPayload;
  try {
    payload = await request.json();
  } catch {
    return json(request, { ok: false, error: "Solicitud JSON inválida." }, 400);
  }

  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const displayName = String(payload.display_name ?? "").trim().slice(0, 120) ||
    email.split("@")[0];
  const applicationId = String(payload.application_id ?? "").trim();
  const resetExistingPassword = payload.reset_existing_password === true;

  if (!isValidEmail(email)) {
    return json(request, { ok: false, error: "Correo inválido." }, 400);
  }
  if (password.length < 12 || password.length > 72) {
    return json(request, {
      ok: false,
      error: "La clave temporal debe tener entre 12 y 72 caracteres.",
    }, 400);
  }

  try {
    let authUser = await findAuthUserByEmail(adminClient, email);
    let created = false;

    if (!authUser) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          must_change_password: true,
          provisioned_by: requester.id,
        },
      });
      if (error || !data.user) throw error ?? new Error("No se creó el usuario.");
      authUser = data.user;
      created = true;
    } else if (resetExistingPassword) {
      const { data, error } = await adminClient.auth.admin.updateUserById(
        authUser.id,
        {
          password,
          user_metadata: {
            ...(authUser.user_metadata || {}),
            display_name: displayName,
            must_change_password: true,
            provisioned_by: requester.id,
          },
        },
      );
      if (error || !data.user) throw error ?? new Error("No se actualizó el usuario.");
      authUser = data.user;
    }

    const { data: targetAdmin } = await adminClient
      .from("admin_members")
      .select("auth_user_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    const role = targetAdmin ? "admin" : "tenant";

    const profileResult = await adminClient.from("user_profiles").upsert({
      auth_user_id: authUser.id,
      email,
      display_name: displayName,
      role,
      updated_at: new Date().toISOString(),
    }, { onConflict: "auth_user_id" });
    if (profileResult.error) throw profileResult.error;

    let applicationQuery = adminClient
      .from("tenant_applications")
      .update({ applicant_auth_user_id: authUser.id });
    applicationQuery = applicationId
      ? applicationQuery.eq("id", applicationId)
      : applicationQuery.ilike("email", email);
    const applicationResult = await applicationQuery.select("id");
    if (applicationResult.error) throw applicationResult.error;

    const storesResult = await adminClient
      .from("stores")
      .update({
        owner_id: authUser.id,
        updated_at: new Date().toISOString(),
      })
      .is("owner_id", null)
      .ilike("contact_email", email)
      .select("id, local_code");
    if (storesResult.error) throw storesResult.error;

    return json(request, {
      ok: true,
      created,
      password_reset: !created && resetExistingPassword,
      user_id: authUser.id,
      email,
      role,
      linked_applications: applicationResult.data?.length ?? 0,
      linked_stores: storesResult.data?.length ?? 0,
    });
  } catch (error) {
    console.error("admin-create-tenant failed", error);
    const message = error instanceof Error ? error.message : "Error interno.";
    return json(request, { ok: false, error: message }, 500);
  }
});
