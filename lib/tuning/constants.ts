export interface MotorSpec {
  id: string;
  label: string;
  freeSpeedRpm: number;
  stallTorqueNm: number;
}

export const V5_MOTOR_CARTRIDGES: MotorSpec[] = [
  {
    id: "red-100",
    label: "Red 100 RPM (high torque)",
    freeSpeedRpm: 100,
    stallTorqueNm: 2.1,
  },
  {
    id: "green-200",
    label: "Green 200 RPM (standard drive)",
    freeSpeedRpm: 200,
    stallTorqueNm: 1.05,
  },
  {
    id: "blue-600",
    label: "Blue 600 RPM (high speed)",
    freeSpeedRpm: 600,
    stallTorqueNm: 0.35,
  },
];

export const DEFAULT_MOTOR: MotorSpec = V5_MOTOR_CARTRIDGES[1];

export const DEFAULT_WHEEL_DIAMETER_IN = 4;
export const DEFAULT_TRACK_WIDTH_IN = 12;
export const DEFAULT_MOTORS_PER_SIDE = 2;
export const DEFAULT_EXTERNAL_GEAR_RATIO = 1;
export const DEFAULT_CONTROL_PERIOD_S = 0.01;
export const DEFAULT_FRICTION = 1;
export const INCH_TO_METER = 0.0254;