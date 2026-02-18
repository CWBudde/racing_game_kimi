import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

interface CarProps {
  position?: [number, number, number];
}

// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  shift: false
};

export function Car({ position = [0, 2, 0] }: CarProps) {
  const carRef = useRef<RapierRigidBody>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group>(null);
  
  const { isPlaying, isPaused, updateSpeed, updateCarPosition, updateCarRotation, boostAmount, updateBoost } = useGameStore();
  
  const [localSpeed, setLocalSpeed] = useState(0);
  const [steering, setSteering] = useState(0);
  
  // Car physics constants
  const MAX_SPEED = 60;
  const MAX_REVERSE_SPEED = 20;
  const ACCELERATION = 30;
  const DECELERATION = 15;
  const BRAKE_FORCE = 50;
  const STEERING_SPEED = 2.5;
  const MAX_STEERING_ANGLE = 0.5;
  const BOOST_MULTIPLIER = 1.5;
  
  // Setup keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.w = true;
      if (key === 'a' || key === 'arrowleft') keys.a = true;
      if (key === 's' || key === 'arrowdown') keys.s = true;
      if (key === 'd' || key === 'arrowright') keys.d = true;
      if (key === ' ') keys.space = true;
      if (key === 'shift') keys.shift = true;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.w = false;
      if (key === 'a' || key === 'arrowleft') keys.a = false;
      if (key === 's' || key === 'arrowdown') keys.s = false;
      if (key === 'd' || key === 'arrowright') keys.d = false;
      if (key === ' ') keys.space = false;
      if (key === 'shift') keys.shift = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Physics update
  useFrame((_, delta) => {
    if (!carRef.current || !isPlaying || isPaused) return;
    
    const car = carRef.current;
    const currentVel = car.linvel();
    const currentRot = car.rotation();
    
    // Get forward direction
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w)
    );
    
    // Calculate current speed in forward direction
    const forwardSpeed = currentVel.x * forward.x + currentVel.z * forward.z;
    const speed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);
    
    // Update steering
    let targetSteering = 0;
    if (keys.a) targetSteering = MAX_STEERING_ANGLE;
    if (keys.d) targetSteering = -MAX_STEERING_ANGLE;
    setSteering(prev => prev + (targetSteering - prev) * delta * 5);
    
    // Apply acceleration/braking
    let acceleration = 0;
    
    if (keys.w) {
      // Accelerate forward
      const boost = keys.shift && boostAmount > 0 ? BOOST_MULTIPLIER : 1;
      if (keys.shift && boostAmount > 0) {
        updateBoost(boostAmount - delta * 20);
      }
      
      if (forwardSpeed < MAX_SPEED * boost) {
        acceleration = ACCELERATION * boost;
      }
    } else if (keys.s) {
      // Reverse/brake
      if (forwardSpeed > 0.5) {
        acceleration = -BRAKE_FORCE;
      } else if (forwardSpeed > -MAX_REVERSE_SPEED) {
        acceleration = -ACCELERATION * 0.5;
      }
    } else {
      // Natural deceleration
      if (Math.abs(forwardSpeed) > 0.1) {
        acceleration = -Math.sign(forwardSpeed) * DECELERATION;
      }
    }
    
    // Apply handbrake
    if (keys.space) {
      car.setLinvel({ 
        x: currentVel.x * 0.95, 
        y: currentVel.y, 
        z: currentVel.z * 0.95 
      }, true);
    }
    
    // Apply acceleration force
    if (Math.abs(acceleration) > 0.1) {
      const force = forward.clone().multiplyScalar(acceleration * delta * 100);
      car.applyImpulse({ x: force.x, y: 0, z: force.z }, true);
    }
    
    // Apply steering (only when moving)
    if (Math.abs(speed) > 0.5 && Math.abs(steering) > 0.01) {
      const turnAmount = steering * delta * STEERING_SPEED * Math.min(speed / 10, 1);
      const currentRotation = new THREE.Quaternion(
        currentRot.x, currentRot.y, currentRot.z, currentRot.w
      );
      const turnQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -turnAmount
      );
      currentRotation.multiply(turnQuaternion);
      car.setRotation(
        { x: currentRotation.x, y: currentRotation.y, z: currentRotation.z, w: currentRotation.w },
        true
      );
    }
    
    // Keep car upright
    const pos = car.translation();
    car.setRotation({ x: 0, y: currentRot.y, z: 0, w: currentRot.w }, true);
    
    // Update store values
    const speedKmh = Math.abs(forwardSpeed) * 3.6;
    updateSpeed(speedKmh);
    setLocalSpeed(speedKmh);
    updateCarPosition([pos.x, pos.y, pos.z]);
    updateCarRotation([0, currentRot.y, 0]);
    
    // Regenerate boost slowly
    if (!keys.shift && boostAmount < 100) {
      updateBoost(boostAmount + delta * 5);
    }
    
    // Animate wheels
    if (wheelsRef.current) {
      wheelsRef.current.children.forEach((wheel, i) => {
        // Rotate wheels based on speed
        wheel.rotation.x += speed * delta * 0.5;
        
        // Steer front wheels
        if (i < 2) {
          wheel.rotation.y = steering;
        }
      });
    }
    
    // Chassis tilt based on acceleration
    if (chassisRef.current) {
      const tiltX = Math.min(Math.max(-acceleration * 0.01, -0.1), 0.1);
      const tiltZ = Math.min(Math.max(steering * speed * 0.001, -0.1), 0.1);
      chassisRef.current.rotation.x = tiltX;
      chassisRef.current.rotation.z = tiltZ;
    }
  });
  
  return (
    <RigidBody
      ref={carRef}
      position={position}
      mass={500}
      colliders={false}
      linearDamping={0.3}
      angularDamping={0.8}
      enabledRotations={[false, true, false]}
      restitution={0.1}
      friction={0.8}
    >
      <group ref={chassisRef}>
        {/* Main chassis */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1.8, 0.6, 3.5]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
        
        {/* Car body - top */}
        <mesh castShadow position={[0, 1, -0.3]}>
          <boxGeometry args={[1.4, 0.5, 2]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>
        
        {/* Windshield */}
        <mesh position={[0, 1.1, 0.8]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.1]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Rear window */}
        <mesh position={[0, 1.1, -1.4]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[1.2, 0.3, 0.1]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Side windows */}
        <mesh position={[0.71, 1, -0.3]}>
          <boxGeometry args={[0.05, 0.4, 1.8]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[-0.71, 1, -0.3]}>
          <boxGeometry args={[0.05, 0.4, 1.8]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Spoiler */}
        <mesh castShadow position={[0, 1.3, -1.6]}>
          <boxGeometry args={[1.6, 0.1, 0.4]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
        <mesh castShadow position={[0.6, 1, -1.6]}>
          <boxGeometry args={[0.1, 0.6, 0.2]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>
        <mesh castShadow position={[-0.6, 1, -1.6]}>
          <boxGeometry args={[0.1, 0.6, 0.2]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>
        
        {/* Headlights */}
        <mesh position={[0.6, 0.5, 1.75]}>
          <boxGeometry args={[0.3, 0.2, 0.1]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.6, 0.5, 1.75]}>
          <boxGeometry args={[0.3, 0.2, 0.1]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.5} />
        </mesh>
        
        {/* Taillights */}
        <mesh position={[0.6, 0.6, -1.75]}>
          <boxGeometry args={[0.3, 0.15, 0.1]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.6, 0.6, -1.75]}>
          <boxGeometry args={[0.3, 0.15, 0.1]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
        </mesh>
        
        {/* Number on side */}
        <mesh position={[0.91, 0.6, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#ffffff">
            <canvasTexture
              attach="map"
              image={(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 64, 64);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('1', 32, 32);
                return canvas;
              })()}
            />
          </meshBasicMaterial>
        </mesh>
        <mesh position={[-0.91, 0.6, 0]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#ffffff">
            <canvasTexture
              attach="map"
              image={(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 64, 64);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('1', 32, 32);
                return canvas;
              })()}
            />
          </meshBasicMaterial>
        </mesh>
      </group>
      
      {/* Wheels */}
      <group ref={wheelsRef}>
        {/* Front Left */}
        <mesh castShadow position={[0.9, 0.3, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Front Right */}
        <mesh castShadow position={[-0.9, 0.3, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Rear Left */}
        <mesh castShadow position={[0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Rear Right */}
        <mesh castShadow position={[-0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      
      {/* Car collider */}
      <CuboidCollider args={[0.9, 0.5, 1.75]} position={[0, 0.6, 0]} />
      
      {/* Exhaust particles */}
      {localSpeed > 5 && (
        <>
          <group position={[0.4, 0.3, -1.8]}>
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.5} />
            </mesh>
          </group>
          <group position={[-0.4, 0.3, -1.8]}>
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.5} />
            </mesh>
          </group>
        </>
      )}
    </RigidBody>
  );
}
