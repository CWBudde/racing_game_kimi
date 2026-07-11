import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { centerlineSample, getTrackLayout } from "./trackData";
import { useGameStore } from "../store/gameStore";
import {
  CAR_MASS,
  MAX_SPEED,
  OFF_TRACK_DRAG,
  OFF_TRACK_MARGIN,
  OFF_TRACK_MAX_SPEED_MUL,
} from "./carConstants";
import { applyKartForces, yawFromQuat } from "./kartForces";
import { DIFFICULTY, computeAiInput, rubberBand } from "./aiController";
import {
  buildGates,
  centerlineYaw,
  gateAlong,
  gateLateral,
} from "./gates";
import {
  getRacer,
  seedProgress,
  stampFinish,
  updateProgress,
} from "../store/raceStandings";

interface AIOpponentProps {
  id: string;
  label: string;
  color: string;
  carNumber: number;
  startT: number;
}

const FALL_RESET_Y = -10;
const STUCK_SECONDS = 1.5; // no progress for this long -> snap back to the line
const SPAWN_HEIGHT = 1.0; // drop height above the centerline when (re)spawning

export function AIOpponent({
  id,
  color,
  carNumber,
  startT,
}: AIOpponentProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const steerStateRef = useRef({ current: 0 });
  const lapRef = useRef(1);
  const nextGateRef = useRef(1);
  const gateAlongRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const stuckTimerRef = useRef(0);
  const lastProgressRef = useRef(0);
  // Sticky centerline index (see centerlineSample): keeps the AI matched to
  // its own leg of a self-crossing layout, both for steering aim and progress.
  const sampleIdxRef = useRef<number | null>(null);
  const wheelGroupRef = useRef<THREE.Group>(null);
  const wheelRotRef = useRef(0);

  const isPlaying = useGameStore((state) => state.isPlaying);
  const isPaused = useGameStore((state) => state.isPaused);
  const isCountingDown = useGameStore((state) => state.isCountingDown);
  const selectedTrackId = useGameStore((state) => state.selectedTrackId);
  const difficulty = useGameStore((state) => state.difficulty);
  const totalLaps = useGameStore((state) => state.totalLaps);

  const track = useMemo(
    () => getTrackLayout(selectedTrackId),
    [selectedTrackId],
  );
  // Meters between adjacent centerline samples — the AI controller measures
  // lookahead/braking horizons in meters via index offsets on this spacing.
  const spacing = useMemo(
    () => track.curve.getLength() / track.points.length,
    [track],
  );
  const gates = useMemo(
    () => buildGates(track.points, track.width),
    [track],
  );

  // Grid pose derived from the car's start offset along the racing line.
  const spawn = useMemo(() => {
    const t0 = ((startT % 1) + 1) % 1;
    const p = track.curve.getPoint(t0);
    const tangent = track.curve.getTangent(t0).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);
    return {
      position: [p.x, p.y + SPAWN_HEIGHT, p.z] as [number, number, number],
      rotation: [0, yaw, 0] as [number, number, number],
      t0,
    };
  }, [startT, track]);

  const numberCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(carNumber), 32, 32);
    return canvas;
  }, [carNumber]);

  // (Re)place the car on the grid and reset race trackers whenever a countdown
  // or race begins — a dynamic body isn't repositioned by the initial prop on a
  // same-track restart, and it settles during the countdown before racing.
  useEffect(() => {
    if (!isPlaying && !isCountingDown) return;
    const rb = rbRef.current;
    if (!rb) return;
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, spawn.rotation[1], 0),
    );
    rb.setTranslation(
      { x: spawn.position[0], y: spawn.position[1], z: spawn.position[2] },
      true,
    );
    rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    steerStateRef.current.current = 0;
    lapRef.current = 1;
    nextGateRef.current = 1;
    gateAlongRef.current = null;
    finishedRef.current = false;
    stuckTimerRef.current = 0;
    sampleIdxRef.current = Math.round(spawn.t0 * track.points.length) % track.points.length;
    // Seed below any real progress so the first frame reads as "advanced" and
    // can't false-trigger stuck recovery against the signed progress metric.
    lastProgressRef.current = -Infinity;
    updateProgress(id, 1, spawn.t0, spawn.position[0], spawn.position[2]);
  }, [isPlaying, isCountingDown, spawn, id, track.points.length]);

  useFrame((_, delta) => {
    const rb = rbRef.current;
    if (!rb || !isPlaying || isPaused) return;
    const dt = Math.min(delta, 0.05);

    const pos = rb.translation();
    const rot = rb.rotation();
    const vel = rb.linvel();
    const yaw = yawFromQuat(rot);
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const forwardSpeed = vel.x * forward.x + vel.z * forward.z;

    const idx = centerlineSample(
      track.points,
      pos.x,
      pos.z,
      sampleIdxRef.current,
    ).index;
    sampleIdxRef.current = idx;
    const t = idx / track.points.length;
    const self = getRacer(id);
    const aiProgress = self ? self.progress : lapRef.current - 1 + t;

    // Fell off the world, or wall-pinned with no progress: snap back to the line.
    const advanced = aiProgress > lastProgressRef.current + 1e-4;
    if (advanced) {
      stuckTimerRef.current = 0;
      lastProgressRef.current = aiProgress;
    } else if (!finishedRef.current) {
      stuckTimerRef.current += dt;
    }
    if (
      !finishedRef.current &&
      (pos.y < FALL_RESET_Y || stuckTimerRef.current > STUCK_SECONDS)
    ) {
      const p = track.points[idx];
      const yaw2 = centerlineYaw(track.points, idx);
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yaw2,
      );
      rb.setTranslation({ x: p.x, y: p.y + SPAWN_HEIGHT, z: p.z }, true);
      rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      steerStateRef.current.current = 0;
      stuckTimerRef.current = 0;
      gateAlongRef.current = null;
      // Teleport-safe: reseed the fraction (no wrap inference) and sync the
      // stuck baseline so the next frame's delta reads ~0.
      seedProgress(id, t, p.x, p.z);
      lastProgressRef.current = getRacer(id)?.progress ?? lastProgressRef.current;
      return;
    }

    // Off-track slowdown (G1) — same rule as the player, so an AI shoved onto
    // the grass by contact pays the same penalty: thrust gated to half speed
    // plus a velocity scrub (applied after the force step below). Squared
    // compare — only the threshold matters, no need for the sqrt.
    const centerPt = track.points[idx];
    const offDx = centerPt.x - pos.x;
    const offDz = centerPt.z - pos.z;
    const offRoadAt = track.width * 0.5 + OFF_TRACK_MARGIN;
    const offTrack = offDx * offDx + offDz * offDz > offRoadAt * offRoadAt;

    // Difficulty pace + rubber-band toward the player. A finished car targets 0
    // so it brakes to a stop after crossing the line.
    const diff = DIFFICULTY[difficulty];
    const player = getRacer("player");
    const gap = player ? player.progress - aiProgress : 0;
    const baseMax = MAX_SPEED * diff.paceMul;
    const max =
      (finishedRef.current ? 0 : rubberBand(baseMax, gap, diff.rubberMax)) *
      (offTrack ? OFF_TRACK_MAX_SPEED_MUL : 1);

    const { input } = computeAiInput({
      points: track.points,
      idx,
      spacing,
      posX: pos.x,
      posZ: pos.z,
      yaw,
      forwardSpeed,
      baseMax: max,
    });

    applyKartForces(
      rb,
      input,
      steerStateRef.current,
      { maxSpeed: max, accelMul: 1, gripBase: 0.9 },
      dt,
    );

    if (offTrack) {
      const v = rb.linvel();
      const drag = Math.exp(-OFF_TRACK_DRAG * dt);
      rb.setLinvel({ x: v.x * drag, y: v.y, z: v.z * drag }, true);
    }

    // Lap counting — identical gate model to the player (gates.ts).
    const gate = gates[nextGateRef.current];
    const along = gateAlong(gate, pos.x, pos.z);
    const prevAlong = gateAlongRef.current;
    if (
      prevAlong !== null &&
      prevAlong < 0 &&
      along >= 0 &&
      gateLateral(gate, pos.x, pos.z) < gate.halfWidth
    ) {
      const crossed = nextGateRef.current;
      nextGateRef.current = (crossed + 1) % gates.length;
      gateAlongRef.current = gateAlong(
        gates[nextGateRef.current],
        pos.x,
        pos.z,
      );
      if (crossed === 0) {
        if (lapRef.current >= totalLaps) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            stampFinish(id, useGameStore.getState().totalRaceTime);
          }
        } else {
          lapRef.current += 1;
        }
      }
    } else {
      gateAlongRef.current = along;
    }

    updateProgress(id, lapRef.current, t, pos.x, pos.z);

    // Cosmetic wheel spin.
    wheelRotRef.current += forwardSpeed * dt * 0.5;
    if (wheelGroupRef.current) {
      wheelGroupRef.current.children.forEach((child) => {
        child.rotation.x = wheelRotRef.current;
      });
    }
  });

  const darkColor = new THREE.Color(color).multiplyScalar(0.85).getStyle();

  return (
    <RigidBody
      ref={rbRef}
      position={spawn.position}
      rotation={spawn.rotation}
      mass={CAR_MASS}
      userData={{ isPlayer: false, aiId: id }}
      colliders={false}
      linearDamping={0.3}
      angularDamping={0.8}
      enabledRotations={[false, true, false]}
      restitution={0.3}
      friction={0.7}
    >
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 0.6, 3.5]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh castShadow position={[0, 1, -0.3]}>
        <boxGeometry args={[1.4, 0.5, 2]} />
        <meshStandardMaterial color={darkColor} />
      </mesh>

      <mesh position={[0, 1.1, 0.8]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[1.2, 0.4, 0.1]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh castShadow position={[0, 1.3, -1.6]}>
        <boxGeometry args={[1.6, 0.1, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0.6, 1, -1.6]}>
        <boxGeometry args={[0.1, 0.6, 0.2]} />
        <meshStandardMaterial color={darkColor} />
      </mesh>
      <mesh castShadow position={[-0.6, 1, -1.6]}>
        <boxGeometry args={[0.1, 0.6, 0.2]} />
        <meshStandardMaterial color={darkColor} />
      </mesh>

      <mesh position={[0.6, 0.5, 1.75]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial
          color="#ffffcc"
          emissive="#ffffaa"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[-0.6, 0.5, 1.75]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial
          color="#ffffcc"
          emissive="#ffffaa"
          emissiveIntensity={0.5}
        />
      </mesh>

      <mesh position={[0.6, 0.6, -1.75]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[-0.6, 0.6, -1.75]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={0.5}
        />
      </mesh>

      <mesh position={[0.91, 0.6, 0]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial color="#ffffff">
          <canvasTexture attach="map" image={numberCanvas} />
        </meshBasicMaterial>
      </mesh>
      <mesh position={[-0.91, 0.6, 0]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial color="#ffffff">
          <canvasTexture attach="map" image={numberCanvas} />
        </meshBasicMaterial>
      </mesh>

      <group ref={wheelGroupRef}>
        <mesh castShadow position={[0.9, 0.3, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh castShadow position={[-0.9, 0.3, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh castShadow position={[0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh castShadow position={[-0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      <CuboidCollider args={[0.9, 0.5, 1.75]} position={[0, 0.6, 0]} />
    </RigidBody>
  );
}
