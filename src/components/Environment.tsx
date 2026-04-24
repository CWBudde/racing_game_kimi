import { useCallback, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { getTrackLayout } from "./trackData";
import { ITEM_POOLS, type ItemType, useGameStore } from "../store/gameStore";

function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <mesh castShadow position={[0, 1.5 * scale, 0]}>
        <cylinderGeometry args={[0.3 * scale, 0.4 * scale, 3 * scale, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <CuboidCollider
        args={[0.3 * scale, 1.5 * scale, 0.3 * scale]}
        position={[0, 1.5 * scale, 0]}
      />
      <mesh castShadow position={[0, 3.5 * scale, 0]}>
        <coneGeometry args={[2 * scale, 2.5 * scale, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      <mesh castShadow position={[0, 4.8 * scale, 0]}>
        <coneGeometry args={[1.5 * scale, 2 * scale, 8]} />
        <meshStandardMaterial color="#32CD32" />
      </mesh>
      <mesh castShadow position={[0, 5.8 * scale, 0]}>
        <coneGeometry args={[0.8 * scale, 1.5 * scale, 8]} />
        <meshStandardMaterial color="#90EE90" />
      </mesh>
    </RigidBody>
  );
}

function Rock({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <mesh castShadow>
        <dodecahedronGeometry args={[scale, 0]} />
        <meshStandardMaterial color="#808080" roughness={0.9} />
      </mesh>
      <CuboidCollider args={[scale * 0.8, scale * 0.6, scale * 0.8]} />
    </RigidBody>
  );
}

function Cloud({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const cloudRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!cloudRef.current) return;
    cloudRef.current.position.x +=
      Math.sin(clock.getElapsedTime() * 0.1 + position[0]) * 0.01;
  });

  return (
    <group ref={cloudRef} position={position}>
      <mesh>
        <sphereGeometry args={[2 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[1.5 * scale, 0.3 * scale, 0]}>
        <sphereGeometry args={[1.5 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-1.5 * scale, 0.2 * scale, 0]}>
        <sphereGeometry args={[1.3 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.8 * scale, 0.5 * scale]}>
        <sphereGeometry args={[1.2 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function NeonTower({
  position,
  width,
  height,
  depth,
  accent,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  accent: string;
}) {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color="#09111f"
          emissive={accent}
          emissiveIntensity={0.24}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, height - 2.6, depth / 2 + 0.06]}>
        <planeGeometry args={[width * 0.7, 2.2]} />
        <meshStandardMaterial
          color="#c5f6ff"
          emissive={accent}
          emissiveIntensity={1.1}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh position={[0, height / 2, depth / 2 + 0.04]}>
        <planeGeometry args={[width * 0.58, height * 0.58]} />
        <meshStandardMaterial
          color="#7ff6ff"
          emissive={accent}
          emissiveIntensity={0.75}
          transparent
          opacity={0.22}
        />
      </mesh>
      <mesh position={[0, height + 1.2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 2.4, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={accent}
          emissiveIntensity={1.6}
        />
      </mesh>
    </RigidBody>
  );
}

function HoloBillboard({
  position,
  rotation,
  label,
  accent,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  label: string;
  accent: string;
}) {
  const signTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createLinearGradient(0, 0, 256, 128);
    gradient.addColorStop(0, "rgba(4, 8, 18, 0.95)");
    gradient.addColorStop(1, "rgba(16, 24, 48, 0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 128);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 236, 108);

    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 128, 66);

    return new THREE.CanvasTexture(canvas);
  }, [accent, label]);

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial
          map={signTexture}
          emissive={accent}
          emissiveIntensity={0.85}
          transparent
          opacity={0.94}
        />
      </mesh>
      <mesh position={[0, -4.5, 0]}>
        <boxGeometry args={[0.35, 9, 0.35]} />
        <meshStandardMaterial
          color="#0d1325"
          emissive={accent}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

function Drone({
  orbitRadius,
  height,
  speed,
  offset,
  accent,
}: {
  orbitRadius: number;
  height: number;
  speed: number;
  offset: number;
  accent: string;
}) {
  const droneRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!droneRef.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    droneRef.current.position.set(
      Math.cos(t) * orbitRadius,
      height + Math.sin(t * 2.4) * 2,
      Math.sin(t) * orbitRadius,
    );
    droneRef.current.rotation.y = -t;
  });

  return (
    <group ref={droneRef}>
      <mesh>
        <sphereGeometry args={[0.85, 16, 16]} />
        <meshStandardMaterial
          color="#ebfbff"
          emissive={accent}
          emissiveIntensity={1.2}
          metalness={0.5}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.16, 8, 32]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.4}
          transparent
          opacity={0.78}
        />
      </mesh>
    </group>
  );
}

