export interface RobotBody {
  massKg: number;
  izz: number;
}

export interface DrivetrainConfig {
  wheelDiameter: number;
  trackWidth: number;
  motorsPerSide: number;
  externalGearRatio: number;
  motorFreeSpeed: number;
  motorStallTorque: number;
  controlPeriod: number;
  friction: number;
}

export interface PidGains {
  kP: number;
  kI: number;
  kD: number;
}

export interface TuningResult {
  gains: PidGains;
  ku: number;
  pu: number;
}