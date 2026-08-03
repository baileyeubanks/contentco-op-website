import fs from "node:fs/promises";
import path from "node:path";
import { buildSystemMapSnapshot, renderSystemMapHtml } from "../lib/system-map";

const OUTPUT_PATH = "/Users/baileyeubanks/Desktop/Projects/BLAZE_SYSTEM_STATE.html";

async function main() {
  const snapshot = await buildSystemMapSnapshot({
    host: "admin.contentco-op.com",
    brandHint: "cc",
  });
  const html = renderSystemMapHtml(snapshot);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, html, "utf8");

  process.stdout.write(
    `Wrote ${OUTPUT_PATH}\n` +
      `Generated: ${snapshot.meta.generatedAt}\n` +
      `Overall: ${snapshot.meta.overallStatus}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
