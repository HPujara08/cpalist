import { scrapeNextBatch } from "../lib/scrape-runner";

async function main() {
  console.log("[CPAList] Starting batch scrape of 21 firms...");
  const result = await scrapeNextBatch(21);
  console.log(`[CPAList] Batch scrape complete: ${result.firmsProcessed} firms, ${result.jobsNew} new jobs`);
  if (result.errors.length > 0) {
    console.warn(`[CPAList] Errors (${result.errors.length}):`, result.errors.join("; "));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[CPAList] Batch scrape failed:", err);
  process.exit(1);
});
