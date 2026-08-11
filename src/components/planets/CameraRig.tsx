import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp01, damp, easeAim, easeDive, FLASH_AT, FLIGHT_DURATION, type FlightState } from './flight';

/**
 * Where the dive stops, as a multiple of the planet radius. Must stay above 1:
 * the surface is front-faced, so a camera inside the sphere sees nothing at all.
 * At 1.08 the planet subtends ~68°, which covers the screen corners at every
 * aspect ratio we can realistically get.
 */
const ARRIVAL_DISTANCE = 1.08;

interface CameraRigProps {
  cameraZ: number;
  /** Normalised pointer position, -1..1 on both axes. Written outside React. */
  pointer: React.RefObject<{ x: number; y: number }>;
  flight: React.RefObject<FlightState>;
  /** Object3D of the planet being dived into, resolved when the flight starts. */
  targetOf: (id: string) => THREE.Object3D | undefined;
  radiusOf: (id: string) => number;
  reducedMotion: boolean;
  onFlash: () => void;
  onArrive: () => void;
}

export function CameraRig({
  cameraZ,
  pointer,
  flight,
  targetOf,
  radiusOf,
  reducedMotion,
  onFlash,
  onArrive,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);

  const startedAt = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startAim = useRef(new THREE.Vector3());
  const startDistance = useRef(1);
  const activeId = useRef<string | null>(null);
  const flashed = useRef(false);
  const arrived = useRef(false);

  const aim = useRef(new THREE.Vector3(0, 0, 0));
  const planetPos = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

  // Start further out and let the idle damping glide us in — a free arrival
  // shot. Only on first mount: a resize must not re-trigger it.
  const introDone = useRef(false);
  useEffect(() => {
    if (introDone.current) return;
    introDone.current = true;
    camera.position.set(0, 0, reducedMotion ? cameraZ : cameraZ * 1.8);
    camera.lookAt(0, 0, 0);
  }, [camera, cameraZ, reducedMotion]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const diving = flight.current.id;

    if (!diving) {
      activeId.current = null;

      // Idle: a slow parallax lean towards the pointer. Enough to feel like a
      // space, not enough to fight the user for control.
      const px = reducedMotion ? 0 : pointer.current.x;
      const py = reducedMotion ? 0 : pointer.current.y;
      const lambda = 2.6;
      camera.position.x = damp(camera.position.x, px * cameraZ * 0.075, lambda, delta);
      camera.position.y = damp(camera.position.y, py * cameraZ * 0.05, lambda, delta);
      camera.position.z = damp(camera.position.z, cameraZ, lambda, delta);

      aim.current.x = damp(aim.current.x, px * -0.5, lambda, delta);
      aim.current.y = damp(aim.current.y, py * -0.35, lambda, delta);
      aim.current.z = damp(aim.current.z, 0, lambda, delta);
      camera.lookAt(aim.current);
      return;
    }

    const target = targetOf(diving);
    if (!target) return;

    target.getWorldPosition(planetPos.current);

    if (activeId.current !== diving) {
      // First frame of this dive: freeze the departure point.
      activeId.current = diving;
      startedAt.current = state.clock.elapsedTime;
      startPos.current.copy(camera.position);
      startAim.current.copy(aim.current);
      startDistance.current = Math.max(startPos.current.distanceTo(planetPos.current), 0.001);
      flashed.current = false;
      arrived.current = false;
    }

    const elapsed = (state.clock.elapsedTime - startedAt.current) * 1000;
    const raw = clamp01(elapsed / FLIGHT_DURATION);
    flight.current.t = raw;

    // Straight-line dive: the camera never orbits, it just falls in.
    dir.current.subVectors(startPos.current, planetPos.current).normalize();

    const endDistance = Math.max(radiusOf(diving) * ARRIVAL_DISTANCE, 0.05);
    const ratio = endDistance / startDistance.current;
    const distance = startDistance.current * Math.pow(ratio, easeDive(raw));

    camera.position.copy(planetPos.current).addScaledVector(dir.current, distance);

    aim.current.lerpVectors(startAim.current, planetPos.current, easeAim(raw));
    camera.lookAt(aim.current);

    if (!flashed.current && raw >= FLASH_AT) {
      flashed.current = true;
      onFlash();
    }
    if (!arrived.current && raw >= 1) {
      arrived.current = true;
      onArrive();
    }
  });

  return null;
}
