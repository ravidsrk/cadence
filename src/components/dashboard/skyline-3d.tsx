import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { format, parseISO } from "date-fns";
import { Box, Eye, Layers, RotateCcw } from "lucide-react";
import { heatmapGrid } from "@/lib/github/layout";
import { intensityLevelForCount } from "@/lib/github/stats";
import type { DayCount } from "@/lib/github/types";
import { cn } from "@/lib/utils";

type CameraPreset = "iso" | "skyline" | "top";

type PaletteSet = {
  top: [string, string, string, string, string, string];
  left: [string, string, string, string, string, string];
  right: [string, string, string, string, string, string];
  beacon: string;
};

const EMERALD_PALETTE: PaletteSet = {
  top: ["#1b2028", "#1f4738", "#2c6b53", "#429873", "#6fd19c", "#b8ffcf"],
  left: ["#13171d", "#17352a", "#21503e", "#327357", "#54a178", "#8dd1a3"],
  right: ["#0d1014", "#11271f", "#183b2e", "#255540", "#3e7859", "#699e7b"],
  beacon: "#b8ffcf",
};

const SKY_PALETTE: PaletteSet = {
  top: ["#1b2028", "#0c4a6e", "#0369a1", "#0284c7", "#38bdf8", "#bae6fd"],
  left: ["#13171d", "#083344", "#075985", "#0369a1", "#0ea5e9", "#7dd3fc"],
  right: ["#0d1014", "#05202b", "#082f49", "#075985", "#0284c7", "#38bdf8"],
  beacon: "#bae6fd",
};

function formatDayTip(day: DayCount): string {
  const noun = day.count === 1 ? "contribution" : "contributions";
  return `${day.count.toLocaleString("en-IN")} ${noun} · ${format(parseISO(day.date), "EEE, d MMM yyyy")}`;
}

/**
 * Interactive 3D Isometric Contribution Skyline (53x7 extruded 3D prism cityscape).
 */
