import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function AuthBar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) return null;

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-1.5 bg-surface-warm border-b border-border text-[11px] text-ink-light">
      <Link href="/profile" className="truncate hover:underline">
        {data.user.email}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="font-mono uppercase tracking-wide text-teal hover:underline cursor-pointer flex-shrink-0"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
