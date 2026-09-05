import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildOnshapeAuthHeaders,
  createAuthorizationHeader,
  makeNonce,
  signatureString,
} from "../lib/onshape/auth";
import { OnshapeApiError } from "../lib/onshape/errors";
import { extractMassProperties } from "../lib/onshape/massProperties";
import { parseOnshapeDocumentUrl } from "../lib/onshape/url";

const method = "GET";
const nonce = "0123456789abcdef0123456789";
const date = "Mon, 11 Apr 2016 20:08:56 GMT";
const contentType = "application/json";
const pathname = "/api/v16/assemblies/d/testdocid123/w/wid123/e/eid123/massproperties";
const query = "";
const accessKey = "TESTACCESSKEY123";
const secretKey = "TESTSECRETKEY456";

const GOLDEN_SIGNATURE_STRING =
  "get\n0123456789abcdef0123456789\nmon, 11 apr 2016 20:08:56 gmt\napplication/json\n/api/v16/assemblies/d/testdocid123/w/wid123/e/eid123/massproperties\n\n";

const GOLDEN_AUTHORIZATION =
  "On TESTACCESSKEY123:HmacSHA256:0kPpFIze0kw4P3eAhF0SQLtU7UXbxJIIYWmb5nObcB0=";

test("signatureString builds the documented HMAC base string", () => {
  assert.equal(
    signatureString({ method, nonce, date, contentType, pathname, query }),
    GOLDEN_SIGNATURE_STRING,
  );
});

test("createAuthorizationHeader matches the golden vector", () => {
  assert.equal(
    createAuthorizationHeader({ method, pathname, query, nonce, date, contentType, accessKey, secretKey }),
    GOLDEN_AUTHORIZATION,
  );
});

test("lowercasing applies to the whole base string including the date", () => {
  const signed = signatureString({ method, nonce, date, contentType, pathname, query });
  assert.ok(signed.includes("mon, 11 apr 2016"));
  assert.ok(!signed.includes("Apr"));
});

test("query string is included when present", () => {
  const withQuery = signatureString({
    method: "GET",
    nonce,
    date,
    contentType,
    pathname: "/api/v16/documents/abc123",
    query: "a=1&b=2",
  });
  assert.equal(withQuery, "get\n0123456789abcdef0123456789\nmon, 11 apr 2016 20:08:56 gmt\napplication/json\n/api/v16/documents/abc123\na=1&b=2\n");
});

test("empty query string stays empty (not undefined)", () => {
  const withQuery = signatureString({ method: "GET", nonce, date, contentType, pathname, query: "" });
  assert.ok(withQuery.endsWith("/massproperties\n\n"));
});

test("buildOnshapeAuthHeaders returns Date, On-Nonce, and Authorization", () => {
  const headers = buildOnshapeAuthHeaders({
    method,
    pathname,
    query,
    accessKey,
    secretKey,
    date,
    nonce,
  });
  assert.equal(headers.Date, date);
  assert.equal(headers["On-Nonce"], nonce);
  assert.equal(headers.Authorization, GOLDEN_AUTHORIZATION);
});

test("makeNonce produces >= 16 alphanumeric characters and varies per call", () => {
  const a = makeNonce();
  const b = makeNonce();
  assert.ok(a.length >= 16);
  assert.match(a, /^[a-z0-9]+$/);
  assert.equal(a.length, b.length);
  assert.notEqual(a, b);
});

test("parses a workspace link", () => {
  assert.deepEqual(
    parseOnshapeDocumentUrl("https://cad.onshape.com/documents/abc123/w/def456/e/ghi789"),
    {
      host: "cad.onshape.com",
      documentId: "abc123",
      workspaceType: "w",
      workspaceId: "def456",
      elementId: "ghi789",
    },
  );
});

test("parses a version link", () => {
  const ref = parseOnshapeDocumentUrl("https://cad.onshape.com/documents/abc123/v/def456/e/ghi789");
  assert.equal(ref.workspaceType, "v");
  assert.equal(ref.workspaceId, "def456");
});

test("parses a microversion link", () => {
  const ref = parseOnshapeDocumentUrl("https://cad.onshape.com/documents/abc123/m/def456/e/ghi789");
  assert.equal(ref.workspaceType, "m");
});

test("preserves a custom stack host", () => {
  const ref = parseOnshapeDocumentUrl("https://mycompany.onshape.com/documents/abc123/w/def456/e/ghi789");
  assert.equal(ref.host, "mycompany.onshape.com");
});

test("tolerates trailing slashes and query strings", () => {
  const ref = parseOnshapeDocumentUrl(
    "https://cad.onshape.com/documents/abc123/w/def456/e/ghi789/?configuration=Default%20Config",
  );
  assert.equal(ref.documentId, "abc123");
  assert.equal(ref.elementId, "ghi789");
});

test("rejects non-URL input", () => {
  assert.throws(
    () => parseOnshapeDocumentUrl("abc123"),
    (err: unknown) => err instanceof OnshapeApiError && err.code === "INVALID_URL",
  );
});

test("rejects a URL without document/workspace/element structure", () => {
  assert.throws(
    () => parseOnshapeDocumentUrl("https://example.com/some/other/path"),
    (err: unknown) => err instanceof OnshapeApiError && err.code === "INVALID_URL",
  );
});

test("rejects empty input", () => {
  assert.throws(
    () => parseOnshapeDocumentUrl(""),
    (err: unknown) => err instanceof OnshapeApiError && err.code === "INVALID_URL",
  );
});

test("extracts mass, centroid, and inertia tensor from the Onshape response shape", () => {
  const raw = {
    mass: [9.585992154544929, 9.584199206938452, 9.587785102151415],
    volume: [0.003411385108378978, 0.003410724395374695, 0.0034120458213832646],
    centroid: [0.01, 0.02, 0.03, 0.009, 0.019, 0.029, 0.011, 0.021, 0.031],
    inertia: [
      0.09944605933465941, 0.001, 0.002,
      0.001, 0.09944605954654827, 0.003,
      0.002, 0.003, 0.19238058837442526,
      0.09, 0.0009, 0.0018,
      0.0009, 0.09, 0.0027,
      0.0018, 0.0027, 0.18,
      0.1, 0.0011, 0.0022,
      0.0011, 0.1, 0.0033,
      0.0022, 0.0033, 0.2,
    ],
    hasMass: true,
    massMissingCount: 0,
    principalInertia: [0.09944605933465941, 0.09944605954654827, 0.19238058837442526],
  };

  const result = extractMassProperties(raw);
  assert.equal(result.massKg, 9.585992154544929);
  assert.deepEqual(result.centerOfMass, { x: 0.01, y: 0.02, z: 0.03 });
  assert.deepEqual(result.inertia, {
    ixx: 0.09944605933465941,
    iyy: 0.09944605954654827,
    izz: 0.19238058837442526,
    ixy: 0.001,
    ixz: 0.002,
    iyz: 0.003,
  });
  assert.equal(result.hasMass, true);
  assert.equal(result.massMissingCount, 0);
});

test("handles empty mass properties gracefully", () => {
  const result = extractMassProperties({});
  assert.equal(result.massKg, 0);
  assert.deepEqual(result.centerOfMass, { x: 0, y: 0, z: 0 });
  assert.deepEqual(result.inertia, { ixx: 0, iyy: 0, izz: 0, ixy: 0, ixz: 0, iyz: 0 });
  assert.equal(result.hasMass, false);
});