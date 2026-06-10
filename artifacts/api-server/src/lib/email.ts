import { Resend } from "resend";
import { logger } from "./logger";

export function getRecipients(): string[] {
  const raw = process.env["RECIPIENT_EMAILS"] ?? "";
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

export type DigestJob = {
  firmName: string;
  title: string;
  location: string | null;
  applyUrl: string | null;
  term: string | null;
};

export type DigestPayload = {
  date: string;
  newToday: DigestJob[];
  stillOpen: DigestJob[];
  totalActive: number;
};

function termBadge(term: string | null): string {
  if (!term) return "";
  const colors: Record<string, string> = {
    summer: "#f59e0b",
    winter: "#3b82f6",
    fall: "#ef4444",
    spring: "#22c55e",
  };
  const color = colors[term] ?? "#6b7280";
  return `<span style="background:${color};color:#fff;font-size:11px;padding:2px 8px;border-radius:12px;margin-left:8px;text-transform:uppercase;font-weight:600;">${term}</span>`;
}

function jobRow(job: DigestJob): string {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <div style="font-weight:600;color:#111827;">${job.firmName}${termBadge(job.term)}</div>
        <div style="color:#374151;margin-top:3px;">${job.title}</div>
        ${job.location ? `<div style="color:#9ca3af;font-size:13px;margin-top:3px;">📍 ${job.location}</div>` : ""}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:top;white-space:nowrap;width:100px;">
        ${job.applyUrl ? `<a href="${job.applyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Apply →</a>` : ""}
      </td>
    </tr>`;
}

function buildHtml(payload: DigestPayload): string {
  const newRows = payload.newToday.map(jobRow).join("");
  const openJobs = payload.stillOpen.slice(0, 50);
  const openRows = openJobs.map(jobRow).join("");
  const overflow = payload.stillOpen.length > 50 ? payload.stillOpen.length - 50 : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CPA Intern Radar — Daily Digest</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Header -->
<tr><td style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:28px 32px;">
  <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">📊 CPA Intern Radar</div>
  <div style="color:#93c5fd;font-size:14px;margin-top:6px;">Daily Internship Digest · ${payload.date}</div>
</td></tr>

<!-- Stats bar -->
<tr><td style="background:#1d4ed8;padding:18px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="text-align:center;">
      <div style="font-size:30px;font-weight:700;color:#fff;">${payload.newToday.length}</div>
      <div style="font-size:11px;color:#bfdbfe;margin-top:3px;letter-spacing:0.5px;">NEW TODAY</div>
    </td>
    <td style="color:#4f83cc;text-align:center;font-size:28px;font-weight:300;">|</td>
    <td style="text-align:center;">
      <div style="font-size:30px;font-weight:700;color:#fff;">${payload.totalActive}</div>
      <div style="font-size:11px;color:#bfdbfe;margin-top:3px;letter-spacing:0.5px;">TOTAL ACTIVE</div>
    </td>
    <td style="color:#4f83cc;text-align:center;font-size:28px;font-weight:300;">|</td>
    <td style="text-align:center;">
      <div style="font-size:30px;font-weight:700;color:#fff;">${payload.stillOpen.length}</div>
      <div style="font-size:11px;color:#bfdbfe;margin-top:3px;letter-spacing:0.5px;">STILL OPEN</div>
    </td>
  </tr></table>
</td></tr>

<!-- Body -->
<tr><td style="background:#fff;padding:28px 32px;border-radius:0 0 12px 12px;">

  ${payload.newToday.length > 0 ? `
  <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">🆕 New Today</div>
  <div style="color:#6b7280;font-size:14px;margin-bottom:16px;">${payload.newToday.length} new posting${payload.newToday.length !== 1 ? "s" : ""} since yesterday</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">${newRows}</table>
  ` : `
  <div style="text-align:center;padding:24px;background:#f3f4f6;border-radius:8px;margin-bottom:28px;">
    <div style="font-size:32px;margin-bottom:8px;">📭</div>
    <div style="color:#6b7280;font-weight:500;">No new postings today — check back tomorrow!</div>
  </div>
  `}

  ${openRows ? `
  <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">📋 Still Open</div>
  <div style="color:#6b7280;font-size:14px;margin-bottom:16px;">Active positions from previous scans${overflow > 0 ? ` · showing 50 of ${payload.stillOpen.length}` : ""}</div>
  <table width="100%" cellpadding="0" cellspacing="0">${openRows}</table>
  ${overflow > 0 ? `<div style="text-align:center;margin-top:16px;color:#6b7280;font-size:13px;">+ ${overflow} more active positions</div>` : ""}
  ` : ""}

</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 0;text-align:center;">
  <div style="color:#9ca3af;font-size:12px;">CPA Intern Radar · Automated daily digest</div>
  <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Monitoring 500 top US accounting firms for internship openings</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendDailyDigest(payload: DigestPayload): Promise<{ success: boolean; error?: string }> {
  const recipients = getRecipients();
  if (recipients.length === 0) {
    return { success: false, error: "RECIPIENT_EMAILS is not configured" };
  }

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not set" };
  }

  const fromEmail = process.env["RESEND_FROM_EMAIL"] ?? "onboarding@resend.dev";

  try {
    const client = new Resend(apiKey);
    const html = buildHtml(payload);
    const subject = payload.newToday.length > 0
      ? `📊 ${payload.newToday.length} new intern posting${payload.newToday.length !== 1 ? "s" : ""} today · CPA Intern Radar`
      : `📊 Daily Digest (no new postings) · CPA Intern Radar`;

    const { error } = await client.emails.send({
      from: `CPA Intern Radar <${fromEmail}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      logger.error({ error }, "Resend API returned error");
      return { success: false, error: (error as { message?: string }).message ?? "Unknown Resend error" };
    }

    logger.info({ recipients, newToday: payload.newToday.length }, "Daily digest email sent");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to send digest email");
    return { success: false, error: message };
  }
}
