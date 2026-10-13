import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { StudyTreeGlyph } from "../../components/study-tree";
import { treeLeafLayout } from "../../components/study-tree-layout";
import { getStudyTreeProgress } from "../../components/study-tree-progress";
import { cn } from "../../lib/cn";

/* Scene geometry, in viewBox units (560×420). */
const TREE = { dx: 37.5, dy: 7.5, scale: 1.25 };
const CAN_HOME = { x: 428, y: 300 };
/** Can body centre and spout tip in the can's own coordinates. */
const CAN_PIVOT = { x: 22, y: 27 };
const SPOUT_TIP = { x: -34, y: -2 };
/** Where the keyboard / tap pour holds the can, spout over the crown. */
const CAN_POUR_SPOT = { x: 338, y: 128 };
const POUR_TILT = -35;
const SUN_HOME = { x: 438, y: 92 };
const GRAVITY = 700;
const LEAF_HIT_RADIUS = 16;
const SHAKE_MS = 900;
const BURST_MS = 900;
const SPLASH_MS = 350;
const AUTO_POUR_MOVE_MS = 450;
const AUTO_POUR_END_MS = 1800;

type Vec = { x: number; y: number };
interface Drop extends Vec {
  id: number;
  vx: number;
  vy: number;
}
interface Splash extends Vec {
  id: number;
  born: number;
}
interface Grab {
  pointerId: number;
  offset: Vec;
  start: Vec;
  startTime: number;
  moved: boolean;
  last: Vec;
  lastTime: number;
}

interface Sim {
  now: number;
  can: Vec;
  canVel: Vec;
  canTarget: Vec;
  canGrab: Grab | null;
  tilt: number;
  autoPour: number | null;
  lastSpawn: number;
  drops: Drop[];
  splashes: Splash[];
  shakes: Map<number, number>;
  sun: Vec;
  sunVel: Vec;
  sunTarget: Vec;
  sunGrab: Grab | null;
  burst: number | null;
  nextId: number;
}

