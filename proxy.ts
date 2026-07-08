import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // /api is excluded entirely, not just marked PUBLIC_PATHS — routing a
    // request through Edge Middleware before it reaches the actual route
    // handler is a real boundary crossing that can corrupt raw request
    // bytes in transit, which broke Alexa's request-signature verification
    // (a per-byte RSA signature check) even though the route handler itself
    // read the body carefully. Neither /api route needs the session check
    // this middleware exists for anyway — both do their own auth.
    "/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|manifest\\.webmanifest$|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
