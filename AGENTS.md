<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Standard operating procedures

- **Test every feature live before asking Britt to test it.** Verify against the real running app / real Supabase project, not just `tsc --noEmit`, lint, or `next build` — RLS policy bugs and other runtime-only issues won't show up in type checks or a successful build. Only ask Britt to test once you've confirmed it yourself.
- **For auth-gated verification**, prefer the Gmail-free technique (service-role key + `supabase.auth.admin.generateLink()`, then parse the token and call `supabase.auth.setSession()` client-side) over the real-Gmail-link technique, unless specifically verifying the real email-link path itself. Either way, ask before accessing Britt's real Gmail — don't assume standing permission.
- **Clean up test data** (temp recipes, tags, invites, throwaway auth accounts, toggled checkboxes/state) created during verification once you're done, restoring anything toggled back to its original value.
- **Supabase SQL migrations**: Britt runs `.sql` files herself in the Supabase SQL Editor. When one is ready, just say so and briefly what it does — don't offer a dashboard walkthrough or ask if she wants help running it.
- **Before writing code for a new medium/large feature**, have a dedicated scoping/requirements conversation first (confirm decisions one at a time rather than presenting a pre-decided plan) — this project's established pattern, and it works well. Small, contained changes don't need this.
- **Keep this file current.** When a new standing workflow rule or process preference emerges (whether from direct correction or from a pattern that clearly worked well), add it here rather than only in conversational memory, so it persists for any future session or tool reading this repo.
- **Commit and push without asking.** Britt never wants to run `git commit`/`git push` herself — once changes are ready, stage the relevant files, commit with a clear message, and push to `main` without pausing to confirm first. This is standing authorization for routine commit/push only; still confirm before anything destructive or history-rewriting (force push, `reset --hard`, amending pushed commits, etc.).
