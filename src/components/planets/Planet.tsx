import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlanetDef, PlanetLayout } from './planets.data';
import type { FlightState } from './flight';
import { damp } from './flight';
import {
  glowFragmentShader,
  glowVertexShader,
  planetFragmentShader,
  planetVertexShader,
  ringFragmentShader,
  ringVertexShader,
} from './shaders';
import type { Theme } from './useEnvironment';

/** Key light direction, shared by every planet so the system feels lit as one. */
const LIGHT_DIR = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();

/** Ring plane tipped away from face-on, so it reads as an ellipse. */
const RING_TILT = -1.15;

/** Atmosphere shell radius, as a multiple of the planet's. */
const GLOW_SCALE = 1.22;

interface PlanetProps {
  def: PlanetDef;
  layout: PlanetLayout;
  locked: boolean;
  hovered: boolean;
  theme: Theme;
  octaves: number;
  reducedMotion: boolean;
  sphere: THREE.SphereGeometry;
  flight: React.RefObject<FlightState>;
  onHover: (id: string | null) => void;
  onActivate: (id: string) => void;
  register: (id: string, object: THREE.Object3D | null) => void;
}

export function Planet({
  def,
  layout,
  locked,
  hovered,
  theme,
  octaves,
  reducedMotion,
  sphere,
  flight,
  onHover,
  onActivate,
  register,
}: PlanetProps) {
  const groupRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const surfaceMat = useRef<THREE.ShaderMaterial>(null);
  const glowMat = useRef<THREE.ShaderMaterial>(null);
  const hoverAmount = useRef(0);

  const [x, y, z] = layout.position;
  // Deterministic per-planet phase so the constellation never breathes in unison.
  const bobPhase = useMemo(() => (def.seed * 7.31) % (Math.PI * 2), [def.seed]);
  const light = theme === 'light';

  /*
   * Uniform objects are rebuilt rather than mutated when their inputs change.
   * All the inputs below are effectively static (a planet does not unlock, and
   * quality only shifts on a breakpoint), so this costs nothing — and it means
   * the very first rendered frame is already correct, which mutating from an
   * effect could not guarantee.
   */
  const surfaceUniforms = useMemo(
    () => ({
      uDeep: { value: new THREE.Color(def.colors.deep) },
      uMid: { value: new THREE.Color(def.colors.mid) },
      uHigh: { value: new THREE.Color(def.colors.high) },
      uAccent: { value: new THREE.Color(def.colors.accent) },
      uLightDir: { value: LIGHT_DIR },
      uSeed: { value: def.seed },
      uNoiseScale: { value: def.noiseScale },
      uBands: { value: def.bands },
      uLocked: { value: locked ? 1 : 0 },
      uHighlight: { value: 0 },
      // Lift the shadow side and calm the rim so planets stay legible on cream.
      uAmbient: { value: light ? 0.34 : 0.16 },
      uRim: { value: (light ? 0.45 : 1) * (locked ? 0.35 : 1) },
      uHaze: { value: new THREE.Color(light ? '#f3e3cd' : '#1b140e') },
      uHazeAmount: { value: light ? 0.55 : 0.34 },
      // Fewer octaves is a cheap, honest blur: locked planets lose their detail.
      uOctaves: { value: locked ? 2 : octaves },
    }),
    [def, locked, octaves, light],
  );

  const glowUniforms = useMemo(
    () => ({
      // Locked planets keep a hint of their own colour in the haze, otherwise
      // the halo turns into a grey glass shell around every one of them.
      uColor: { value: new THREE.Color(def.colors.accent).lerp(new THREE.Color('#8d8378'), locked ? 0.6 : 0) },
      uIntensity: { value: 0 },
      // Locked planets get a wider, softer haze; playable ones a tighter glow.
      uPower: { value: locked ? 1.5 : 2.3 },
      uInner: { value: 1 / GLOW_SCALE },
    }),
    [def, locked],
  );

  const ringUniforms = useMemo(
    () =>
      def.ring
        ? {
            // Normal-blended on cream, so it needs a darker, denser ring there.
            uColor: { value: new THREE.Color(light ? '#7c3f96' : def.ring.color) },
            uOpacity: { value: def.ring.opacity * (light ? 1.5 : 1) },
            uInner: { value: def.ring.inner },
            uOuter: { value: def.ring.outer },
            uLocked: { value: locked ? 1 : 0 },
          }
        : null,
    [def, locked, light],
  );

  const ringGeometry = useMemo(
    () => (def.ring ? new THREE.RingGeometry(def.ring.inner, def.ring.outer, 96, 1) : null),
    [def.ring],
  );
  useEffect(() => () => ringGeometry?.dispose(), [ringGeometry]);

  useEffect(() => {
    register(def.id, groupRef.current);
    return () => register(def.id, null);
  }, [def.id, register]);

  useFrame((state, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    // Tab-out can hand us a huge delta; clamp so nothing snaps on return.
    const delta = Math.min(rawDelta, 0.05);

    hoverAmount.current = damp(hoverAmount.current, hovered ? 1 : 0, 9, delta);
    const h = hoverAmount.current;
    // Only playable planets step forward. A locked one answers with its label
    // and a faint stir in the haze, so the two states never feel alike.
    const lift = locked ? 0 : h;

    if (!reducedMotion) {
      if (surfaceRef.current) surfaceRef.current.rotation.y += def.spin * delta;
      const bob = Math.sin(state.clock.elapsedTime * 0.32 + bobPhase) * layout.radius * 0.06;
      group.position.set(x, y + bob, z + lift * layout.radius * 0.28);
    } else {
      group.position.set(x, y, z + lift * layout.radius * 0.28);
    }

    group.scale.setScalar(1 + lift * 0.06);

    if (surfaceMat.current) surfaceMat.current.uniforms.uHighlight.value = h;

    if (glowMat.current) {
      const base = locked ? 0.2 : 0.62;
      const themeScale = light ? 0.55 : 1;
      // The planet we are diving into blooms as it swallows the frame.
      const arriving = flight.current.id === def.id ? flight.current.t : 0;
      const bump = h * (locked ? 0.18 : 0.55);
      glowMat.current.uniforms.uIntensity.value = (base + bump + arriving * 0.9) * themeScale;
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return;
    e.stopPropagation();
    onHover(def.id);
  };

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return;
    onHover(null);
  };

  return (
    <group ref={groupRef} position={[x, y, z]} rotation={[0, 0, def.tilt]}>
      <mesh
        ref={surfaceRef}
        geometry={sphere}
        scale={layout.radius}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={(e) => {
          e.stopPropagation();
          onActivate(def.id);
        }}
      >
        <shaderMaterial
          ref={surfaceMat}
          vertexShader={planetVertexShader}
          fragmentShader={planetFragmentShader}
          uniforms={surfaceUniforms}
        />
      </mesh>

      <mesh geometry={sphere} scale={layout.radius * GLOW_SCALE} raycast={() => null}>
        <shaderMaterial
          ref={glowMat}
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          uniforms={glowUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {ringGeometry && ringUniforms && (
        <mesh
          geometry={ringGeometry}
          scale={layout.radius}
          rotation={[RING_TILT, 0, 0]}
          raycast={() => null}
        >
          <shaderMaterial
            vertexShader={ringVertexShader}
            fragmentShader={ringFragmentShader}
            uniforms={ringUniforms}
            side={THREE.DoubleSide}
            transparent
            depthWrite={false}
            blending={theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending}
          />
        </mesh>
      )}
    </group>
  );
}
