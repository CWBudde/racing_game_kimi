// Input-driven kart force model — the single handling core shared by the player
// (carPhysics.ts, driven by keyboard/gamepad) and the AI (aiController.ts,
// driven by a pursuit controller). Extracting it means both cars feel identical
// and there is one place to tune handling.
//
// The function owns: velocity decomposition, steering lerp + angular velocity,
// acceleration / braking / coast damping, lateral grip correction, handbrake
// damping, and the upright slerp. Everything car-specific (input source, boost,
// items, laps, camera transform, cosmetics) stays with the caller.
import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import { smoothAlpha } from "./smoothing";
import {
  ACCELERATION,
  BRAKE_FORCE,
  CAR_MASS,
  DECELERATION,
  MAX_REVERSE_SPEED,
  MAX_STEERING_ANGLE,
  STEERING_SPEED,
} from "./carConstants";

export interface KartInput {
  steer: number; // -1..1 target (before lerp): left negative, right positive
  throttle: number; // 0..1
  brake: number; // 0..1
  handbrake: boolean;
}

export interface KartTuning {
  maxSpeed: number; // forward speed cap in m/s (caller folds in boost/speed-star)
  accelMul: number; // acceleration multiplier (caller folds in boost)
  gripBase: number; // lateral grip strength when not handbraking
}

export interface KartStepResult {
  forwardSpeed: number;
  speed: number;
  yaw: number;
  acceleration: number; // signed longitudinal accel this frame (for chassis tilt)
  pos: { x: number; y: number; z: number };
}

export const yawFromQuat = (q: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number =>
  Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));

/**
 * Applies one frame of kart handling forces to `body` from an abstract input.
 * `steerState` is a per-car mutable holder ({ current }) so the steering lerp
 * persists across frames. `extraForwardImpulse` is an already-scaled impulse
 * magnitude applied along +forward right after the accel impulse (the player
 * uses it for turbo; pass 0 otherwise) — placed here so behaviour matches the
 * pre-refactor ordering exactly.
 */
export function applyKartForces(
  body: RapierRigidBody,
  input: KartInput,
  steerState: { current: number },
  tuning: KartTuning,
  dt: number,
  extraForwardImpulse = 0,
): KartStepResult {
  const vel = body.linvel();
  const rot = body.rotation();
  const yaw = yawFromQuat(rot);

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  const forwardSpeed = vel.x * forward.x + vel.z * forward.z;
  const lateralSpeed = vel.x * right.x + vel.z * right.z;
  const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);

  // Steering (frame-rate-independent lerp toward the target angle).
  const targetSteering = input.steer * MAX_STEERING_ANGLE;
  const steerLerp = 1 - Math.pow(0.001, dt);
  steerState.current += (targetSteering - steerState.current) * steerLerp;
  const currentSteering = steerState.current;

  // Longitudinal.
  let acceleration = 0;
  if (input.throttle > 0) {
    if (forwardSpeed < tuning.maxSpeed) {
      acceleration = ACCELERATION * tuning.accelMul * input.throttle;
    }
  } else if (input.brake > 0) {
    if (forwardSpeed > 0.5) {
      acceleration = -BRAKE_FORCE * input.brake;
    } else if (forwardSpeed > -MAX_REVERSE_SPEED) {
      acceleration = -ACCELERATION * 0.5 * input.brake;
    }
  } else {
    const dampFactor = Math.exp(-DECELERATION * 0.15 * dt);
    body.setLinvel(
      { x: vel.x * dampFactor, y: vel.y, z: vel.z * dampFactor },
      true,
    );
  }

  if (Math.abs(acceleration) > 0.1) {
    const forceMag = acceleration * dt * CAR_MASS;
    body.applyImpulse(
      { x: forward.x * forceMag, y: 0, z: forward.z * forceMag },
      true,
    );
  }

  if (extraForwardImpulse !== 0) {
    body.applyImpulse(
      {
        x: forward.x * extraForwardImpulse,
        y: 0,
        z: forward.z * extraForwardImpulse,
      },
      true,
    );
  }

  // Steering angular velocity, scaled by speed so the kart doesn't spin in place.
  if (
    Math.abs(currentSteering) > 0.01 &&
    (Math.abs(speed) > 0.1 || input.throttle > 0 || input.brake > 0)
  ) {
    const steerSign = forwardSpeed >= 0 ? 1 : -1;
    const minTurnRate = 0.15;
    const speedFactor = Math.max(
      Math.min(speed / 15, 1) * Math.max(1 - speed / 120, 0.3),
      minTurnRate,
    );
    const angularVelY =
      -currentSteering * STEERING_SPEED * speedFactor * steerSign;
    body.setAngvel({ x: 0, y: angularVelY, z: 0 }, true);
  } else {
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // Lateral grip correction (reduced while handbraking, for drift).
  if (Math.abs(lateralSpeed) > 0.2) {
    const gripStrength = input.handbrake ? 0.4 : tuning.gripBase;
    const correctionForce = -lateralSpeed * gripStrength * CAR_MASS * dt;
    body.applyImpulse(
      { x: right.x * correctionForce, y: 0, z: right.z * correctionForce },
      true,
    );
  }

  if (input.handbrake) {
    body.setLinvel(
      { x: vel.x * (1 - 1.5 * dt), y: vel.y, z: vel.z * (1 - 1.5 * dt) },
      true,
    );
  }

  // Keep the kart upright and yaw-only.
  const uprightRot = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw,
  );
  const currentQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
  currentQuat.slerp(uprightRot, smoothAlpha(0.3, dt));
  body.setRotation(
    { x: currentQuat.x, y: currentQuat.y, z: currentQuat.z, w: currentQuat.w },
    true,
  );

  const pos = body.translation();
  return { forwardSpeed, speed, yaw, acceleration, pos };
}
