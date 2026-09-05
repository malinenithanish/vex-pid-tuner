import { initialDriveState, stepDrivePhysics } from "./drive";
import type { DrivetrainConfig, PidGains, RobotBody } from "./types";

const TARGET = 1;
const RELAY_AMPLITUDES = [0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
const HORIZON = 40;

interface RelayMetrics {
  pu: number;
  amplitude: number;
  ku: number;
}

function runRelayTest(
  config: DrivetrainConfig,
  robot: RobotBody,
  d: number,
  horizon: number,
): { samples: { t: number; error: number; u: number }[] } {
  const physicsDt = config.controlPeriod / 10;
  const stepsPerControl = Math.max(1, Math.round(config.controlPeriod / physicsDt));

  let state = initialDriveState();
  let heldU = d;
  const samples: { t: number; error: number; u: number }[] = [];

  for (let t = 0; t < horizon; t += config.controlPeriod) {
    for (let step = 0; step < stepsPerControl; step++) {
      state = stepDrivePhysics(state, heldU, heldU, config, robot, physicsDt);
    }
    const error = TARGET - state.s;
    heldU = error > 0 ? d : -d;
    samples.push({ t: t + config.controlPeriod, error, u: heldU });
  }

  return { samples };
}

function positiveCrossingTimes(samples: { t: number; error: number }[]): number[] {
  const times: number[] = [];
  let previous = samples[0].error;
  for (let i = 1; i < samples.length; i++) {
    const current = samples[i].error;
    if (previous <= 0 && current > 0) {
      times.push(samples[i].t);
    }
    previous = current;
  }
  return times;
}

function summarizeRelay(
  samples: { t: number; error: number; u: number }[],
  d: number,
): RelayMetrics {
  const n = samples.length;

  const crossings = positiveCrossingTimes(samples);
  if (crossings.length < 3) {
    throw new Error(
      "Relay test did not produce a limit cycle for this drive configuration.",
    );
  }

  const intervals: number[] = [];
  for (let i = 1; i < crossings.length; i++) {
    intervals.push(crossings[i] - crossings[i - 1]);
  }
  const pu = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;

  const lateWindowStart = Math.floor(n * 0.6);
  let amplitude = 0;
  for (let i = lateWindowStart; i < n; i++) {
    const abs = Math.abs(samples[i].error);
    if (abs > amplitude) amplitude = abs;
  }
  if (!(amplitude > 1e-12)) {
    throw new Error("Relay test limit cycle had no measurable amplitude.");
  }

  const ku = (4 * d) / (Math.PI * amplitude);
  return { pu, amplitude, ku };
}

export function findUltimateGain(
  config: DrivetrainConfig,
  robot: RobotBody,
): { ku: number; pu: number } {
  for (const amplitude of RELAY_AMPLITUDES) {
    const { samples } = runRelayTest(config, robot, amplitude, HORIZON);
    try {
      const { ku, pu } = summarizeRelay(samples, amplitude);
      return { ku, pu };
    } catch {
      continue;
    }
  }
  throw new Error("Could not characterize the drive for PID tuning.");
}

export function computeZieglerNicholsPid(ku: number, pu: number): PidGains {
  return {
    kP: 0.6 * ku,
    kI: 1.2 * ku / pu,
    kD: (3 * ku * pu) / 40,
  };
}