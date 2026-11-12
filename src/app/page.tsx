"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AuthGate } from "@/components/polly/AuthGate";
import { AppLoading, AppShell } from "@/components/polly/AppShell";
import { SponsorView } from "@/components/polly/SponsorView";
import { usePolly } from "@/components/polly/store";
import { PollyLogo } from "@/components/polly/PollyLogo";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

interface SessionDTO {
  member: { id: string; handle: string; displayName: string; tier: string; metro: string | null };
  guest: { id: string; handle: string; displayName: string };
}

function PollyRoot() {
  const { mode } = usePolly();
  const session = useQuery<SessionDTO>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/session");
      if (!res.ok) throw new Error("Session failed");
      return res.json();
    },
  });

  if (session.isLoading) return <AppLoading />;

  if (session.isError || !session.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-primary">
          <PollyLogo size={56} />
        </span>
        <p className="text-sm text-muted-foreground">
          Couldn't reach the flock. The demo database may need re-seeding.
        </p>
        <Button onClick={() => session.refetch()}>Try again</Button>
      </div>
    );
  }

  if (mode === "auth") {
    return <AuthGate member={session.data.member} guest={session.data.guest} />;
  }
  if (mode === "sponsor") {
    return <SponsorView />;
  }
  return <AppShell />;
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <PollyRoot />
    </QueryClientProvider>
  );
}
