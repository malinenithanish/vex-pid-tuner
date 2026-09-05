"use client";

import { FormEvent, useState } from "react";

interface InertiaTensor {
  ixx: number;
  iyy: number;
  izz: number;
  ixy: number;
  ixz: number;
  iyz: number;
}

interface MassPropertiesResult {
  massKg: number;
  centerOfMass: { x: number; y: number; z: number };
  inertia: InertiaTensor;
  principalInertia: number[];
  hasMass: boolean;
  massMissingCount: number;
  units: string;
  source: {
    host: string;
    documentId: string;
    workspaceType: string;
    workspaceId: string;
    elementId: string;
  };
}

interface ApiError {
  code: string;
  message: string;
}

const ERROR_TITLES: Record<string, string> = {
  INVALID_REQUEST: "Invalid request",
  MISSING_ACCESS_KEY: "Missing access key",
  MISSING_SECRET_KEY: "Missing secret key",
  MISSING_DOCUMENT_URL: "Missing document URL",
  INVALID_URL: "Invalid document URL",
  INVALID_CREDENTIALS: "Invalid API keys",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Assembly not found",
  RATE_LIMITED: "Rate limited",
  TIMEOUT: "Onshape timed out",
  NETWORK: "Could not reach Onshape",
};

function formatNumber(value: number, digits = 4): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function OnshapeImportForm() {
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<MassPropertiesResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/massproperties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: accessKey.trim(),
          secretKey: secretKey.trim(),
          documentUrl: documentUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data?.error ??
            ({ code: "UNKNOWN", message: "Something went wrong. Try again." } as ApiError),
        );
        setStatus("error");
        return;
      }

      setResult(data as MassPropertiesResult);
      setStatus("success");
    } catch {
      setError({ code: "NETWORK", message: "Could not reach the server. Is the dev server running?" });
      setStatus("error");
    }
  }

  return (
    <div className="app">
      <form className="card form" onSubmit={handleSubmit} aria-busy={status === "loading"}>
        <h2>Import from Onshape</h2>

        <div className="field">
          <label htmlFor="access-key">Onshape Access Key</label>
          <input
            id="access-key"
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
            disabled={status === "loading"}
            placeholder="Paste your Onshape access key"
          />
        </div>

        <div className="field">
          <label htmlFor="secret-key">Onshape Secret Key</label>
          <input
            id="secret-key"
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            required
            disabled={status === "loading"}
            placeholder="Paste your Onshape secret key"
          />
        </div>

        <div className="field">
          <label htmlFor="doc-url">Onshape Document URL</label>
          <input
            id="doc-url"
            type="url"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
            disabled={status === "loading"}
            placeholder="https://cad.onshape.com/documents/{did}/w/{wid}/e/{eid}"
          />
        </div>

        <p className="note">
          Your keys are used only for this one request and are never stored, logged, or written to
          disk. Use a <strong>read-only</strong> scoped API key when using this tool.
        </p>

        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Fetching from Onshape…" : "Import mass properties"}
        </button>
      </form>

      {status === "loading" && (
        <div className="card status" role="status">
          Querying the Onshape API for this assembly&apos;s mass properties. This can take a few
          seconds…
        </div>
      )}

      {status === "error" && error && (
        <div className="card error" role="alert">
          <h3>{ERROR_TITLES[error.code] ?? "Something went wrong"}</h3>
          <p>{error.message}</p>
        </div>
      )}

      {status === "success" && result && (
        <div className="card results">
          <h2>Mass properties</h2>
          <p className="note">
            Values are in {result.units} as returned by the Onshape API — sanity-check them against
            the CAD Mass Properties tool before trusting the tuned PID values.
          </p>

          {result.massMissingCount > 0 && (
            <div className="warning" role="note">
              <strong>{result.massMissingCount} parts</strong> had no material/density assigned and
              were excluded from this calculation. The reported mass may be lower than the real
              robot — assign materials in CAD and re-import for accurate values.
            </div>
          )}

          <div className="metric-grid">
            <div className="metric">
              <span className="metric-label">Mass</span>
              <span className="metric-value">{formatNumber(result.massKg)}</span>
              <span className="metric-unit">kg</span>
            </div>
            <div className="metric">
              <span className="metric-label">Center of mass X</span>
              <span className="metric-value">{formatNumber(result.centerOfMass.x)}</span>
              <span className="metric-unit">m</span>
            </div>
            <div className="metric">
              <span className="metric-label">Center of mass Y</span>
              <span className="metric-value">{formatNumber(result.centerOfMass.y)}</span>
              <span className="metric-unit">m</span>
            </div>
            <div className="metric">
              <span className="metric-label">Center of mass Z</span>
              <span className="metric-value">{formatNumber(result.centerOfMass.z)}</span>
              <span className="metric-unit">m</span>
            </div>
          </div>

          <h3 className="subheading">Inertia tensor</h3>
          <table className="inertia-table">
            <tbody>
              <tr>
                <th>I<sub>xx</sub></th>
                <th>I<sub>yy</sub></th>
                <th>I<sub>zz</sub></th>
                <th>I<sub>xy</sub></th>
                <th>I<sub>xz</sub></th>
                <th>I<sub>yz</sub></th>
              </tr>
              <tr>
                <td>{formatNumber(result.inertia.ixx)}</td>
                <td>{formatNumber(result.inertia.iyy)}</td>
                <td>{formatNumber(result.inertia.izz)}</td>
                <td>{formatNumber(result.inertia.ixy)}</td>
                <td>{formatNumber(result.inertia.ixz)}</td>
                <td>{formatNumber(result.inertia.iyz)}</td>
              </tr>
            </tbody>
          </table>
          <p className="table-caption">
            kg·m². I<sub>zz</sub> governs turning/yaw — the key value for drive PID.
          </p>

          <p className="source">
            {result.source.host} · document {result.source.documentId} · {result.source.workspaceType}{" "}
            {result.source.workspaceId} · element {result.source.elementId}
          </p>
        </div>
      )}
    </div>
  );
}