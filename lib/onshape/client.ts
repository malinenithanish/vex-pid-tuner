import { ONSHAPE_CONTENT_TYPE, buildOnshapeAuthHeaders } from "./auth";
import { OnshapeApiError } from "./errors";
import type { OnshapeRawMassProperties } from "./massProperties";
import type { OnshapeDocumentRef } from "./url";

export const ONSHAPE_API_VERSION = "16";
export const ONSHAPE_USER_AGENT = "vex-pid-tuner/0.1.0";

export interface OnshapeCredentials {
  accessKey: string;
  secretKey: string;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 5;

function classifyStatus(status: number): { code: string; message: string } {
  switch (status) {
    case 401:
      return {
        code: "INVALID_CREDENTIALS",
        message:
          "Onshape rejected the supplied API keys. Double-check the access key and secret key (the secret is shown only once when the key is created).",
      };
    case 403:
      return {
        code: "FORBIDDEN",
        message:
          "Onshape refused access with those keys. The key may be read-only-scoped for the wrong stack, or the document may not allow access with these credentials.",
      };
    case 404:
      return {
        code: "NOT_FOUND",
        message:
          "Onshape couldn't find that document, workspace, or element. The element may not exist, may not be an assembly, or the document isn't shared with your account.",
      };
    case 422:
    case 400:
      return {
        code: "INVALID_REQUEST",
        message:
          "Onshape rejected the request. The element at that ID may not allow mass property evaluation (an assembly needs parts with assigned materials/density).",
      };
    case 429:
      return {
        code: "RATE_LIMITED",
        message: "Onshape is rate-limiting requests. Wait a moment and try again.",
      };
    default:
      return {
        code: "UNKNOWN",
        message: "Onshape returned an unexpected error (HTTP " + status + ").",
      };
  }
}

async function errorMessageFromResponse(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.message === "string" && body.message.trim().length > 0) {
      return body.message;
    }
  } catch {
    return "";
  }
  return "";
}

function massPropertiesPath(ref: OnshapeDocumentRef): string {
  return `/api/v${ONSHAPE_API_VERSION}/assemblies/d/${ref.documentId}/${ref.workspaceType}/${ref.workspaceId}/e/${ref.elementId}/massproperties`;
}

export async function fetchAssemblyMassProperties(
  ref: OnshapeDocumentRef,
  credentials: OnshapeCredentials,
  options: FetchOptions = {},
): Promise<OnshapeRawMassProperties> {
  const { accessKey, secretKey } = credentials;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let url = `https://${ref.host}${massPropertiesPath(ref)}`;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new OnshapeApiError(500, "UNKNOWN", "Onshape returned an unparseable redirect URL.");
    }

    const pathname = parsedUrl.pathname;
    const query = parsedUrl.search.slice(1);
    const authHeaders = buildOnshapeAuthHeaders({
      method: "GET",
      pathname,
      query,
      accessKey,
      secretKey,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json;charset=UTF-8; qs=0.09",
          "Content-Type": ONSHAPE_CONTENT_TYPE,
          "User-Agent": ONSHAPE_USER_AGENT,
          ...authHeaders,
        },
      });
    } catch (err) {
      const aborted =
        err instanceof DOMException
          ? err.name === "AbortError"
          : err instanceof Error
            ? err.name === "AbortError" || err.message.includes("abort")
            : false;
      if (aborted) {
        throw new OnshapeApiError(
          504,
          "TIMEOUT",
          "Onshape didn't respond within the time limit. Try again.",
        );
      }
      throw new OnshapeApiError(
        502,
        "NETWORK",
        "Could not reach the Onshape API. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new OnshapeApiError(502, "UNKNOWN", "Onshape returned a redirect without a target.");
      }
      url = new URL(location, url).toString();
      continue;
    }

    if (!res.ok) {
      const onshapeMessage = await errorMessageFromResponse(res);
      const { code, message } = classifyStatus(res.status);
      throw new OnshapeApiError(res.status, code, onshapeMessage || message);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new OnshapeApiError(
        502,
        "NOT_JSON",
        "Onshape returned an unexpected, non-JSON response.",
      );
    }

    return body as OnshapeRawMassProperties;
  }

  throw new OnshapeApiError(502, "TOO_MANY_REDIRECTS", "Onshape redirected too many times.");
}