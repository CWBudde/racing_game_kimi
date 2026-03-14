import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TRACK_SOURCES } from "../src/components/trackSourceData.js";

const TRACK_SEGMENTS = 200;

function orientation(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  const epsilon = 1e-6;
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (
    Math.abs(o1) < epsilon ||
    Math.abs(o2) < epsilon ||
    Math.abs(o3) < epsilon ||
    Math.abs(o4) < epsilon
  ) {
    return false;
  }

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function sampleTrackPoints(controlPoints) {
  const curve = new THREE.CatmullRomCurve3(
    controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    "centripetal",
  );

  return curve.getSpacedPoints(TRACK_SEGMENTS).slice(0, -1);
}

test("track centerlines do not self-intersect", () => {
  for (const track of TRACK_SOURCES) {
    const points = sampleTrackPoints(track.controlPoints);

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];

      for (let j = i + 2; j < points.length; j++) {
        if ((j + 1) % points.length === i) continue;

        const c = points[j];
        const d = points[(j + 1) % points.length];

        assert.equal(
          segmentsIntersect(a, b, c, d),
          false,
          `${track.id} self-intersects between sampled segments ${i}-${i + 1} and ${j}-${(j + 1) % points.length}`,
        );
      }
    }
  }
});
