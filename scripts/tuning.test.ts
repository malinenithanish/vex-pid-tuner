import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DEFAULT_CONTROL_PERIOD_S,
  DEFAULT_EXTERNAL_GEAR_RATIO,
  DEFAULT_FRICTION,
  DEFAULT_MOTORS_PER_SIDE,
  DEFAULT_MOTOR,
  DEFAULT_TRACK_WIDTH_IN,
  DEFAULT_WHEEL_DIAMETER_IN,
  INCH_TO_METER,
} from "../lib/tuning/constants";
import { initialDriveState, simulateDistanceControl, stepDrivePhysics } from "../lib/tuning/drive";
import { computeTunedPid } from "../lib/tuning";
import type { DrivetrainConfig, RobotBody } from "../lib/tuning/types";

const ROBOT: RobotBody = {
  massKg: 4.272382233670655,
  izz: 0.11505792183514922,
};

function defaultConfig(): DrivetrainConfig {
  return {
    wheelDiameter: DEFAULT_WHEEL_DIAMETER_IN * INCH_TO_METER,
    trackWidth: DEFAULT_TRACK_WIDTH_IN * INCH_TO_METER,
    motorsPerSide: DEFAULT_MOTORS_PER_SIDE,
    externalGearRatio: DEFAULT_EXTERNAL_GEAR_RATIO,
    motorFreeSpeed: DEFAULT_MOTOR.freeSpeedRpm * ((2 * Math.PI) / 60),
    motorStallTorque: DEFAULT_MOTOR.stallTorqueNm,
    controlPeriod: DEFAULT_CONTROL_PERIOD_S,
    friction: DEFAULT_FRICTION,
  };
}

test("full power drives the robot straight forward in +x", () => {
  const config = defaultConfig();
  let state = initialDriveState();
  const dt = config.controlPeriod / 10;
  for (let i = 0; i < Math.round(1 / dt); i++) {
    state = stepDrivePhysics(state, 1, 1, config, ROBOT, dt);
  }

  const expectedMaxSpeed = config.motorFreeSpeed * config.externalGearRatio * (config.wheelDiameter / 2);
  assert.ok(state.s > 0.5, `traveled ${state.s} m in 1s`);
  assert.ok(state.s < 1.5, `no runaway speed, traveled ${state.s}`);
  assert.ok(state.v > expectedMaxSpeed * 0.85, `approaching free speed, got ${state.v}`);
  assert.ok(state.v <= expectedMaxSpeed * 1.05, `not above free speed, got ${state.v}`);
  assert.ok(Math.abs(state.theta) < 0.01, `no unintended rotation, theta=${state.theta}`);
});

test("opposite commands rotate the robot in place", () => {
  const config = defaultConfig();
  let state = initialDriveState();
  const dt = config.controlPeriod / 10;
  for (let i = 0; i < Math.round(1 / dt); i++) {
    state = stepDrivePhysics(state, -1, 1, config, ROBOT, dt);
  }

  assert.ok(Math.abs(state.theta) > 1, `robot should have rotated, theta=${state.theta}`);
  assert.ok(Math.abs(state.omega) > 1, `robot should be spinning, omega=${state.omega}`);
  assert.ok(Math.abs(state.v) < 0.1, `no net translation for symmetric spin, v=${state.v}`);
  assert.ok(Math.abs(state.x) < 0.05, `center of rotation near origin, x=${state.x}`);
});

test("Ziegler-Nichols produces sane ultimate gain and period for the robot", () => {
  const tuning = computeTunedPid(ROBOT, defaultConfig());
  assert.ok(tuning.ku > 0 && tuning.ku < 1e6, `ku=${tuning.ku}`);
  assert.ok(tuning.pu > 0.02 && tuning.pu < 5, `pu=${tuning.pu} s`);
  assert.ok(tuning.gains.kP > 0, `kP=${tuning.gains.kP}`);
  assert.ok(tuning.gains.kI > 0, `kI=${tuning.gains.kI}`);
  assert.ok(tuning.gains.kD > 0, `kD=${tuning.gains.kD}`);
});

test("closed loop with computed PID settles on the target", () => {
  const { gains } = computeTunedPid(ROBOT, defaultConfig());
  const result = simulateDistanceControl(1, gains, defaultConfig(), ROBOT, { horizon: 25 });
  const last = result.samples[result.samples.length - 1];
  assert.ok(Math.abs(last.error) < 0.02, `final error=${last.error} m`);
  assert.ok(Math.abs(last.u) <= 1 + 1e-9, `command bounded, u=${last.u}`);
  assert.ok(result.samples.every((s) => Math.abs(s.u) <= 1 + 1e-9), "command never exceeds saturation");
  assert.ok(Math.abs(result.final.s - 1) < 0.02, `final distance=${result.final.s}`);
});

test("aggregate parameters affect the tuned values", () => {
  const standard = computeTunedPid(ROBOT, defaultConfig());

  const heavier: DrivetrainConfig = {
    ...defaultConfig(),
    motorsPerSide: 1,
  };
  const lessPower = computeTunedPid(ROBOT, heavier);

  assert.notEqual(standard.gains.kP, lessPower.gains.kP);
  assert.notEqual(standard.gains.kI, lessPower.gains.kI);
});

test("tuning matches robot base unit differences (mass matters)", () => {
  const light: RobotBody = { massKg: 1, izz: 0.05 };
  const heavy: RobotBody = { massKg: 20, izz: 0.5 };
  const lightTuning = computeTunedPid(light, defaultConfig());
  const heavyTuning = computeTunedPid(heavy, defaultConfig());
  assert.notEqual(lightTuning.gains.kP, heavyTuning.gains.kP);
  assert.notEqual(lightTuning.gains.kD, heavyTuning.gains.kD);
});

test("tuning is deterministic", () => {
  const a = computeTunedPid(ROBOT, defaultConfig());
  const b = computeTunedPid(ROBOT, defaultConfig());
  assert.deepEqual(a, b);
});

test("rejects zero mass", () => {
  assert.throws(() => computeTunedPid({ massKg: 0, izz: 0.1 }, defaultConfig()));
});

test("rejects zero inertia", () => {
  assert.throws(() => computeTunedPid({ massKg: 4, izz: 0 }, defaultConfig()));
});