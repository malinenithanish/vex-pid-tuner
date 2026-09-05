import { findUltimateGain, computeZieglerNicholsPid } from "./zieglerNichols";
import type { DrivetrainConfig, RobotBody, TuningResult } from "./types";

export function computeTunedPid(robot: RobotBody, config: DrivetrainConfig): TuningResult {
  if (!(robot.massKg > 0)) {
    throw new Error("Robot mass must be greater than zero to tune PID.");
  }
  if (!(robot.izz > 0)) {
    throw new Error("Robot yaw inertia (Izz) must be greater than zero to tune PID.");
  }
  if (!(config.wheelDiameter > 0) || !(config.trackWidth > 0)) {
    throw new Error("Wheel diameter and track width must be greater than zero.");
  }
  if (!(config.motorStallTorque > 0) || !(config.motorFreeSpeed > 0)) {
    throw new Error("Motor specs must be positive values.");
  }
  if (!(config.externalGearRatio > 0) || !(config.motorsPerSide > 0)) {
    throw new Error("Motors per side and external gear ratio must be positive.");
  }
  if (!(config.controlPeriod > 0)) {
    throw new Error("Control loop period must be positive.");
  }

  const { ku, pu } = findUltimateGain(config, robot);
  const gains = computeZieglerNicholsPid(ku, pu);
  return { gains, ku, pu };
}