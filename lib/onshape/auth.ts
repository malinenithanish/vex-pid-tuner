import { createHmac, randomBytes } from "node:crypto";

export const ONSHAPE_CONTENT_TYPE = "application/json";

export function makeNonce(length = 40): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

export interface AuthorizationInput {
  method: string;
  pathname: string;
  query: string;
  nonce: string;
  date: string;
  contentType: string;
  accessKey: string;
  secretKey: string;
}

export function signatureString(
  input: Omit<AuthorizationInput, "accessKey" | "secretKey">,
): string {
  const { method, nonce, date, contentType, pathname, query } = input;
  return `${method}\n${nonce}\n${date}\n${contentType}\n${pathname}\n${query}\n`.toLowerCase();
}

export function createAuthorizationHeader(input: AuthorizationInput): string {
  const { accessKey, secretKey } = input;
  const digest = createHmac("sha256", secretKey)
    .update(signatureString(input))
    .digest("base64");
  return `On ${accessKey}:HmacSHA256:${digest}`;
}

export interface OnshapeAuthHeaders {
  Date: string;
  "On-Nonce": string;
  Authorization: string;
}

export interface BuildHeadersInput {
  method: string;
  pathname: string;
  query: string;
  accessKey: string;
  secretKey: string;
  date?: string;
  nonce?: string;
  contentType?: string;
}

export function buildOnshapeAuthHeaders(input: BuildHeadersInput): OnshapeAuthHeaders {
  const { method, pathname, query, accessKey, secretKey } = input;
  const date = input.date ?? new Date().toUTCString();
  const nonce = input.nonce ?? makeNonce();
  const contentType = input.contentType ?? ONSHAPE_CONTENT_TYPE;
  return {
    Date: date,
    "On-Nonce": nonce,
    Authorization: createAuthorizationHeader({
      method,
      pathname,
      query,
      nonce,
      date,
      contentType,
      accessKey,
      secretKey,
    }),
  };
}