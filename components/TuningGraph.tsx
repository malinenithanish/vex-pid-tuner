"use client";

import { useEffect, useRef } from "react";
import { simulateDistanceControl } from "../lib/tuning/drive";
import type { DrivetrainConfig, PidGains, RobotBody } from "../lib/tuning/types";

interface TuningGraphProps {
  robot: RobotBody;
  config: DrivetrainConfig;
  gains: PidGains;
  target: number;
}

const HORIZON = 5;
const GRID_COLOR = "#9aa0a8";
const AXIS_COLOR = "#6b7280";
const TARGET_COLOR = "#eab308";
const SERIES_COLOR = "#3b82f6";
const BACKGROUND_COLOR = "#ffffff";
const FOREGROUND_COLOR = "#171717";

const DARK_COLORS: Record<string, string> = {
  grid: "#4b5563",
  axis: "#9ca3af",
  target: "#facc15",
  series: "#60a5fa",
  background: "#0a0a0a",
  foreground: "#ededed",
};

function pickDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function TuningGraph({ robot, config, gains, target }: TuningGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dark = pickDark();
    const colors = dark ? DARK_COLORS : { grid: GRID_COLOR, axis: AXIS_COLOR, target: TARGET_COLOR, series: SERIES_COLOR, background: BACKGROUND_COLOR, foreground: FOREGROUND_COLOR };

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = canvas.clientHeight || 280;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const margin = { top: 12, right: 12, bottom: 28, left: 48 };
    const plotW = cssWidth - margin.left - margin.right;
    const plotH = cssHeight - margin.top - margin.bottom;

    const sim = simulateDistanceControl(target, gains, config, robot, { horizon: HORIZON });
    const distanceMax = Math.max(1.2 * target, ...sim.samples.map((s) => Math.abs(s.s)));

    const xScale = (t: number) => margin.left + (t / HORIZON) * plotW;
    const yScale = (value: number) => margin.top + plotH - (value / distanceMax) * plotH;

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let i = 1; i <= 4; i++) {
      const y = margin.top + (plotH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotW, y);
      ctx.stroke();
    }
    for (let i = 1; i <= 4; i++) {
      const x = margin.left + (plotW / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = colors.axis;
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = colors.axis;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const value = (distanceMax / 5) * i;
      const y = yScale(value);
      ctx.fillText(value.toFixed(1), margin.left - 6, y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 5; i++) {
      const t = (HORIZON / 5) * i;
      ctx.fillText(t.toFixed(1), xScale(t), margin.top + plotH + 6);
    }

    ctx.strokeStyle = colors.target;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(target));
    ctx.lineTo(xScale(HORIZON), yScale(target));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = colors.series;
    ctx.lineWidth = 2;
    ctx.beginPath();
    sim.samples.forEach((s, i) => {
      const x = xScale(s.t);
      const y = yScale(s.s);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = colors.foreground;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("distance (m)", margin.left + 2, 2);
  }, [robot, config, gains, target]);

  return (
    <div className="graph-container">
      <canvas ref={canvasRef} className="graph-canvas" aria-label="Simulated distance vs time for the tuned PID" />
      <p className="table-caption">
        Simulated {HORIZON}s drive with the tuned PID toward {target}m, using your imported mass
        and drive setup. Dashed line is the target.
      </p>
    </div>
  );
}