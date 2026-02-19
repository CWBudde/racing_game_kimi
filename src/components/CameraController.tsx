import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";

export function CameraController() {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

  const { carPosition, carRotation, speed, isPlaying } = useGameStore();

  // Camera settings
  const CAMERA_HEIGHT = 8;
  const CAMERA_DISTANCE = 15;
  const CAMERA_LAG = 0.08;
  const LOOK_AHEAD_DISTANCE = 10;
  const MAX_SPEED = 80;

  useFrame(() => {
    if (!isPlaying) return;

    // Cast camera to PerspectiveCamera to access fov
    const perspCamera = camera as THREE.PerspectiveCamera;

    // Calculate desired camera position behind the car
    const carRot = carRotation[1];
    const carPos = new THREE.Vector3(...carPosition);

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
    const targetFOV = 60 + (speed / MAX_SPEED) * 15;
    perspCamera.fov += (targetFOV - perspCamera.fov) * 0.05;
    perspCamera.updateProjectionMatrix();
  });

  return null;
}
