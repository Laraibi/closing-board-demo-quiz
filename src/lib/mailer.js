import { settings } from "../models/index.js";

// Gabarits d'e-mails configurables : {{name}} et {{score}} sont remplacés.
export const templates = {
  attemptScored: { subject: "Votre tentative est notée", body: "Bonjour {{name}}, votre score est de {{score}} %." },
  feedbackPosted: { subject: "Nouveau feedback", body: "Bonjour {{name}}, votre formateur a laissé un feedback." }
};

export const outbox = [];

export function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(data[key] ?? ""));
}

/** Sans SMTP configuré, le message est gardé dans l'outbox (journal) : jamais d'erreur bloquante. */
export async function sendMail({ to, template, data }) {
  const current = await settings();
  if (!current.emailsEnabled) return { sent: false, reason: "disabled" };
  const chosen = templates[template];
  if (!chosen) return { sent: false, reason: "unknown-template" };
  outbox.push({ to, subject: render(chosen.subject, data), body: render(chosen.body, data), at: new Date().toISOString() });
  return { sent: true };
}
