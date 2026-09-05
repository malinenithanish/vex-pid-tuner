import type { DrivetrainConfig, PidGains, RobotBody } from "./types";

export const GRAVITY = 9.81;

export const ROLLING_DRAG_COEFF = 0.5;

export interface DriveState {
  t: number;
  x: number;
  y: number;
  theta: number;
  v: number;
  omega: number;
  s: number;
}

export function initialDriveState(): DriveState {
  return { t: 0, x: 0, y: 0, theta: 0, v: 0, omega: 0, s: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stepDrivePhysics(
  state: DriveState,
  uLeft: number,
  uRight: number,
  config: DrivetrainConfig,
  robot: RobotBody,
  dt: number,
): DriveState {
  const wheelRadius = config.wheelDiameter / 2;
  const halfTrack = config.trackWidth / 2;
  const sideForceCap = config.friction * robot.massKg * GRAVITY / 2;

  const motorForce = (vSide: number, u: number): number => {
    const motorAngularSpeed = (vSide / wheelRadius) * config.externalGearRatio;
    const speedReference = u >= 0 ? config.motorFreeSpeed : -config.motorFreeSpeed;
    const torque = config.motorStallTorque * (1 - motorAngularSpeed / speedReference) * u;
    const force = (config.motorsPerSide * config.externalGearRatio * torque) / wheelRadius;
    return clamp(force, -sideForceCap, sideForceCap);
  };

  const vLeft = state.v - state.omega * halfTrack;
  const vRight = state.v + state.omega * halfTrack;
  const mass = robot.massKg > 0 ? robot.massKg : 1;
  const iz = robot.izz > 0 ? robot.izz : 1;

  const dragPerSide = (vSide: number): number => (ROLLING_DRAG_COEFF * mass * vSide) / 2;
  const fLeft = motorForce(vLeft, uLeft) - dragPerSide(vLeft);
  const fRight = motorForce(vRight, uRight) - dragPerSide(vRight);

  const vDot = (fLeft + fRight) / mass;
  const omegaDot = ((fRight - fLeft) * halfTrack) / iz;

  const next: DriveState = {
    t: state.t + dt,
    x: state.x + state.v * Math.cos(state.theta) * dt,
    y: state.y + state.v * Math.sin(state.theta) * dt,
    theta: state.theta + state.omega * dt,
    v: state.v + vDot * dt,
    omega: state.omega + omegaDot * dt,
    s: state.s + state.v * dt,
  };
  return next;
}

export interface ControlSample {
  t: number;
  s: number;
  error: number;
  u: number;
  v: number;
  omega: number;
}

export interface SimulationResult {
  samples: ControlSample[];
  final: DriveState;
}

export interface DistanceControlOptions {
  physicsDt?: number;
  horizon?: number;
}

export function simulateDistanceControl(
  targetMeters: number,
  gains: PidGains,
  config: DrivetrainConfig,
  robot: RobotBody,
  options: DistanceControlOptions = {},
): SimulationResult {
  const physicsDt = options.physicsDt ?? config.controlPeriod / 10;
  const horizon = options.horizon ?? 10;
  const stepsPerControl = Math.max(1, Math.round(config.controlPeriod / physicsDt));

  let state = initialDriveState();
  let integral = 0;
  let previousError = 0;
  let hasPrevious = false;
  let heldU = 0;

  const samples: ControlSample[] = [];

  for (let t = 0; t < horizon; t += config.controlPeriod) {
    for (let step = 0; step < stepsPerControl; step++) {
      state = stepDrivePhysics(state, heldU, heldU, config, robot, physicsDt);
    }

    const error = targetMeters - state.s;
    const derivative = hasPrevious ? (error - previousError) / config.controlPeriod : 0;
    const rawU = gains.kP * error + gains.kI * integral + gains.kD * derivative;
    const clampedU = clamp(rawU, -1, 1);

    if (Math.abs(clampedU) < 1) {
      integral += error * config.controlPeriod;
    }

    heldU = clampedU;
    samples.push({ t: t + config.controlPeriod, s: state.s, error, u: heldU, v: state.v, omega: state.omega });
    previousError = error;
    hasPrevious = true;
  }

  return { samples, final: state };
}