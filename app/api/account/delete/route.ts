import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Permanently delete the authenticated user's account and associated data.
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: ownedPatterns, error: listError } = await admin
    .from("patterns")
    .select("id")
    .eq("user_id", user.id);
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const ownedIds = (ownedPatterns ?? []).map((p) => p.id as string);

  // Likes the user made, plus likes on patterns they own
  const { error: likesByUserError } = await admin
    .from("pattern_likes")
    .delete()
    .eq("user_id", user.id);
  if (likesByUserError) {
    return NextResponse.json({ error: likesByUserError.message }, { status: 500 });
  }
  if (ownedIds.length > 0) {
    const { error: likesOnOwnedError } = await admin
      .from("pattern_likes")
      .delete()
      .in("pattern_id", ownedIds);
    if (likesOnOwnedError) {
      return NextResponse.json({ error: likesOnOwnedError.message }, { status: 500 });
    }
  }

  const { error: patternsError } = await admin.from("patterns").delete().eq("user_id", user.id);
  if (patternsError) {
    return NextResponse.json({ error: patternsError.message }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("user_id", user.id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
