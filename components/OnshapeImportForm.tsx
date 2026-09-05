"use client";

import { FormEvent, useMemo, useState } from "react";
import { computeTunedPid } from "../lib/tuning";
import {
  DEFAULT_CONTROL_PERIOD_S,
  DEFAULT_EXTERNAL_GEAR_RATIO,
  DEFAULT_FRICTION,
  DEFAULT_MOTOR,
  DEFAULT_MOTORS_PER_SIDE,
  DEFAULT_TRACK_WIDTH_IN,
  DEFAULT_WHEEL_DIAMETER_IN,
  INCH_TO_METER,
  V5_MOTOR_CARTRIDGES,
  type MotorSpec,
} from "../lib/tuning/constants";
import type { DrivetrainConfig, TuningResult } from "../lib/tuning/types";
import { TuningGraph } from "./TuningGraph";

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

interface DriveSetup {
  motor: MotorSpec;
  config: DrivetrainConfig;
}

interface TuningState {
  tuning: TuningResult;
  error: null;
}

interface TuningErrorState {
  tuning: null;
  error: string;
}

type TuningStateResult = TuningState | TuningErrorState | null;

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

function parsePositive(value: string): number | null {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInt(value: string): number | null {
  const parsed = parsePositive(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function buildDriveSetup(
  motorCartridgeId: string,
  wheelDiameterIn: string,
  trackWidthIn: string,
  motorsPerSide: string,
  externalGearRatio: string,
  controlPeriodS: string,
): DriveSetup | null {
  const motor =
    V5_MOTOR_CARTRIDGES.find((c) => c.id === motorCartridgeId) ?? DEFAULT_MOTOR;
  const wheelDiameter = parsePositive(wheelDiameterIn);
  const trackWidth = parsePositive(trackWidthIn);
  const motors = parsePositiveInt(motorsPerSide);
  const gearRatio = parsePositive(externalGearRatio);
  const controlPeriod = parsePositive(controlPeriodS);

  if (wheelDiameter === null || trackWidth === null || motors === null || gearRatio === null || controlPeriod === null) {
    return null;
  }

  return {
    motor,
    config: {
      wheelDiameter: wheelDiameter * INCH_TO_METER,
      trackWidth: trackWidth * INCH_TO_METER,
      motorsPerSide: motors,
      externalGearRatio: gearRatio,
      motorFreeSpeed: motor.freeSpeedRpm * ((2 * Math.PI) / 60),
      motorStallTorque: motor.stallTorqueNm,
      controlPeriod,
      friction: DEFAULT_FRICTION,
    },
  };
}

export function OnshapeImportForm() {
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<MassPropertiesResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const [motorCartridgeId, setMotorCartridgeId] = useState(DEFAULT_MOTOR.id);
  const [wheelDiameterIn, setWheelDiameterIn] = useState(String(DEFAULT_WHEEL_DIAMETER_IN));
  const [trackWidthIn, setTrackWidthIn] = useState(String(DEFAULT_TRACK_WIDTH_IN));
  const [motorsPerSide, setMotorsPerSide] = useState(String(DEFAULT_MOTORS_PER_SIDE));
  const [externalGearRatio, setExternalGearRatio] = useState(String(DEFAULT_EXTERNAL_GEAR_RATIO));
  const [controlPeriodS, setControlPeriodS] = useState(String(DEFAULT_CONTROL_PERIOD_S));

  const driveSetup = useMemo(
    () =>
      buildDriveSetup(
        motorCartridgeId,
        wheelDiameterIn,
        trackWidthIn,
        motorsPerSide,
        externalGearRatio,
        controlPeriodS,
      ),
    [motorCartridgeId, wheelDiameterIn, trackWidthIn, motorsPerSide, externalGearRatio, controlPeriodS],
  );

  const tuning: TuningStateResult = useMemo(() => {
    if (!driveSetup || !result) return null;
    try {
      return { tuning: computeTunedPid({ massKg: result.massKg, izz: result.inertia.izz }, driveSetup.config), error: null };
    } catch (err) {
      return { tuning: null, error: err instanceof Error ? err.message : "PID tuning failed." };
    }
  }, [driveSetup, result]);

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

        <fieldset className="drive-setup">
          <legend>Drive setup</legend>

          <div className="field">
            <label htmlFor="motor-cartridge">Motor cartridge</label>
            <select
              id="motor-cartridge"
              value={motorCartridgeId}
              onChange={(e) => setMotorCartridgeId(e.target.value)}
              disabled={status === "loading"}
            >
              {V5_MOTOR_CARTRIDGES.map((cartridge) => (
                <option key={cartridge.id} value={cartridge.id}>
                  {cartridge.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="wheel-diameter">Wheel diameter</label>
              <input
                id="wheel-diameter"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={wheelDiameterIn}
                onChange={(e) => setWheelDiameterIn(e.target.value)}
                disabled={status === "loading"}
              />
              <span className="field-unit">inches</span>
            </div>

            <div className="field">
              <label htmlFor="track-width">Track width</label>
              <input
                id="track-width"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={trackWidthIn}
                onChange={(e) => setTrackWidthIn(e.target.value)}
                disabled={status === "loading"}
              />
              <span className="field-unit">inches, center-to-center</span>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="motors-per-side">Motors per side</label>
              <input
                id="motors-per-side"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={motorsPerSide}
                onChange={(e) => setMotorsPerSide(e.target.value)}
                disabled={status === "loading"}
              />
              <span className="field-unit">V5 motors driving each side</span>
            </div>

            <div className="field">
              <label htmlFor="gear-ratio">External gear ratio</label>
              <input
                id="gear-ratio"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.01"
                value={externalGearRatio}
                onChange={(e) => setExternalGearRatio(e.target.value)}
                disabled={status === "loading"}
              />
              <span className="field-unit">wheel : motor (e.g. 2 = 2× speed)</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="control-period">Control loop period</label>
            <input
              id="control-period"
              type="number"
              inputMode="decimal"
              min="0.001"
              step="0.001"
              value={controlPeriodS}
              onChange={(e) => setControlPeriodS(e.target.value)}
              disabled={status === "loading"}
            />
            <span className="field-unit">seconds between PID updates (e.g. 0.01)</span>
          </div>
        </fieldset>

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

          <h3 className="subheading">Tuned drive PID</h3>

          {result.massKg <= 0 && (
            <div className="warning" role="note">
              The imported assembly reports no mass, so PID values cannot be tuned. Assign
              materials/density to the parts in CAD and re-import.
            </div>
          )}

          {result.massKg > 0 && !driveSetup && (
            <div className="warning" role="note">
              Enter valid drive setup values (positive wheel diameter, track width, motors per side,
              gear ratio, and control period) to tune the PID.
            </div>
          )}

          {result.massKg > 0 && driveSetup && tuning && tuning.error && (
            <div className="error tuning-error" role="note">
              <p>{tuning.error}</p>
            </div>
          )}

          {result.massKg > 0 && driveSetup && tuning && tuning.tuning && (
            <>
              <div className="metric-grid">
                <div className="metric">
                  <span className="metric-label">kP</span>
                  <span className="metric-value">{formatNumber(tuning.tuning.gains.kP)}</span>
                  <span className="metric-unit">power per meter of error</span>
                </div>
                <div className="metric">
                  <span className="metric-label">kI</span>
                  <span className="metric-value">{formatNumber(tuning.tuning.gains.kI)}</span>
                  <span className="metric-unit">power per meter·s of error</span>
                </div>
                <div className="metric">
                  <span className="metric-label">kD</span>
                  <span className="metric-value">{formatNumber(tuning.tuning.gains.kD)}</span>
                  <span className="metric-unit">power per m/s of error</span>
                </div>
              </div>
              <p className="note tuning-note">
                Tuned against a simulated drivetrain using Ziegler-Nichols (ultimate gain{" "}
                {formatNumber(tuning.tuning.ku)}, ultimate period {formatNumber(tuning.tuning.pu, 3)} s)
                with {driveSetup.motor.label} cartridges, {driveSetup.config.motorsPerSide} per side,
                {driveSetup.config.externalGearRatio}× external ratio, and a{" "}
                {driveSetup.config.controlPeriod} s loop. Commands are normalized power (−1…1); scale
                by 12,000 for motor millivolts. This is a starting point — verify on the real robot
                and tune from there.
              </p>

              <h3 className="subheading">Simulated response</h3>
              <TuningGraph
                robot={{ massKg: result.massKg, izz: result.inertia.izz }}
                config={driveSetup.config}
                gains={tuning.tuning.gains}
                target={1}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}