function rotate(point: Vec, degrees: number): Vec {
  const r = (degrees * Math.PI) / 180;
  return {
    x: point.x * Math.cos(r) - point.y * Math.sin(r),
    y: point.x * Math.sin(r) + point.y * Math.cos(r),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** A slightly bouncy spring; returns true while still moving. */
function springTo(position: Vec, velocity: Vec, target: Vec, dt: number) {
  const stiffness = 170;
  const damping = 15;
  velocity.x += (-stiffness * (position.x - target.x) - damping * velocity.x) * dt;
  velocity.y += (-stiffness * (position.y - target.y) - damping * velocity.y) * dt;
  position.x += velocity.x * dt;
  position.y += velocity.y * dt;
  const settled =
    Math.hypot(position.x - target.x, position.y - target.y) < 0.3 &&
    Math.hypot(velocity.x, velocity.y) < 2;
  if (settled) {
    position.x = target.x;
    position.y = target.y;
    velocity.x = 0;
    velocity.y = 0;
  }
  return !settled;
}

function groundAt(x: number) {
  // Close enough to the front hill's top edge for splashes.
  return x < 352 ? 362 - (x / 352) * 20 : 342 - ((x - 352) / 208) * 12;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function isFocusVisible(element: Element) {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * The dashboard hero picture: the learner's real study tree on a hillside.
 * The watering can can be grabbed and swung around; while held it pours, and
 * drops that touch a leaf make it shake. The sun can be dragged and springs
 * home, and a tap makes it shine. Both also respond to Enter/Space.
 * Every fill comes from theme tokens so the scene follows light and dark mode.
 */
export function GardenScene({
  completedSessions,
  streakDays,
  className,
}: {
  completedSessions: number | null;
  streakDays: number | null;
  className?: string;
}) {
  const loaded = completedSessions !== null;
  const progress = getStudyTreeProgress(completedSessions ?? 0);
  const leaves =
    progress.completedSessions === 0 ? 0 : ((progress.completedSessions - 1) % 100) + 1;
  const label = loaded
    ? `Khu vườn của bạn: cây có ${leaves} chiếc lá từ ${progress.completedSessions} buổi học` +
      (streakDays ? `, đang giữ nhịp ${streakDays} ngày liên tiếp.` : ".")
    : "Khu vườn của bạn đang được tải.";

  /** Leaf centres in scene coordinates, for drop collisions. */
  const leafCentres = useMemo(
    () =>
      loaded
        ? treeLeafLayout(leaves).map((leaf) => {
            const offset = rotate({ x: 0, y: -18 }, leaf.angle);
            return {
              x: TREE.dx + TREE.scale * (leaf.x + offset.x),
              y: TREE.dy + TREE.scale * (leaf.y + offset.y),
            };
          })
        : [],
    [leaves, loaded],
  );
  const leafCentresRef = useRef(leafCentres);
  leafCentresRef.current = leafCentres;

  const svgRef = useRef<SVGSVGElement>(null);
  const sim = useRef<Sim>({
    now: 0,
    can: { ...CAN_HOME },
    canVel: { x: 0, y: 0 },
    canTarget: { ...CAN_HOME },
    canGrab: null,
    tilt: 0,
    autoPour: null,
    lastSpawn: 0,
    drops: [],
    splashes: [],
    shakes: new Map(),
    sun: { ...SUN_HOME },
    sunVel: { x: 0, y: 0 },
    sunTarget: { ...SUN_HOME },
    sunGrab: null,
    burst: null,
    nextId: 1,
  });
  const frame = useRef<number | null>(null);
  const lastTime = useRef(0);
  const [, setTick] = useState(0);
  const [focused, setFocused] = useState<"can" | "sun" | null>(null);

  const step = useCallback((time: number) => {
    const s = sim.current;
    const reduced = prefersReducedMotion();
    const dt = Math.min(0.05, Math.max(0, (time - lastTime.current) / 1000));
    lastTime.current = time;
    s.now = time;
    let busy = false;

    // The keyboard / tap pour: glide over the crown, pour, then go home.
    let autoPouring = false;
    if (s.autoPour !== null) {
      const elapsed = time - s.autoPour;
      if (elapsed < AUTO_POUR_END_MS) {
        s.canTarget = { ...CAN_POUR_SPOT };
        autoPouring = elapsed >= AUTO_POUR_MOVE_MS;
        busy = true;
      } else {
        s.autoPour = null;
        s.canTarget = { ...CAN_HOME };
      }
    }

    // Watering can position and tilt.
    if (s.canGrab) {
      s.can = { ...s.canTarget };
      busy = true;
    } else if (reduced && s.autoPour === null) {
      s.can = { ...s.canTarget };
      s.canVel = { x: 0, y: 0 };
    } else {
      busy = springTo(s.can, s.canVel, s.canTarget, dt) || busy;
    }
    const pouring = Boolean(s.canGrab) || autoPouring;
    const tiltTarget = pouring
      ? POUR_TILT + clamp(s.canVel.x * 0.02, -12, 12)
      : clamp(s.canVel.x * 0.01, -8, 8);
    s.tilt += (tiltTarget - s.tilt) * Math.min(1, dt * 10);
    if (Math.abs(s.tilt - tiltTarget) > 0.4) busy = true;

    // New drops from the spout.
    if (pouring && s.tilt < -20 && time - s.lastSpawn > 45 && s.drops.length < 80) {
      s.lastSpawn = time;
      const tip = rotate({ x: SPOUT_TIP.x - CAN_PIVOT.x, y: SPOUT_TIP.y - CAN_PIVOT.y }, s.tilt);
      const direction = rotate({ x: -1, y: -0.45 }, s.tilt);
      s.drops.push({
        id: s.nextId++,
        x: s.can.x + CAN_PIVOT.x + tip.x,
        y: s.can.y + CAN_PIVOT.y + tip.y,
        vx: direction.x * 70 + s.canVel.x * 0.4 + (Math.random() - 0.5) * 16,
        vy: direction.y * 70 + s.canVel.y * 0.4,
      });
    }

    // Falling drops: a leaf they touch shakes, the ground makes a splash.
    const centres = leafCentresRef.current;
    s.drops = s.drops.filter((drop) => {
      drop.vy += GRAVITY * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      for (let index = 0; index < centres.length; index += 1) {
        const centre = centres[index]!;
        if (Math.hypot(drop.x - centre.x, drop.y - centre.y) < LEAF_HIT_RADIUS) {
          const started = s.shakes.get(index);
          if (started === undefined || time - started > 250) s.shakes.set(index, time);
          s.splashes.push({ id: s.nextId++, x: drop.x, y: drop.y, born: time });
          return false;
        }
      }
      if (drop.y >= groundAt(drop.x)) {
        s.splashes.push({ id: s.nextId++, x: drop.x, y: groundAt(drop.x), born: time });
        return false;
      }
      return drop.y < 460 && drop.x > -40 && drop.x < 600;
    });
    s.splashes = s.splashes.filter((splash) => time - splash.born < SPLASH_MS);
    for (const [index, started] of s.shakes) {
      if (time - started > SHAKE_MS) s.shakes.delete(index);
    }

    // The sun follows the pointer, then springs home.
    if (s.sunGrab) {
      s.sun = { ...s.sunTarget };
      busy = true;
    } else if (reduced) {
      s.sun = { ...SUN_HOME };
      s.sunVel = { x: 0, y: 0 };
    } else {
      busy = springTo(s.sun, s.sunVel, SUN_HOME, dt) || busy;
    }
    if (s.burst !== null && time - s.burst > BURST_MS) s.burst = null;

    busy =
      busy || s.drops.length > 0 || s.splashes.length > 0 || s.shakes.size > 0 || s.burst !== null;
    setTick((value) => value + 1);
    frame.current = busy ? requestAnimationFrame(step) : null;
  }, []);

  const wake = useCallback(() => {
    if (frame.current !== null) return;
    lastTime.current = performance.now();
    frame.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  function toScene(event: PointerEvent<Element>): Vec | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function beginGrab(event: PointerEvent<SVGGElement>, origin: Vec): Grab | null {
    if (event.pointerType === "mouse" && event.button !== 0) return null;
    const point = toScene(event);
    if (!point) return null;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const now = performance.now();
    return {
      pointerId: event.pointerId,
      offset: { x: point.x - origin.x, y: point.y - origin.y },
      start: point,
      startTime: now,
      moved: false,
      last: point,
      lastTime: now,
    };
  }

  function moveGrab(event: PointerEvent<SVGGElement>, grab: Grab, velocity: Vec) {
    const point = toScene(event);
    if (!point) return null;
    const now = performance.now();
    if (Math.hypot(point.x - grab.start.x, point.y - grab.start.y) > 4) grab.moved = true;
    const elapsed = Math.max(1, now - grab.lastTime) / 1000;
    velocity.x = velocity.x * 0.6 + ((point.x - grab.last.x) / elapsed) * 0.4;
    velocity.y = velocity.y * 0.6 + ((point.y - grab.last.y) / elapsed) * 0.4;
    grab.last = point;
    grab.lastTime = now;
    return { x: point.x - grab.offset.x, y: point.y - grab.offset.y };
  }

  function isTap(grab: Grab) {
    return !grab.moved && performance.now() - grab.startTime < 300;
  }

  function pour() {
    const s = sim.current;
    s.autoPour = performance.now();
    wake();
  }

  function shine() {
    sim.current.burst = performance.now();
    wake();
  }

  const can = {
    onPointerDown(event: PointerEvent<SVGGElement>) {
      const s = sim.current;
      const grab = beginGrab(event, s.can);
      if (!grab) return;
      s.canGrab = grab;
      s.autoPour = null;
      s.canTarget = { ...s.can };
      wake();
    },
    onPointerMove(event: PointerEvent<SVGGElement>) {
      const s = sim.current;
      if (!s.canGrab || s.canGrab.pointerId !== event.pointerId) return;
      const target = moveGrab(event, s.canGrab, s.canVel);
      if (target) s.canTarget = { x: clamp(target.x, 40, 500), y: clamp(target.y, 20, 320) };
    },
    onPointerUp(event: PointerEvent<SVGGElement>) {
      const s = sim.current;
      if (!s.canGrab || s.canGrab.pointerId !== event.pointerId) return;
      const tapped = isTap(s.canGrab);
      s.canGrab = null;
      s.canTarget = { ...CAN_HOME };
      if (tapped) pour();
      wake();
    },
    onPointerCancel() {
      const s = sim.current;
      s.canGrab = null;
      s.canTarget = { ...CAN_HOME };
      wake();
    },
    onKeyDown(event: KeyboardEvent<SVGGElement>) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      pour();
    },
  };

  const sun = {
    onPointerDown(event: PointerEvent<SVGGElement>) {
      const s = sim.current;
      const grab = beginGrab(event, s.sun);
      if (!grab) return;
      s.sunGrab = grab;
      s.sunTarget = { ...s.sun };
      wake();
    },
    onPointerMove(event: PointerEvent<SVGGElement>) {
      const s = sim.current;
      if (!s.sunGrab || s.sunGrab.pointerId !== event.pointerId) return;
      const target = moveGrab(event, s.sunGrab, s.sunVel);
      if (target) s.sunTarget = { x: clamp(target.x, 40, 520), y: clamp(target.y, 30, 330) };
    },
    onPointerUp(event: PointerEvent<SVGGElement>) {
      const s = sim.current;
      if (!s.sunGrab || s.sunGrab.pointerId !== event.pointerId) return;
      const tapped = isTap(s.sunGrab);
      s.sunGrab = null;
      if (tapped) shine();
      wake();
    },
    onPointerCancel() {
      sim.current.sunGrab = null;
      wake();
    },
    onKeyDown(event: KeyboardEvent<SVGGElement>) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      shine();
    },
  };

  function focusHandlers(name: "can" | "sun") {
    return {
      onFocus: (event: FocusEvent<SVGGElement>) =>
        setFocused(isFocusVisible(event.currentTarget) ? name : null),
      onBlur: () => setFocused(null),
    };
  }

  const s = sim.current;
  const reduced = prefersReducedMotion();
  const sway = (index: number) => {
    const started = s.shakes.get(index);
    if (started === undefined || reduced) return 0;
    const t = (s.now - started) / 1000;
    return 16 * Math.exp(-t * 4) * Math.sin(t * 28);
  };
  const burstProgress = s.burst === null ? null : clamp((s.now - s.burst) / BURST_MS, 0, 1);
  const burstGrow = burstProgress === null ? 0 : reduced ? 10 : 22 * (1 - (1 - burstProgress) ** 3);
  const sunScale =
    burstProgress === null || reduced ? 1 : 1 + 0.16 * Math.sin(Math.PI * burstProgress);

  return (
    <svg
      ref={svgRef}
      role="group"
      aria-label={label}
      aria-busy={!loaded}
      viewBox="0 0 560 420"
      className={cn("block h-auto w-full select-none overflow-visible", className)}
      preserveAspectRatio="xMidYMax meet"
    >
      {/* Sun: drag it and it springs home; a tap makes it shine. */}
      <g
        role="button"
        tabIndex={0}
        aria-label="Mặt trời. Chạm để tỏa nắng, kéo rồi thả để mặt trời trở về chỗ cũ."
        transform={`translate(${s.sun.x} ${s.sun.y})`}
        className={cn("outline-none", s.sunGrab ? "cursor-grabbing" : "cursor-grab")}
        style={{ touchAction: "none" }}
        {...sun}
        {...focusHandlers("sun")}
      >
        {burstProgress !== null ? (
          <g
            className="stroke-warning"
            strokeWidth="4"
            strokeLinecap="round"
            opacity={1 - burstProgress}
            transform={`rotate(${burstProgress * 40})`}
            data-sun-rays="true"
          >
            {Array.from({ length: 12 }, (_, index) => {
              const inner = rotate({ x: 0, y: -(46 + burstGrow) }, index * 30);
              const outer = rotate({ x: 0, y: -(58 + burstGrow * 1.8) }, index * 30);
              return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
            })}
          </g>
        ) : null}
        <circle r={66 * sunScale} className="fill-warning/10" />
        <circle r={36 * sunScale} className="fill-warning/40" />
        {focused === "sun" ? (
          <circle
            r="48"
            className="fill-none stroke-focus"
            strokeWidth="2.5"
            strokeDasharray="5 5"
          />
        ) : null}
      </g>

      <g aria-hidden="true" pointerEvents="none">
        {/* Clouds */}
        <path
          d="M70 128h96a20 20 0 0 0-22-26 28 28 0 0 0-52-6 22 22 0 0 0-22 32Z"
          className="fill-surface stroke-line"
          strokeWidth="1.5"
        />
        <path
          d="M330 58h64a14 14 0 0 0-16-18 20 20 0 0 0-36-4 15 15 0 0 0-12 22Z"
          className="fill-surface stroke-line"
          strokeWidth="1.5"
        />
        {/* Birds */}
        <path
          d="M236 92q7-8 14 0q7-8 14 0M282 70q5-6 10 0q5-6 10 0"
          className="fill-none stroke-ink/35"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Letters drifting like seeds */}
        <g className="fill-tree/45 font-display" fontWeight="600">
          <text x="96" y="214" fontSize="30">
            A
          </text>
          <text x="152" y="176" fontSize="22">
            b
          </text>
          <text x="470" y="214" fontSize="24">
            c
          </text>
        </g>
        {/*
          Hills run far past the viewBox on both sides; the svg overflows into
          the hero, which clips it, so the ground spans the whole card.
        */}
        <path
          d="M-1600 420V398C-1000 394-420 388-140 368C-20 352 70 298 160 290C222 284 262 296 296 300C380 309 470 262 560 284C640 302 760 300 900 300V420Z"
          className="fill-tree/10"
        />
        <path
          d="M-1600 420V408C-900 406-340 402-80 390C50 382 140 348 236 344C292 342 320 342 352 342C440 340 500 320 560 330C640 344 760 340 900 340V420Z"
          className="fill-tree/20"
        />
        <ellipse cx="300" cy="352" rx="74" ry="7" className="fill-tree/20" />
      </g>

      {/* The learner's tree, scaled from its 420×300 canvas so its base sits on the hill */}
      {loaded ? (
        <g
          transform={`translate(${TREE.dx} ${TREE.dy}) scale(${TREE.scale})`}
          aria-hidden="true"
          pointerEvents="none"
        >
          <StudyTreeGlyph leaves={leaves} sway={sway} />
        </g>
      ) : null}

      <g aria-hidden="true" pointerEvents="none">
        {/* Book stack */}
        <g transform="translate(118 318) rotate(-4)">
          <rect width="86" height="16" rx="4" className="fill-ink" />
          <rect x="6" y="4" width="70" height="3" rx="1.5" className="fill-surface/70" />
          <rect x="8" y="-15" width="72" height="15" rx="4" className="fill-accent" />
          <rect x="14" y="-11" width="56" height="3" rx="1.5" className="fill-surface/70" />
        </g>
        {/* Grass and sprouts */}
        <path
          d="M58 360q2-12 8-16M64 360q4-10 12-12M500 334q2-11 8-15M506 334q4-9 11-11M216 348q-2-9-8-12"
          className="fill-none stroke-tree/50"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g className="fill-accent/70">
          <path d="M30 382q-14-10-4-16q10 4 4 16Z" />
          <path d="M540 368q12-10 4-16q-10 4-4 16Z" />
        </g>
        {/* Splashes and falling drops */}
        {s.splashes.map((splash) => {
          const age = (s.now - splash.born) / SPLASH_MS;
          return (
            <ellipse
              key={splash.id}
              cx={splash.x}
              cy={splash.y}
              rx={3 + age * 9}
              ry={1.5 + age * 3}
              className="fill-none stroke-positive/70"
              strokeWidth="1.5"
              opacity={1 - age}
            />
          );
        })}
        <g className="fill-positive/70">
          {s.drops.map((drop) => (
            <ellipse key={drop.id} cx={drop.x} cy={drop.y} rx="2.5" ry="4" />
          ))}
        </g>
      </g>

      {/* Watering can: hold and swing it to water the tree. */}
      <g
        role="button"
        tabIndex={0}
        aria-label="Bình tưới. Giữ và kéo để tưới cây, hoặc nhấn để tưới một lượt."
        transform={`translate(${s.can.x} ${s.can.y}) rotate(${s.tilt} ${CAN_PIVOT.x} ${CAN_PIVOT.y})`}
        className={cn("outline-none", s.canGrab ? "cursor-grabbing" : "cursor-grab")}
        style={{ touchAction: "none" }}
        data-pouring={s.canGrab !== null || s.autoPour !== null ? "true" : undefined}
        {...can}
        {...focusHandlers("can")}
      >
        <rect x="-44" y="-14" width="116" height="66" rx="12" fill="transparent" />
        <path d="M0 10h44l-4 34H4Z" className="fill-focus/80" />
        <path
          d="M44 18q22-4 16 18"
          className="fill-none stroke-focus/80"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M2 18L-30 0" className="stroke-focus/80" strokeWidth="6" strokeLinecap="round" />
        <rect x="-38" y="-6" width="14" height="9" rx="3" className="fill-focus/80" />
        {focused === "can" ? (
          <rect
            x="-48"
            y="-18"
            width="124"
            height="74"
            rx="14"
            className="fill-none stroke-focus"
            strokeWidth="2.5"
            strokeDasharray="5 5"
          />
        ) : null}
      </g>
    </svg>
  );
}
