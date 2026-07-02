import { Resend } from "resend";

// Sandbox mode (no verified domain yet): Resend's shared "onboarding@
// resend.dev" sender can only deliver to the email address that owns this
// Resend account. Sending to anyone else (e.g. Jason) will fail until a
// domain is verified in the Resend dashboard and RESEND_FROM is updated
// to an address on that domain.
const FROM = process.env.RESEND_FROM ?? "Britt's Food System <onboarding@resend.dev>";

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
      <p>You've been invited to join <strong>${householdName}</strong> on Britt's Food System — a shared recipe library, This Week planner, pantry, and shopping list.</p>
      <p><a href="${inviteUrl}">Click here to join</a>.</p>
      <p style="color:#888;font-size:12px;">This link expires in 7 days.</p>
    `,
  });
}
