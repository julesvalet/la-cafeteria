import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { Planet } from './Planet';
import { LabelProjector, PlanetLabels, type ElementMap, type ObjectMap } from './PlanetLabels';
import { Starfield } from './Starfield';
import { CAMERA_FOV, computeLayout, PLANETS } from './planets.data';
import type { FlightState } from './flight';
import {
  useAspect,
  useCoarsePointer,
  useDocumentTheme,
  usePrefersReducedMotion,
  useQuality,
} from './useEnvironment';

interface PlanetHubProps {
  onContextLost: () => void;
}

export function PlanetHub({ onContextLost }: PlanetHubProps) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  const aspect = useAspect(wrapRef);
  const theme = useDocumentTheme();
  const quality = useQuality();
  const reducedMotion = usePrefersReducedMotion();
  const coarsePointer = useCoarsePointer();

  const layout = useMemo(() => computeLayout(aspect), [aspect]);
  const layoutById = useMemo(() => new Map(layout.planets.map((p) => [p.id, p])), [layout]);

  const pointer = useRef({ x: 0, y: 0 });
  const flight = useRef<FlightState>({ id: null, t: 0 });
  const objects = useRef<ObjectMap>(new Map());
  const labels = useRef<ElementMap>(new Map());
  const hintTimer = useRef<number | undefined>(undefined);

  const [hovered, setHovered] = useState<string | null>(null);
  const [departing, setDeparting] = useState<{ id: string; to: string } | null>(null);
  const [flash, setFlash] = useState(false);

  const sphere = useMemo(
    () => new THREE.SphereGeometry(1, quality.segments, Math.round(quality.segments * 0.66)),
    [quality.segments],
  );
  useEffect(() => () => sphere.dispose(), [sphere]);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  // Pointer parallax. Kept out of React state — this runs on every mouse move.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let rect = el.getBoundingClientRect();
    const refresh = () => {
      rect = el.getBoundingClientRect();
    };
    const onMove = (e: PointerEvent) => {
      if (rect.width === 0 || rect.height === 0) return;
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((((e.clientY - rect.top) / rect.height) * 2) - 1);
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh);
    };
  }, []);

  const handleHover = useCallback((id: string | null) => {
    if (flight.current.id) return;
    setHovered(id);
  }, []);

  const handleActivate = useCallback(
    (id: string) => {
      if (flight.current.id) return;
      const def = PLANETS.find((p) => p.id === id);
      if (!def) return;

      if (!def.to) {
        // Coming soon. On touch there is no hover, so a tap is the only way to
        // ever see the hint — show it, then let it fade on its own.
        setHovered(id);
        window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(
          () => setHovered((current) => (current === id ? null : current)),
          2200,
        );
        return;
      }

      setDeparting({ id, to: def.to });
      if (reducedMotion) {
        // No dive; cross-fade straight out instead.
        setFlash(true);
        return;
      }
      flight.current = { id, t: 0 };
    },
    [reducedMotion],
  );

  const register = useCallback((id: string, object: THREE.Object3D | null) => {
    objects.current.set(id, object);
  }, []);

  const targetOf = useCallback((id: string) => objects.current.get(id) ?? undefined, []);
  const radiusOf = useCallback((id: string) => layoutById.get(id)?.radius ?? 1, [layoutById]);

  const hoveredDef = hovered ? PLANETS.find((p) => p.id === hovered) : undefined;
  const pointing = Boolean(hoveredDef?.to) && !departing;

  return (
    <div
      ref={wrapRef}
      className={`planet-hub${pointing ? ' is-pointing' : ''}${departing ? ' is-departing' : ''}`}
      data-theme-scene={theme}
    >
      <div className="planet-hub-sky" aria-hidden="true" />

      <Canvas
        flat
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: CAMERA_FOV, near: 0.01, far: 600, position: [0, 0, layout.cameraZ] }}
        onPointerMissed={() => handleHover(null)}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', onContextLost, { once: true });
        }}
      >
        <Starfield count={quality.starCount} theme={theme} reducedMotion={reducedMotion} />

        {PLANETS.map((def) => {
          const slot = layoutById.get(def.id);
          if (!slot) return null;
          return (
            <Planet
              key={def.id}
              def={def}
              layout={slot}
              locked={!def.to}
              hovered={hovered === def.id}
              theme={theme}
              octaves={quality.octaves}
              reducedMotion={reducedMotion}
              sphere={sphere}
              flight={flight}
              onHover={handleHover}
              onActivate={handleActivate}
              register={register}
            />
          );
        })}

        <CameraRig
          cameraZ={layout.cameraZ}
          pointer={pointer}
          flight={flight}
          targetOf={targetOf}
          radiusOf={radiusOf}
          reducedMotion={reducedMotion}
          onFlash={() => setFlash(true)}
          onArrive={() => undefined}
        />

        <LabelProjector labels={labels} objects={objects} radiusOf={radiusOf} flight={flight} />
      </Canvas>

      <PlanetLabels
        planets={PLANETS}
        hovered={hovered}
        labels={labels}
        onHover={handleHover}
        onActivate={handleActivate}
        disabled={Boolean(departing)}
      />

      <div className={`planet-hud${departing ? ' is-hidden' : ''}`}>
        <p className="planet-hud-eyebrow">Bienvenue à</p>
        <h1>La Cafétéria</h1>
        <p className="planet-hud-tagline">
          Le hub de mini-applications et de jeux entre potes. Un seul endroit, plusieurs façons de traîner
          ensemble.
        </p>
      </div>

      <p className={`planet-hint${departing ? ' is-hidden' : ''}`}>
        {coarsePointer ? 'Touche une planète pour entrer' : 'Choisis une planète pour entrer'}
      </p>

      <AnimatePresence>
        {flash && departing && (
          <motion.div
            className="planet-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0.25 : 0.38, ease: 'easeIn' }}
            onAnimationComplete={() => navigate(departing.to)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
