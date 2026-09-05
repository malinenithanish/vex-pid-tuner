export interface OnshapeRawMassProperties {
  mass?: number[];
  volume?: number[];
  centroid?: number[];
  inertia?: number[];
  hasMass?: boolean;
  massMissingCount?: number;
  periphery?: number[];
  principalAxes?: Array<{ x: number; y: number; z: number }>;
  principalInertia?: number[];
}

export interface InertiaTensor {
  ixx: number;
  iyy: number;
  izz: number;
  ixy: number;
  ixz: number;
  iyz: number;
}

export interface MassPropertiesResult {
  massKg: number;
  centerOfMass: { x: number; y: number; z: number };
  inertia: InertiaTensor;
  principalInertia: number[];
  hasMass: boolean;
  massMissingCount: number;
  units: "SI (kg, m, kg·m²)";
}

export function extractMassProperties(raw: OnshapeRawMassProperties): MassPropertiesResult {
  const mass = Array.isArray(raw.mass) ? raw.mass : [];
  const centroid = Array.isArray(raw.centroid) ? raw.centroid : [];
  const inertia = Array.isArray(raw.inertia) ? raw.inertia : [];

  return {
    massKg: mass[0] ?? 0,
    centerOfMass: {
      x: centroid[0] ?? 0,
      y: centroid[1] ?? 0,
      z: centroid[2] ?? 0,
    },
    inertia: {
      ixx: inertia[0] ?? 0,
      iyy: inertia[4] ?? 0,
      izz: inertia[8] ?? 0,
      ixy: inertia[1] ?? 0,
      ixz: inertia[2] ?? 0,
      iyz: inertia[5] ?? 0,
    },
    principalInertia: raw.principalInertia ?? [],
    hasMass: raw.hasMass ?? false,
    massMissingCount: raw.massMissingCount ?? 0,
    units: "SI (kg, m, kg·m²)",
  };
}