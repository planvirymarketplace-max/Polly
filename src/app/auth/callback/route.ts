import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// PKCE / OAuth + magic-link callback: exchange the `code` for a session
// (setting the Supabase Auth cookies) and send the user back to the app.
// Any failure redirects home with ?auth=error — the AuthGate surfaces it.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !url || !key) {
    return NextResponse.redirect(new URL("/?auth=error", req.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/?auth=error", req.url));
  }
  return NextResponse.redirect(new URL("/", req.url));
}
