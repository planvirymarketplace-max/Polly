// Auth screen icons — lucide re-exports plus a custom Apple mark
// (lucide dropped brand icons).
import { ArrowRight, Ghost, Lock, Mail, Phone, ShieldCheck } from "lucide-react";

export { ArrowRight, Ghost, Lock, Mail, Phone, ShieldCheck };

export function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 12.9c0-2.5 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 3 2.3 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3 .7 1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.8-1.1-2.8-4ZM14.4 5.4c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1 0 2.2-.6 2.8-1.4Z"
      />
    </svg>
  );
}
