import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { carTransform } from "../store/carTransform";
import { getTrackStart } from "./trackData";
import { TOP_SPEED_KMH } from "./carConstants";

export function CameraController() {
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

  // Only low-frequency flags come from the store (selectors → no per-frame
  // re-render). The car pose and speed are read straight from the transient
  // module inside the frame loop.
  const isPlaying = useGameStore((state) => state.isPlaying);
  const isCountingDown = useGameStore((state) => state.isCountingDown);
  const selectedTrackId = useGameStore((state) => state.selectedTrackId);

  // Camera settings
  const CAMERA_HEIGHT = 8;
  const CAMERA_DISTANCE = 15;
  const CAMERA_LAG = 0.08;
  const LOOK_AHEAD_DISTANCE = 10;

  useFrame(({ camera }) => {
    if (!isPlaying && !isCountingDown) return;

    // Cast camera to PerspectiveCamera to access fov
    const perspCamera = camera as THREE.PerspectiveCamera;

    if (isCountingDown) {
      const start = getTrackStart(selectedTrackId);
      const carRot = start.yaw;
      const startPos = new THREE.Vector3(...start.position);
      const forward = new THREE.Vector3(Math.sin(carRot), 0, Math.cos(carRot));
      const right = new THREE.Vector3(Math.cos(carRot), 0, -Math.sin(carRot));
      const gridCenter = startPos.clone().add(forward.clone().multiplyScalar(-6));

      targetPosition.current
        .copy(gridCenter)
        .add(forward.clone().multiplyScalar(-18))
        .add(right.clone().multiplyScalar(7))
        .setY(startPos.y + 6);
      targetLookAt.current.copy(gridCenter).add(forward.clone().multiplyScalar(2));
      targetLookAt.current.y = startPos.y + 1.3;

      camera.position.lerp(targetPosition.current, 0.055);
      currentLookAt.current.lerp(targetLookAt.current, 0.08);
      camera.lookAt(currentLookAt.current);
      perspCamera.fov += (48 - perspCamera.fov) * 0.06;
      perspCamera.updateProjectionMatrix();
      return;
    }

    // Calculate desired camera position behind the car
    const carRot = carTransform.yaw;
    const carPos = new THREE.Vector3(
      carTransform.x,
      carTransform.y,
      carTransform.z,
    );

    // Calculate offset based on car rotation
    const offsetX = Math.sin(carRot) * CAMERA_DISTANCE;
    const offsetZ = Math.cos(carRot) * CAMERA_DISTANCE;

    // Target camera position
    targetPosition.current.set(
      carPos.x - offsetX,
      carPos.y + CAMERA_HEIGHT,
      carPos.z - offsetZ,
    );

    // Target look-at position (ahead of car)
    const lookAheadX = Math.sin(carRot) * LOOK_AHEAD_DISTANCE;
    const lookAheadZ = Math.cos(carRot) * LOOK_AHEAD_DISTANCE;
    targetLookAt.current.set(
      carPos.x + lookAheadX,
      carPos.y + 1,
      carPos.z + lookAheadZ,
    );

    // Smoothly interpolate camera position
    camera.position.lerp(targetPosition.current, CAMERA_LAG);

    // Smoothly interpolate look-at target
    currentLookAt.current.lerp(targetLookAt.current, CAMERA_LAG * 1.5);

    // Apply look-at
    camera.lookAt(currentLookAt.current);

    // Add slight FOV effect based on speed
    const speedRatio = Math.min(carTransform.speedKmh / TOP_SPEED_KMH, 1);
    const targetFOV = 60 + speedRatio * 15;
    perspCamera.fov += (targetFOV - perspCamera.fov) * 0.05;
    perspCamera.updateProjectionMatrix();
  });

  return null;
}
