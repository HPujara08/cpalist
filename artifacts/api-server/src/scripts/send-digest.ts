import { sendDigestFromDb } from "../lib/daily-job";

async function main() {
  console.log("[CPAList] Sending daily digest email...");
  const result = await sendDigestFromDb();
  if (result.emailSent) {
    console.log("[CPAList] Digest email sent successfully.");
  } else {
    console.error("[CPAList] Digest email failed:", result.emailError);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[CPAList] Send digest failed:", err);
  process.exit(1);
});