const RESPAWN_TIME = 5;

function seededRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function tooCloseToTrack(
  trackPoints: THREE.Vector3[],
  x: number,
  z: number,
  clearance: number,
): boolean {
  const c2 = clearance * clearance;
  for (const pt of trackPoints) {
    const dx = pt.x - x;
    const dz = pt.z - z;
    if (dx * dx + dz * dz < c2) return true;
  }
  return false;
}

function ItemBox({
  position,
  accent,
  itemPool,
  neon,
}: {
  position: [number, number, number];
  accent: string;
  itemPool: ItemType[];
  neon: boolean;
}) {
  const boxRef = useRef<THREE.Group>(null);
  const [collected, setCollected] = useState(false);
  const respawnTimerRef = useRef(0);
  const collectItem = useGameStore((state) => state.collectItem);
  const hasItem = useGameStore((state) => state.hasItem);

  const handleIntersection = useCallback(() => {
    if (collected || hasItem) return;
    const item = itemPool[Math.floor(Math.random() * itemPool.length)];
    collectItem(item);
    setCollected(true);
    respawnTimerRef.current = RESPAWN_TIME;
  }, [collected, collectItem, hasItem, itemPool]);

  useFrame(({ clock }, delta) => {
    if (collected) {
      respawnTimerRef.current -= delta;
      if (respawnTimerRef.current <= 0) {
        setCollected(false);
      }
      return;
    }

    if (!boxRef.current) return;
    boxRef.current.rotation.y = clock.getElapsedTime() * 1.8;
    boxRef.current.position.y = Math.sin(clock.getElapsedTime() * 2.6) * 0.35;
  });

  if (collected) return null;

  return (
    <RigidBody
      type="fixed"
      position={position}
      sensor
      colliders={false}
      onIntersectionEnter={handleIntersection}
    >
      <group ref={boxRef}>
        <mesh castShadow>
          <boxGeometry args={[1.55, 1.55, 1.55]} />
          <meshStandardMaterial
            color={neon ? "#0d1730" : "#ffdd00"}
            emissive={accent}
            emissiveIntensity={neon ? 0.95 : 0.3}
            metalness={neon ? 0.6 : 0.1}
          />
        </mesh>
        {neon ? (
          <mesh scale={1.22}>
            <boxGeometry args={[1.55, 1.55, 1.55]} />
            <meshStandardMaterial
              color="#8efbff"
              emissive={accent}
              emissiveIntensity={1.15}
              transparent
              opacity={0.15}
            />
          </mesh>
        ) : (
          <mesh position={[0, 0, 0.79]}>
            <planeGeometry args={[0.8, 0.8]} />
            <meshBasicMaterial color="#000000">
              <canvasTexture
                attach="map"
                image={(() => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 64;
                  canvas.height = 64;
                  const ctx = canvas.getContext("2d")!;
                  ctx.fillStyle = "#ffdd00";
                  ctx.fillRect(0, 0, 64, 64);
                  ctx.fillStyle = "#000000";
                  ctx.font = "bold 45px Arial";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText("?", 32, 32);
                  return canvas;
                })()}
              />
            </meshBasicMaterial>
          </mesh>
        )}
      </group>
      <CuboidCollider args={[0.9, 0.9, 0.9]} sensor />
    </RigidBody>
  );
}

interface EnvironmentProps {
  trackId: string;
}