export function Skyline3D({
  days,
  selectedDate,
  onSelect,
  compact = false,
  theme = "emerald",
}: {
  days: DayCount[];
  selectedDate?: string;
  onSelect?: (date: string) => void;
  compact?: boolean;
  theme?: "emerald" | "sky";
}) {
  const palette = theme === "sky" ? SKY_PALETTE : EMERALD_PALETTE;
  const { weeks, monthLabels } = useMemo(() => heatmapGrid(days), [days]);
  const [preset, setPreset] = useState<CameraPreset>("iso");
  const [hoveredDay, setHoveredDay] = useState<DayCount | null>(null);
  const [yawOffset, setYawOffset] = useState(0);
  const [pitchOffset, setPitchOffset] = useState(0);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseYaw: number;
    basePitch: number;
  } | null>(null);

  const maxCount = useMemo(
    () => Math.max(1, ...days.map((d) => d.count)),
    [days],
  );

  // Camera projection parameters tuned so the 53x7 model fills ~80% of the viewport width with compact height
  const baseAngles =
    preset === "skyline"
      ? { yaw: 0.34, pitch: 0.32, maxH: compact ? 48 : 66 }
      : preset === "top"
        ? { yaw: 0.42, pitch: 0.64, maxH: compact ? 32 : 44 }
        : { yaw: 0.38, pitch: 0.44, maxH: compact ? 42 : 58 };

  const yaw = Math.max(0.18, Math.min(0.82, baseAngles.yaw + yawOffset));
  const pitch = Math.max(0.22, Math.min(0.78, baseAngles.pitch + pitchOffset));
  const maxTowerHeight = baseAngles.maxH;

  const numWeeks = Math.max(1, weeks.length);
  const numDays = 7;
  const cellStep = compact ? 12 : 15;
  const cubeHalf = (cellStep * 0.78) / 2;

  const wx = Math.cos(yaw * Math.PI * 0.5) * cellStep;
  const wy = Math.sin(yaw * Math.PI * 0.5) * cellStep * pitch;
  const dx = -Math.sin(yaw * Math.PI * 0.5) * cellStep * 0.95;
  const dy = Math.cos(yaw * Math.PI * 0.5) * cellStep * pitch * 0.95;

  const project = (w: number, d: number, z: number) => ({
    x: w * wx + d * dx,
    y: w * wy + d * dy - z,
  });

  const slabThickness = compact ? 6 : 8;

  // Auto-frame bounding box so model fills ~80-85% of viewport width and fits height tightly
  const corners = [
    project(-0.8, -1.2, 0),
    project(numWeeks - 0.2, -1.2, 0),
    project(numWeeks - 0.2, numDays + 1.35, -slabThickness - 4),
    project(-0.8, numDays + 1.35, -slabThickness - 4),
    project(-0.8, -0.8, maxTowerHeight + 18),
    project(numWeeks - 0.2, -0.8, maxTowerHeight + 18),
  ];
  const rawMinX = Math.min(...corners.map((c) => c.x));
  const rawMaxX = Math.max(...corners.map((c) => c.x));
  const rawMinY = Math.min(...corners.map((c) => c.y));
  const rawMaxY = Math.max(...corners.map((c) => c.y));
  const modelW = Math.max(200, rawMaxX - rawMinX);
  const padX = modelW * 0.08;
  const minX = rawMinX - padX;
  const viewWidth = modelW + padX * 2;
  const minY = rawMinY - 10;
  const viewHeight = Math.max(110, rawMaxY - rawMinY + 22);

  const sTopNW = project(-0.8, -0.8, 0);
  const sTopNE = project(numWeeks - 0.2, -0.8, 0);
  const sTopSE = project(numWeeks - 0.2, numDays - 0.2, 0);
  const sTopSW = project(-0.8, numDays - 0.2, 0);

  const sBotNE = project(numWeeks - 0.2, -0.8, -slabThickness);
  const sBotSE = project(numWeeks - 0.2, numDays - 0.2, -slabThickness);
  const sBotSW = project(-0.8, numDays - 0.2, -slabThickness);

  const poly = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  function handleMouseDown(e: MouseEvent<SVGSVGElement>) {
    if ((e.target as HTMLElement).dataset.day) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseYaw: yawOffset,
      basePitch: pitchOffset,
    };
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const deltaX = (e.clientX - dragRef.current.startX) / 280;
    const deltaY = (e.clientY - dragRef.current.startY) / 240;
    setYawOffset(
      Math.max(-0.22, Math.min(0.22, dragRef.current.baseYaw - deltaX)),
    );
    setPitchOffset(
      Math.max(-0.2, Math.min(0.22, dragRef.current.basePitch + deltaY)),
    );
  }

  function handleMouseUp() {
    dragRef.current = null;
  }

  function handleTouchStart(e: TouchEvent<SVGSVGElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      baseYaw: yawOffset,
      basePitch: pitchOffset,
    };
  }

  function handleTouchMove(e: TouchEvent<SVGSVGElement>) {
    const touch = e.touches[0];
    if (!touch || !dragRef.current) return;
    const dxPx = touch.clientX - dragRef.current.startX;
    const dyPx = touch.clientY - dragRef.current.startY;
    if (Math.abs(dxPx) < Math.abs(dyPx) && Math.abs(dxPx) < 12) return;
    const deltaX = dxPx / 200;
    const deltaY = dyPx / 220;
    setYawOffset(
      Math.max(-0.22, Math.min(0.22, dragRef.current.baseYaw - deltaX)),
    );
    setPitchOffset(
      Math.max(-0.2, Math.min(0.22, dragRef.current.basePitch + deltaY)),
    );
  }

  function handleTouchEnd() {
    dragRef.current = null;
  }

  return (
    <div
      data-skyline-3d="true"
      className="relative overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(57,211,83,0.09),transparent_68%)] p-2 shadow-[var(--shadow-border)]"
    >
      {!compact ? (
        <div
          role="group"
          aria-label="3D camera presets"
          data-camera-presets="true"
          className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1 rounded-xl bg-background/85 p-1 shadow-[var(--shadow-border)] backdrop-blur-sm"
        >
          {(
            [
              { id: "iso", label: "Isometric", short: "Iso", icon: Box },
              {
                id: "skyline",
                label: "Low skyline",
                short: "Skyline",
                icon: Layers,
              },
              { id: "top", label: "High angle", short: "High", icon: Eye },
            ] as const
          ).map((cam) => {
            const Icon = cam.icon;
            const active =
              preset === cam.id && yawOffset === 0 && pitchOffset === 0;
            return (
              <button
                key={cam.id}
                type="button"
                data-camera-preset={cam.id}
                aria-pressed={active}
                onClick={() => {
                  setPreset(cam.id);
                  setYawOffset(0);
                  setPitchOffset(0);
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] transition-colors",
                  active
                    ? "bg-accent/20 text-accent shadow-[var(--shadow-border)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-3" />
                <span className="sm:hidden">{cam.short}</span>
                <span className="hidden sm:inline">{cam.label}</span>
              </button>
            );
          })}
          {yawOffset !== 0 || pitchOffset !== 0 ? (
            <button
              type="button"
              onClick={() => {
                setYawOffset(0);
                setPitchOffset(0);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Reset camera angle"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          ) : null}
        </div>
      ) : null}

      <svg
        viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`}
        className="h-auto max-h-[14rem] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing sm:max-h-[16.5rem]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={() => {
          handleMouseUp();
          setHoveredDay(null);
        }}
        role="img"
        aria-label="3D contribution skyline"
      >
        <polygon
          points={poly([sTopNW, sTopNE, sTopSE, sTopSW])}
          fill="#11141a"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.8"
        />
        <polygon
          points={poly([sTopSW, sTopSE, sBotSE, sBotSW])}
          fill="#0b0d12"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.6"
        />
        <polygon
          points={poly([sTopSE, sTopNE, sBotNE, sBotSE])}
          fill="#07090c"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.6"
        />

        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null;
            const lvl = intensityLevelForCount(day.count);
            const isSelected = day.date === selectedDate;
            const isHovered = hoveredDay?.date === day.date;
            const ratio =
              day.count > 0
                ? Math.pow(day.count / maxCount, 0.65)
                : 0;
            const h =
              day.count === 0
                ? 2.2
                : Math.max(6, ratio * maxTowerHeight) +
                  (isHovered || isSelected ? 4 : 0);

            const r = cubeHalf / cellStep;
            const bNE = project(wi + r, di - r, 0);
            const bSE = project(wi + r, di + r, 0);
            const bSW = project(wi - r, di + r, 0);

            const tNW = project(wi - r, di - r, h);
            const tNE = project(wi + r, di - r, h);
            const tSE = project(wi + r, di + r, h);
            const tSW = project(wi - r, di + r, h);

            const topColor =
              isSelected || isHovered ? "#ffffff" : palette.top[lvl];
            const leftColor =
              isSelected || isHovered ? palette.beacon : palette.left[lvl];
            const rightColor =
              isSelected || isHovered ? palette.top[3] : palette.right[lvl];

            return (
              <g
                key={day.date}
                data-day={day.date}
                className={cn(onSelect && "cursor-pointer")}
                onMouseEnter={() => setHoveredDay(day)}
                onClick={() => onSelect?.(day.date)}
              >
                <polygon
                  data-day={day.date}
                  points={poly([tSW, tSE, bSE, bSW])}
                  fill={leftColor}
                />
                <polygon
                  data-day={day.date}
                  points={poly([tSE, tNE, bNE, bSE])}
                  fill={rightColor}
                />
                <polygon
                  data-day={day.date}
                  points={poly([tNW, tNE, tSE, tSW])}
                  fill={topColor}
                  stroke={
                    isSelected || isHovered
                      ? palette.beacon
                      : "rgba(0,0,0,0.22)"
                  }
                  strokeWidth={isSelected || isHovered ? "1.1" : "0.35"}
                />
                {isSelected || isHovered ? (
                  <g pointerEvents="none">
                    <line
                      x1={(tNW.x + tSE.x) / 2}
                      y1={(tNW.y + tSE.y) / 2}
                      x2={(tNW.x + tSE.x) / 2}
                      y2={(tNW.y + tSE.y) / 2 - 12}
                      stroke={palette.beacon}
                      strokeWidth="1.4"
                      strokeDasharray="2 1.5"
                    />
                    <circle
                      cx={(tNW.x + tSE.x) / 2}
                      cy={(tNW.y + tSE.y) / 2 - 14}
                      r="3"
                      fill={palette.beacon}
                    />
                  </g>
                ) : null}
              </g>
            );
          }),
        )}

        {/* Unoccluded month labels along the front-left slab edge */}
        {(() => {
          let prevW = -100;
          return monthLabels.map((m) => {
            const minGap = m.label.includes("'") ? 4.2 : 3.4;
            const wCoord = Math.min(
              numWeeks - 0.5,
              Math.max(m.index, prevW + minGap),
            );
            prevW = wCoord;
            const pos = project(wCoord, numDays + 0.85, -slabThickness - 2);
            return (
              <text
                key={`${m.label}-${m.index}`}
                x={pos.x}
                y={pos.y}
                fill="var(--color-foreground)"
                fillOpacity="0.92"
                fontSize={compact ? "11.5" : "12.5"}
                fontWeight="600"
                fontFamily="var(--font-sans)"
                textAnchor="middle"
              >
                {m.label}
              </text>
            );
          });
        })()}
      </svg>

      {hoveredDay ? (
        <div className="pointer-events-none absolute top-2.5 right-2.5 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 font-mono text-xs text-foreground shadow-[var(--shadow-border)] backdrop-blur-sm tabular-nums">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: palette.beacon }}
          />
          <span className="truncate">{formatDayTip(hoveredDay)}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Interactive 3D perspective mouse-tilt card wrapper with dynamic spotlight sheen.
 */
export function Tilt3DCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [transform, setTransform] = useState(
    "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
  );
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    if (
      typeof window !== "undefined" &&
      (window.matchMedia?.("(hover: none)").matches ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
    const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
    const rotY = (relX - 0.5) * 9;
    const rotX = (0.5 - relY) * 9;
    setTransform(
      `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`,
    );
    setGlare({
      x: Math.round(relX * 100),
      y: Math.round(relY * 100),
      opacity: 0.14,
    });
  }

  function handleLeave() {
    setTransform(
      "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    );
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  }

  return (
    <div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transform,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative overflow-hidden transition-transform duration-150 ease-out will-change-transform",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, color-mix(in oklab, var(--color-accent) 35%, transparent), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

/**
 * 3D Isometric Podium Stage for the top 3 leaderboard entries (#2 left, #1 center, #3 right).
 */
export function Podium3DStage({
  items,
  onSelectUser,
}: {
  items: {
    rank: number;
    login: string;
    name: string;
    avatarUrl?: string;
    valueLabel: string;
    subLabel: string;
    scoreRatio: number;
  }[];
  onSelectUser?: (login: string) => void;
}) {
  if (items.length === 0) return null;
  const first = items.find((i) => i.rank === 1);
  const second = items.find((i) => i.rank === 2);
  const third = items.find((i) => i.rank === 3);
  const slots = [second, first, third].filter(
    (x): x is NonNullable<typeof x> => Boolean(x),
  );

  // Isometric pillar helper in a 560x220 stage
  const drawPillar = (
    cx: number,
    baseY: number,
    width: number,
    depth: number,
    height: number,
    colors: { top: string; left: string; right: string; stroke: string },
  ) => {
    const hw = width / 2;
    const hd = depth / 2;
    // Bottom diamond
    const bN = { x: cx, y: baseY - hd };
    const bE = { x: cx + hw, y: baseY };
    const bS = { x: cx, y: baseY + hd };
    const bW = { x: cx - hw, y: baseY };
    // Top diamond shifted by -height
    const tN = { x: bN.x, y: bN.y - height };
    const tE = { x: bE.x, y: bE.y - height };
    const tS = { x: bS.x, y: bS.y - height };
    const tW = { x: bW.x, y: bW.y - height };
    const pts = (arr: { x: number; y: number }[]) =>
      arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return {
      topFace: pts([tN, tE, tS, tW]),
      leftFace: pts([tW, tS, bS, bW]),
      rightFace: pts([tS, tE, bE, bS]),
      capCenter: { x: cx, y: tN.y + hd * 0.6 },
      colors,
    };
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(57,211,83,0.12),transparent_70%)] p-4 shadow-[var(--shadow-border)]">
      <svg
        viewBox="0 0 600 225"
        className="mx-auto h-auto max-h-60 w-full select-none"
        role="group"
        aria-label="3D top 3 shipping podium"
      >
        {/* Ambient 3D Stage Floor Grid */}
        <polygon
          points="300,115 555,170 300,220 45,170"
          fill="#101319"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
        <polygon
          points="300,128 495,170 300,208 105,170"
          fill="none"
          stroke="rgba(57,211,83,0.16)"
          strokeWidth="0.8"
          strokeDasharray="3 3"
        />

        {slots.map((slot) => {
          const isFirst = slot.rank === 1;
          const isSecond = slot.rank === 2;
          const cx = isFirst ? 300 : isSecond ? 165 : 435;
          const baseY = isFirst ? 174 : 182;
          const height = isFirst
            ? 84
            : isSecond
              ? Math.max(48, Math.round(slot.scoreRatio * 66))
              : Math.max(36, Math.round(slot.scoreRatio * 54));

          const palette = isFirst
            ? {
                top: "#6bff84",
                left: "#39d353",
                right: "#1f8838",
                stroke: "#a7f3d0",
              }
            : isSecond
              ? {
                  top: "#7dd3fc",
                  left: "#38bdf8",
                  right: "#0284c7",
                  stroke: "#bae6fd",
                }
              : {
                  top: "#c4b5fd",
                  left: "#a78bfa",
                  right: "#6d28d9",
                  stroke: "#ddd6fe",
                };

          const p = drawPillar(cx, baseY, 108, 42, height, palette);

          return (
            <g
              key={slot.login}
              role={onSelectUser ? "button" : undefined}
              tabIndex={onSelectUser ? 0 : undefined}
              aria-label={`#${slot.rank} @${slot.login}: ${slot.valueLabel} ${slot.subLabel}`}
              className="cursor-pointer transition-opacity hover:opacity-90 focus:outline-none"
              onClick={() => onSelectUser?.(slot.login)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && onSelectUser) {
                  e.preventDefault();
                  onSelectUser(slot.login);
                }
              }}
            >
              {/* Left shaded face */}
              <polygon points={p.leftFace} fill={p.colors.left} />
              {/* Right shadowed face */}
              <polygon points={p.rightFace} fill={p.colors.right} />
              {/* Top glowing face */}
              <polygon
                points={p.topFace}
                fill={p.colors.top}
                stroke={p.colors.stroke}
                strokeWidth="0.9"
              />
              {/* Rank Numeral on front-left face */}
              <text
                x={cx - 24}
                y={baseY - height / 2 + 12}
                fill="rgba(10,12,16,0.85)"
                fontSize="18"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                #{slot.rank}
              </text>
              {/* Floating Hologram Banner above the 3D pillar */}
              <line
                x1={cx}
                y1={p.capCenter.y}
                x2={cx}
                y2={p.capCenter.y - 16}
                stroke={p.colors.top}
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <rect
                x={cx - 62}
                y={p.capCenter.y - 58}
                width="124"
                height="40"
                rx="8"
                fill="#0d1015"
                stroke={p.colors.top}
                strokeWidth="1"
              />
              <text
                x={cx}
                y={p.capCenter.y - 40}
                fill="#f4f4f5"
                fontSize="11.5"
                fontWeight="600"
                fontFamily="var(--font-sans)"
                textAnchor="middle"
              >
                @{slot.login.slice(0, 14)}
              </text>
              <text
                x={cx}
                y={p.capCenter.y - 25}
                fill={p.colors.top}
                fontSize="12.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                {slot.valueLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
