import { OnshapeApiError } from "./errors";

export type WorkspaceType = "w" | "v" | "m";

export interface OnshapeDocumentRef {
  host: string;
  documentId: string;
  workspaceType: WorkspaceType;
  workspaceId: string;
  elementId: string;
}

const DOCUMENT_PATH_PATTERN = /^\/documents\/([^/]+)\/([wvm])\/([^/]+)\/e\/([^/]+)(?:\/|$)/;

export function parseOnshapeDocumentUrl(rawUrl: string): OnshapeDocumentRef {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new OnshapeApiError(
      400,
      "INVALID_URL",
      "An Onshape document URL is required.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new OnshapeApiError(
      400,
      "INVALID_URL",
      "That doesn't look like a valid URL. Paste the full Onshape link from your browser's address bar.",
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new OnshapeApiError(
      400,
      "INVALID_URL",
      "The Onshape document URL must start with http:// or https://.",
    );
  }

  const match = parsed.pathname.match(DOCUMENT_PATH_PATTERN);
  if (!match) {
    throw new OnshapeApiError(
      400,
      "INVALID_URL",
      "Couldn't find document, workspace, and element IDs in that URL. Expected a link like https://cad.onshape.com/documents/{did}/w/{wid}/e/{eid}",
    );
  }

  return {
    host: parsed.host,
    documentId: match[1],
    workspaceType: match[2] as WorkspaceType,
    workspaceId: match[3],
    elementId: match[4],
  };
}