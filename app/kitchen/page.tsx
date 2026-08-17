import { redirect } from "next/navigation";

// Home Stock moved to "/" (see app/page.tsx) — kept as a redirect so old
// bookmarks/PWA home-screen shortcuts pointing at /kitchen still work.
export default function KitchenRedirectPage() {
  redirect("/");
}