export function Environment({ trackId }: EnvironmentProps) {
  const layout = getTrackLayout(trackId);
  const trackPoints = layout.points;
  const { left, right } = layout.sides;
  const isNeon = layout.definition.theme === "neon";
  const isDesert = layout.definition.theme === "desert";
  const itemPool = ITEM_POOLS[trackId] ?? ITEM_POOLS["coastal-gp"];
  const trackClearance = layout.width * 0.5 + 16;

  const towers = useMemo(() => {
    const positions: {
      position: [number, number, number];
      width: number;
      height: number;
      depth: number;
      accent: string;
    }[] = [];
    const rings = [
      { radius: 190, count: 14 },
      { radius: 270, count: 18 },
      { radius: 360, count: 24 },
    ];

    rings.forEach((ring, ringIndex) => {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + ringIndex * 0.11;
        const height = 24 + ((i + ringIndex * 3) % 7) * 8 + ringIndex * 10;
        positions.push({
          position: [
            Math.cos(angle) * ring.radius,
            0,
            Math.sin(angle) * ring.radius,
          ],
          width: 10 + ((i + ringIndex) % 3) * 3,
          depth: 10 + ((i + ringIndex * 2) % 4) * 2,
          height,
          accent: (i + ringIndex) % 2 === 0 ? "#00e9ff" : "#ff46d5",
        });
      }
    });

    return positions;
  }, []);

  const pylonPairs = useMemo(() => {
    const pylons: {
      leftPos: [number, number, number];
      rightPos: [number, number, number];
      accent: string;
    }[] = [];

    for (let i = 0; i < trackPoints.length; i += 18) {
      const next = trackPoints[(i + 1) % trackPoints.length];
      const point = trackPoints[i];
      const leftPos = left[i].clone();
      const rightPos = right[i].clone();
      const tangent = new THREE.Vector3(next.x - point.x, 0, next.z - point.z).normalize();
      const offset = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(6.5);

      pylons.push({
        leftPos: [leftPos.x + offset.x, 4, leftPos.z + offset.z],
        rightPos: [rightPos.x - offset.x, 4, rightPos.z - offset.z],
        accent: Math.floor(i / 18) % 2 === 0 ? "#00e9ff" : "#ff46d5",
      });
    }

    return pylons;
  }, [left, right, trackPoints]);

  const billboards = useMemo(
    () => [
      {
        position: [-150, 18, 112] as [number, number, number],
        rotation: [0, 0.4, 0] as [number, number, number],
        label: "GRID",
        accent: "#00e9ff",
      },
      {
        position: [162, 22, 52] as [number, number, number],
        rotation: [0, -1.05, 0] as [number, number, number],
        label: "BOOST",
        accent: "#ff46d5",
      },
      {
        position: [100, 20, -150] as [number, number, number],
        rotation: [0, -0.45, 0] as [number, number, number],
        label: "SYNC",
        accent: "#8d7dff",
      },
      {
        position: [-122, 16, -152] as [number, number, number],
        rotation: [0, 0.75, 0] as [number, number, number],
        label: "VOID",
        accent: "#00e9ff",
      },
    ],
    [],
  );

  const itemBoxes = useMemo(() => {
    const positions: { position: [number, number, number]; accent: string }[] = [];
    const n = trackPoints.length;
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor((i / 8) * n + n / 20) % n;
      const point = trackPoints[idx];
      positions.push({
        position: [point.x, 2.2, point.z],
        accent: i % 2 === 0 ? "#00e9ff" : "#ff46d5",
      });
    }
    return positions;
  }, [trackPoints]);

  const trees = useMemo(() => {
    const positions: { position: [number, number, number]; scale: number }[] = [];
    if (isNeon || isDesert) return positions;

    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 + seededRandom(i + 11) * 0.4;
      const radius = 80 + seededRandom(i + 37) * 60;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (tooCloseToTrack(trackPoints, x, z, trackClearance)) continue;
      positions.push({
        position: [x, 0, z],
        scale: 0.8 + seededRandom(i + 71) * 0.6,
      });
    }

    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2 + seededRandom(i + 109) * 0.6;
      const radius = 160 + seededRandom(i + 149) * 200;
      positions.push({
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        scale: 1 + seededRandom(i + 181),
      });
    }

    return positions;
  }, [isDesert, isNeon, trackClearance, trackPoints]);

  const rocks = useMemo(() => {
    const positions: { position: [number, number, number]; scale: number }[] = [];
    if (isNeon) return positions;

    const rockCount = isDesert ? 90 : 50;
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2 + seededRandom(i + 223) * 0.8;
      const radius = isDesert
        ? 90 + seededRandom(i + 269) * 260
        : 70 + seededRandom(i + 307) * 180;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (tooCloseToTrack(trackPoints, x, z, trackClearance)) continue;
      positions.push({
        position: [x, 0.5, z],
        scale: isDesert
          ? 0.7 + seededRandom(i + 349) * 1.8
          : 0.5 + seededRandom(i + 389) * 1.2,
      });
    }

    return positions;
  }, [isDesert, isNeon, trackClearance, trackPoints]);

  const clouds = useMemo(() => {
    const positions: { position: [number, number, number]; scale: number }[] = [];
    if (isNeon) return positions;

    for (let i = 0; i < 16; i++) {
      positions.push({
        position: [
          (seededRandom(i + 431) - 0.5) * 800,
          40 + seededRandom(i + 467) * 40,
          (seededRandom(i + 503) - 0.5) * 800,
        ],
        scale: 1 + seededRandom(i + 541) * 2,
      });
    }

    return positions;
  }, [isNeon]);

  return (
    <group>
      {!isNeon &&
        trees.map((tree, i) => (
          <Tree key={`tree-${i}`} position={tree.position} scale={tree.scale} />
        ))}

      {!isNeon &&
        rocks.map((rock, i) => (
          <Rock key={`rock-${i}`} position={rock.position} scale={rock.scale} />
        ))}

      {!isNeon &&
        clouds.map((cloud, i) => (
          <Cloud
            key={`cloud-${i}`}
            position={cloud.position}
            scale={cloud.scale}
          />
        ))}

      {isNeon &&
        towers.map((tower, i) => (
          <NeonTower
            key={`tower-${i}`}
            position={tower.position}
            width={tower.width}
            height={tower.height}
            depth={tower.depth}
            accent={tower.accent}
          />
        ))}

      {isNeon &&
        billboards.map((billboard, i) => (
          <HoloBillboard
            key={`billboard-${i}`}
            position={billboard.position}
            rotation={billboard.rotation}
            label={billboard.label}
            accent={billboard.accent}
          />
        ))}

      {isNeon &&
        pylonPairs.map((pair, i) => (
          <group key={`pylon-pair-${i}`}>
            <mesh position={pair.leftPos}>
              <boxGeometry args={[1.2, 8, 1.2]} />
              <meshStandardMaterial
                color="#0e1528"
                emissive={pair.accent}
                emissiveIntensity={0.65}
                metalness={0.75}
              />
            </mesh>
            <mesh position={[pair.leftPos[0], 7.8, pair.leftPos[2]]}>
              <boxGeometry args={[0.4, 3.5, 0.4]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={pair.accent}
                emissiveIntensity={1.4}
              />
            </mesh>

            <mesh position={pair.rightPos}>
              <boxGeometry args={[1.2, 8, 1.2]} />
              <meshStandardMaterial
                color="#0e1528"
                emissive={pair.accent}
                emissiveIntensity={0.65}
                metalness={0.75}
              />
            </mesh>
            <mesh position={[pair.rightPos[0], 7.8, pair.rightPos[2]]}>
              <boxGeometry args={[0.4, 3.5, 0.4]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={pair.accent}
                emissiveIntensity={1.4}
              />
            </mesh>
          </group>
        ))}

      {itemBoxes.map((item, i) => (
        <ItemBox
          key={`item-${i}`}
          position={item.position}
          accent={item.accent}
          itemPool={itemPool}
          neon={isNeon}
        />
      ))}

      {isNeon &&
        [...Array(8)].map((_, i) => (
          <Drone
            key={`drone-${i}`}
            orbitRadius={180 + i * 18}
            height={36 + (i % 3) * 8}
            speed={0.12 + i * 0.015}
            offset={i * 0.8}
            accent={i % 2 === 0 ? "#00e9ff" : "#ff46d5"}
          />
        ))}

      {isNeon ? (
        <>
          <mesh position={[0, 180, -320]}>
            <sphereGeometry args={[34, 32, 32]} />
            <meshBasicMaterial color="#7e63ff" />
          </mesh>

          <mesh position={[0, 180, -320]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[48, 1.4, 10, 64]} />
            <meshStandardMaterial
              color="#00e9ff"
              emissive="#00e9ff"
              emissiveIntensity={1.2}
              transparent
              opacity={0.5}
            />
          </mesh>

          <spotLight
            position={[120, 180, 40]}
            angle={0.5}
            penumbra={0.7}
            intensity={140}
            color="#00dfff"
            castShadow
            distance={420}
          />
          <spotLight
            position={[-150, 160, -80]}
            angle={0.45}
            penumbra={0.8}
            intensity={120}
            color="#ff46d5"
            distance={420}
          />
          <directionalLight
            position={[80, 110, -20]}
            intensity={0.45}
            color="#8eb7ff"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={700}
            shadow-camera-left={-280}
            shadow-camera-right={280}
            shadow-camera-top={280}
            shadow-camera-bottom={-280}
          />
          <ambientLight intensity={0.32} color="#5d79ff" />
          <hemisphereLight args={["#12254f", "#05070d", 0.55]} />
        </>
      ) : (
        <>
          <mesh position={[200, 120, -200]}>
            <sphereGeometry args={[20, 32, 32]} />
            <meshBasicMaterial color={isDesert ? "#ffd27a" : "#ffdd44"} />
          </mesh>
          <directionalLight
            position={[200, 120, -200]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={700}
            shadow-camera-left={-280}
            shadow-camera-right={280}
            shadow-camera-top={280}
            shadow-camera-bottom={-280}
          />
          <ambientLight intensity={0.4} />
          <hemisphereLight
            args={[
              isDesert ? "#f4c98c" : "#87CEEB",
              isDesert ? "#9b6741" : "#4a7c59",
              0.5,
            ]}
          />
        </>
      )}
    </group>
  );
}
