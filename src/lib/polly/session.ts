// Demo session resolution.
// Production: Supabase auth (SSO + OTP + magic link) resolves the JWT;
// this demo resolves the acting user from the `uid` query param so
// guest mode and the member account can coexist.

import { db } from "@/lib/db";

export async function resolveUser(uid: string | null) {
  if (uid) {
    const u = await db.user.findUnique({ where: { id: uid }, include: { interests: { include: { topic: true } } } });
    if (u) return u;
  }
  return db.user.findUnique({
    where: { handle: "maya" },
    include: { interests: { include: { topic: true } } },
  });
}

export async function resolveGuest() {
  return db.user.findUnique({
    where: { handle: "guest_demo" },
    include: { interests: { include: { topic: true } } },
  });
}

export function topicDTO(t: { slug: string; label: string; emoji: string | null } | null) {
  return t ? { slug: t.slug, label: t.label, emoji: t.emoji } : null;
}
