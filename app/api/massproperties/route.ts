import { NextRequest, NextResponse } from "next/server";

import { fetchAssemblyMassProperties } from "@/lib/onshape/client";
import { OnshapeApiError } from "@/lib/onshape/errors";
import { extractMassProperties } from "@/lib/onshape/massProperties";
import { parseOnshapeDocumentUrl } from "@/lib/onshape/url";
import type { OnshapeDocumentRef } from "@/lib/onshape/url";

export const runtime = "nodejs";

interface RequestBody {
  accessKey?: string;
  secretKey?: string;
  documentUrl?: string;
}

function requireString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  return value.trim();
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    const parsed: unknown = await request.json();
    body = (parsed ?? {}) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const accessKey = requireString(body.accessKey);
  if (!accessKey) {
    return NextResponse.json(
      { error: { code: "MISSING_ACCESS_KEY", message: "Onshape access key is required." } },
      { status: 400 },
    );
  }

  const secretKey = requireString(body.secretKey);
  if (!secretKey) {
    return NextResponse.json(
      { error: { code: "MISSING_SECRET_KEY", message: "Onshape secret key is required." } },
      { status: 400 },
    );
  }

  const documentUrl = requireString(body.documentUrl);
  if (!documentUrl) {
    return NextResponse.json(
      { error: { code: "MISSING_DOCUMENT_URL", message: "Onshape document URL is required." } },
      { status: 400 },
    );
  }

  let ref: OnshapeDocumentRef;
  try {
    ref = parseOnshapeDocumentUrl(documentUrl);
  } catch (err) {
    if (err instanceof OnshapeApiError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    throw err;
  }

  try {
    const raw = await fetchAssemblyMassProperties(ref, { accessKey, secretKey });
    const properties = extractMassProperties(raw);

    return NextResponse.json({
      massKg: properties.massKg,
      centerOfMass: properties.centerOfMass,
      inertia: properties.inertia,
      principalInertia: properties.principalInertia,
      hasMass: properties.hasMass,
      massMissingCount: properties.massMissingCount,
      units: properties.units,
      source: {
        host: ref.host,
        documentId: ref.documentId,
        workspaceType: ref.workspaceType,
        workspaceId: ref.workspaceId,
        elementId: ref.elementId,
      },
    });
  } catch (err) {
    if (err instanceof OnshapeApiError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("Unexpected error fetching Onshape mass properties:", err);
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "An unexpected error occurred while contacting Onshape." } },
      { status: 500 },
    );
  }
}