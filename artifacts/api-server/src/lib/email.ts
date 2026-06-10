import nodemailer from "nodemailer";
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
  firstSeen: Date | string;
};

export type DigestPayload = {
  date: string;
  newToday: DigestJob[];
  stillOpen: DigestJob[];
  totalActive: number;
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function jobRow(job: DigestJob, isNew: boolean): string {
  const applyCell = job.applyUrl
    ? `<a href="${job.applyUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:5px 14px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.2px;white-space:nowrap;">Apply →</a>`
    : "";
  const newTag = isNew
    ? `<span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;letter-spacing:0.5px;text-transform:uppercase;margin-left:8px;vertical-align:middle;">NEW</span>`
    : "";
  return `
<tr>
  <td style="padding:16px 0;border-bottom:1px solid #f4f4f5;vertical-align:top;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:15px;font-weight:700;color:#18181b;line-height:1.3;">${job.firmName}${newTag}</div>
          <div style="font-size:14px;color:#3f3f46;margin-top:4px;">${job.title}</div>
          <div style="font-size:12px;color:#71717a;margin-top:5px;">
            ${job.location ? `<span>${job.location}</span> · ` : ""}<span>${formatDate(job.firstSeen)}</span>
          </div>
        </td>
        <td style="vertical-align:middle;text-align:right;padding-left:16px;width:90px;">${applyCell}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

function buildHtml(payload: DigestPayload): string {
  const newRows = payload.newToday.map((j) => jobRow(j, true)).join("");
  const openJobs = payload.stillOpen.slice(0, 40);
  const openRows = openJobs.map((j) => jobRow(j, false)).join("");
  const overflow = payload.stillOpen.length > 40 ? payload.stillOpen.length - 40 : 0;
  const total = payload.newToday.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CPAList — Daily Internship Digest</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

<!-- Personal note -->
<tr><td style="padding-bottom:20px;">
  <div style="font-size:14px;color:#52525b;">For my lovely poopy ❤️</div>
</td></tr>

<!-- Header -->
<tr><td style="padding-bottom:32px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <div style="font-size:26px;font-weight:800;color:#18181b;letter-spacing:-0.5px;">CPAList</div>
        <div style="font-size:13px;color:#71717a;margin-top:4px;">Your daily CPA internship digest · ${payload.date}</div>
      </td>
    </tr>
  </table>
  <div style="border-top:2px solid #18181b;margin-top:20px;"></div>
</td></tr>

<!-- Count line -->
<tr><td style="padding-bottom:28px;">
  <div style="font-size:13px;font-weight:700;color:#18181b;letter-spacing:0.5px;text-transform:uppercase;">
    ${total > 0 ? `📬 ${total} new posting${total !== 1 ? "s" : ""} in the last 24 hours` : "📭 No new postings in the last 24 hours"}
  </div>
</td></tr>

<!-- New today -->
<tr><td style="background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:0 20px;">

  ${payload.newToday.length > 0 ? `
  <div style="padding:18px 0 4px;font-size:11px;font-weight:700;color:#71717a;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #f4f4f5;">New in Last 24 Hours</div>
  <table width="100%" cellpadding="0" cellspacing="0">${newRows}</table>
  ` : `
  <div style="text-align:center;padding:36px 24px;">
    <div style="color:#a1a1aa;font-size:14px;">No new internship postings in the last 24 hours. Check back tomorrow.</div>
  </div>
  `}

  ${openRows ? `
  <div style="padding:18px 0 4px;font-size:11px;font-weight:700;color:#71717a;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #f4f4f5;${payload.newToday.length > 0 ? "margin-top:8px;" : ""}">Still Open</div>
  <table width="100%" cellpadding="0" cellspacing="0">${openRows}</table>
  ${overflow > 0 ? `<div style="text-align:center;padding:16px 0;color:#71717a;font-size:12px;">+ ${overflow} more open positions — visit the job board for the full list</div>` : `<div style="height:4px;"></div>`}
  ` : ""}

</td></tr>

<!-- Footer -->
<tr><td style="padding:28px 0 0;text-align:center;">
  <div style="color:#a1a1aa;font-size:11px;line-height:1.6;">
    CPAList · Monitoring 500 top US accounting firms for internship openings<br>
    Sent automatically at midnight EST · Data sourced directly from firm ATS providers
  </div>
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

  const gmailUser = process.env["GMAIL_USER"];
  const gmailPass = process.env["GMAIL_APP_PASSWORD"];
  if (!gmailUser || !gmailPass) {
    return { success: false, error: "GMAIL_USER or GMAIL_APP_PASSWORD is not set" };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    const html = buildHtml(payload);
    const subject = payload.newToday.length > 0
      ? `CPAList: ${payload.newToday.length} new intern posting${payload.newToday.length !== 1 ? "s" : ""} — ${payload.date}`
      : `CPAList: Daily digest — ${payload.date}`;

    await transporter.sendMail({
      from: `CPAList <${gmailUser}>`,
      to: recipients.join(", "),
      subject,
      html,
    });

    logger.info({ recipients, newToday: payload.newToday.length }, "CPAList digest email sent via Gmail");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to send digest email");
    return { success: false, error: message };
  }
}
