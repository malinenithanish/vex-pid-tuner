import { fetchAssemblyMassProperties } from "../lib/onshape/client";
import { OnshapeApiError } from "../lib/onshape/errors";
import { extractMassProperties } from "../lib/onshape/massProperties";
import { parseOnshapeDocumentUrl } from "../lib/onshape/url";

async function main() {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey = process.env.ONSHAPE_SECRET_KEY;
  const documentUrl = process.env.ONSHAPE_DOC_URL;

  if (!accessKey || !secretKey || !documentUrl) {
    console.log(
      "Set ONSHAPE_ACCESS_KEY, ONSHAPE_SECRET_KEY, and ONSHAPE_DOC_URL to run the live test:",
    );
    console.log("  ONSHAPE_ACCESS_KEY=... ONSHAPE_SECRET_KEY=... ONSHAPE_DOC_URL=... npm run live:onshape");
    process.exit(2);
  }

  try {
    const ref = parseOnshapeDocumentUrl(documentUrl);
    const raw = await fetchAssemblyMassProperties(ref, { accessKey, secretKey });
    const properties = extractMassProperties(raw);
    console.log(JSON.stringify({ document: ref, properties }, null, 2));
  } catch (err) {
    if (err instanceof OnshapeApiError) {
      console.error(`ERROR HTTP ${err.status} [${err.code}]: ${err.message}`);
      process.exit(1);
    }
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

main();