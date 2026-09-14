import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "supervisor" | "user";

function isAllowedRecoveryRedirect(redirectTo: string, requestOrigin: string | null) {
  let parsed: URL;
  try {
    parsed = new URL(redirectTo);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (parsed.pathname !== "/redefinir-senha") return false;
  if (requestOrigin) {
    try {
      if (new URL(requestOrigin).origin === parsed.origin) return true;
    } catch {
      /* ignore invalid origin header */
    }
  }
  return /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname) ||
    parsed.hostname.endsWith(".vercel.app") ||
    parsed.hostname.endsWith("yolopops.com.br");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) {
    return json({ error: "Servidor sem credenciais." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado." }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401);

  const { data: caller } = await admin
    .from("profiles")
    .select("id, role, active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!caller?.active || caller.role !== "admin") {
    return json({ error: "Apenas administradores gerenciam usuários." }, 403);
  }

  const payload = await req.json().catch(() => ({}));
  const action = payload.action as string;

  try {
    if (action === "list") {
      const [{ data: profiles, error: profileError }, { data: authData, error: authError }] =
        await Promise.all([
          admin.from("profiles").select("*").order("created_at"),
          admin.auth.admin.listUsers({ perPage: 200 }),
        ]);
      if (profileError) throw profileError;
      if (authError) throw authError;
      const byId = new Map((authData?.users || []).map((u) => [u.id, u]));
      return json({
        users: (profiles || []).map((p) => {
          const authUser = byId.get(p.id);
          return {
            ...p,
            email: p.email || authUser?.email || "",
            last_sign_in_at: authUser?.last_sign_in_at || null,
            email_confirmed_at: authUser?.email_confirmed_at || null,
            banned: Boolean(authUser?.banned_until),
          };
        }),
      });
    }

    if (action === "create") {
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      const fullName = String(payload.full_name || "").trim();
      const role = payload.role as Role;
      if (!fullName) {
        return json({ error: "Informe o nome do usuário." }, 400);
      }
      if (!email || !password || password.length < 8) {
        return json({ error: "E-mail e senha (mín. 8 caracteres) são obrigatórios." }, 400);
      }
      if (!["admin", "supervisor", "user"].includes(role)) {
        return json({ error: "Papel inválido." }, 400);
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) throw error || new Error("Falha ao criar usuário.");
      await admin.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName || email.split("@")[0],
        email,
        role,
        active: true,
        updated_at: new Date().toISOString(),
      });
      return json({ ok: true, id: data.user.id });
    }

    if (action === "update") {
      const id = String(payload.id || "");
      if (!id) return json({ error: "Usuário inválido." }, 400);
      if (id === userData.user.id && payload.active === false) {
        return json({ error: "Você não pode desativar a própria conta." }, 400);
      }

      const { data: target } = await admin
        .from("profiles")
        .select("role, active")
        .eq("id", id)
        .maybeSingle();
      const nextRole = ["admin", "supervisor", "user"].includes(payload.role)
        ? payload.role
        : target?.role;
      const nextActive = typeof payload.active === "boolean" ? payload.active : target?.active;
      if (target?.role === "admin" && target.active && (nextRole !== "admin" || nextActive === false)) {
        const { count } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("active", true)
          .neq("id", id);
        if ((count || 0) < 1) {
          return json({ error: "Mantenha pelo menos um administrador ativo." }, 400);
        }
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof payload.full_name === "string") patch.full_name = payload.full_name.trim();
      if (["admin", "supervisor", "user"].includes(payload.role)) patch.role = payload.role;
      if (typeof payload.active === "boolean") patch.active = payload.active;

      if (typeof payload.email === "string") {
        const email = payload.email.trim().toLowerCase();
        if (!email) return json({ error: "E-mail inválido." }, 400);
        const { error: emailError } = await admin.auth.admin.updateUserById(id, {
          email,
          email_confirm: true,
        });
        if (emailError) throw emailError;
        patch.email = email;
      }

      const { error } = await admin.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      if (typeof payload.active === "boolean") {
        await admin.auth.admin.updateUserById(id, {
          ban_duration: payload.active ? "none" : "876000h",
        });
      }
      if (typeof payload.full_name === "string") {
        await admin.auth.admin.updateUserById(id, {
          user_metadata: { full_name: payload.full_name.trim() },
        });
      }
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const id = String(payload.id || "");
      if (!id) return json({ error: "Usuário inválido." }, 400);

      const redirectTo = String(payload.redirectTo || "").trim();
      if (!isAllowedRecoveryRedirect(redirectTo, req.headers.get("origin"))) {
        return json({ error: "URL de retorno inválida." }, 400);
      }

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("email, active")
        .eq("id", id)
        .maybeSingle();
      if (targetError) throw targetError;
      const email = String(target?.email || "").trim().toLowerCase();
      if (!email) return json({ error: "Este usuário não tem e-mail." }, 400);
      if (target?.active === false) {
        return json({ error: "Ative a conta antes de enviar o link de senha." }, 400);
      }

      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      return json({ ok: true, email });
    }

    if (action === "delete") {
      const id = String(payload.id || "");
      if (!id) return json({ error: "Usuário inválido." }, 400);
      if (id === userData.user.id) return json({ error: "Você não pode excluir a própria conta." }, 400);
      const { data: target } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
      if (target?.role === "admin") {
        const { count } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("active", true)
          .neq("id", id);
        if ((count || 0) < 1) {
          return json({ error: "Mantenha pelo menos um administrador." }, 400);
        }
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json({ error: message }, 400);
  }
});
