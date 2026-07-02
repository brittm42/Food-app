import { Resend } from "resend";

// weeklynom.com is verified with Resend, so this sends from a real domain
// by default. RESEND_FROM can still override it if needed.
const FROM = process.env.RESEND_FROM ?? "WeeklyNom <invites@weeklynom.com>";

export async function sendInviteEmail(
  toEmail: string,
  householdName: string,
  inviteUrl: string
) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `You've been invited to join ${householdName}`,
    html: `
      <p>You've been invited to join <strong>${householdName}</strong> on WeeklyNom — a shared recipe library, This Week planner, pantry, and shopping list.</p>
      <p><a href="${inviteUrl}">Click here to join</a>.</p>
      <p style="color:#888;font-size:12px;">This link expires in 7 days.</p>
    `,
  });
}
