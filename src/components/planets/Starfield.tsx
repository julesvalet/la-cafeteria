import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { starFragmentShader, starVertexShader } from './shaders';
import type { Theme } from './useEnvironment';

interface StarfieldProps {
  count: number;
  theme: Theme;
  reducedMotion: boolean;
}

/**
 * One draw call of camera-facing points on a spherical shell. Deliberately not
 * a texture: `gl_PointCoord` gives us a soft disc for free.
 */
export function Starfield({ count, theme, reducedMotion }: StarfieldProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Evenly distributed directions, pushed out well behind the planets.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const distance = 60 + Math.random() * 90;

      positions[i * 3] = Math.cos(theta) * r * distance;
      positions[i * 3 + 1] = u * distance;
      positions[i * 3 + 2] = Math.sin(theta) * r * distance;

      // Mostly dust, a few bright ones.
      sizes[i] = Math.random() < 0.08 ? 2.4 + Math.random() * 1.8 : 0.7 + Math.random() * 1.1;
      phases[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uTwinkle: { value: reducedMotion ? 0 : 0.3 },
      // On cream, additive white is invisible — switch to dark warm motes.
      uColor: { value: new THREE.Color(theme === 'light' ? '#8a6a48' : '#fff4e2') },
      uOpacity: { value: theme === 'light' ? 0.32 : 0.85 },
    }),
    [dpr, theme, reducedMotion],
  );

  useFrame((state) => {
    if (reducedMotion || !materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} raycast={() => null} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        key={theme}
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}
