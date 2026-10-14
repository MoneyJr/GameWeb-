import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { N8AOPass } from 'n8ao'
import { getGradientMap } from './primitives'

function applyToonGradient(scene: THREE.Scene) {
  const ramp = getGradientMap()
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (material instanceof THREE.MeshToonMaterial && material.gradientMap !== ramp) {
        material.gradientMap = ramp
        material.needsUpdate = true
      }
    })
  })
}

/** Apply the shared three-band toon ramp to cached and inline materials. */
export function ToonShadingSetup() {
  const { scene } = useThree()
  useEffect(() => applyToonGradient(scene), [scene])
  return null
}

const SOBEL_INK_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    inverseProjection: { value: new THREE.Matrix4() },
    inkColor: { value: new THREE.Color(0.17, 0.12, 0.09) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform mat4 inverseProjection;
    uniform vec3 inkColor;
    varying vec2 vUv;

    vec3 viewPosition(vec2 uv) {
      float depth = texture2D(tDepth, uv).x;
      vec4 view = inverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      return view.xyz / max(abs(view.w), 0.00001);
    }

    float linearDepth(vec2 uv) {
      return -viewPosition(uv).z;
    }

    vec3 reconstructedNormal(vec2 uv, vec2 pixel) {
      vec3 left = viewPosition(uv - vec2(pixel.x, 0.0));
      vec3 right = viewPosition(uv + vec2(pixel.x, 0.0));
      vec3 down = viewPosition(uv - vec2(0.0, pixel.y));
      vec3 up = viewPosition(uv + vec2(0.0, pixel.y));
      return normalize(cross(right - left, up - down));
    }

    float luminance(vec2 uv) {
      vec3 color = texture2D(tDiffuse, uv).rgb;
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 pixel = 1.5 / resolution;
      vec2 dx = vec2(pixel.x, 0.0);
      vec2 dy = vec2(0.0, pixel.y);

      float d00 = linearDepth(vUv - dx - dy);
      float d10 = linearDepth(vUv - dy);
      float d20 = linearDepth(vUv + dx - dy);
      float d01 = linearDepth(vUv - dx);
      float d21 = linearDepth(vUv + dx);
      float d02 = linearDepth(vUv - dx + dy);
      float d12 = linearDepth(vUv + dy);
      float d22 = linearDepth(vUv + dx + dy);
      float depthX = abs((d20 + 2.0 * d21 + d22) - (d00 + 2.0 * d01 + d02));
      float depthY = abs((d02 + 2.0 * d12 + d22) - (d00 + 2.0 * d10 + d20));
      float depthEdge = max(depthX, depthY) / max(linearDepth(vUv), 1.0);

      float l00 = luminance(vUv - dx - dy);
      float l10 = luminance(vUv - dy);
      float l20 = luminance(vUv + dx - dy);
      float l01 = luminance(vUv - dx);
      float l21 = luminance(vUv + dx);
      float l02 = luminance(vUv - dx + dy);
      float l12 = luminance(vUv + dy);
      float l22 = luminance(vUv + dx + dy);
      float colorX = abs((l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02));
      float colorY = abs((l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20));
      float colorEdge = length(vec2(colorX, colorY));

      vec3 normalCenter = reconstructedNormal(vUv, pixel);
      vec3 normalRight = reconstructedNormal(vUv + dx, pixel);
      vec3 normalUp = reconstructedNormal(vUv + dy, pixel);
      float normalEdge = max(1.0 - dot(normalCenter, normalRight), 1.0 - dot(normalCenter, normalUp));

      float edge = max(
        max(smoothstep(0.008, 0.055, depthEdge), smoothstep(0.12, 0.42, normalEdge)),
        smoothstep(0.16, 0.52, colorEdge)
      );
      vec4 base = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(mix(base.rgb, inkColor, edge * 0.9), base.a);
    }
  `,
}

/** N8AO contact shadows followed by a depth/normal/color Sobel ink pass. */
export function InkOutlinePassEffect() {
  const { gl, scene, camera, size } = useThree()
  const frameCount = useMemo(() => ({ value: 0 }), [])
  const { composer, aoPass, inkPass, outputPass } = useMemo(() => {
    const nextComposer = new EffectComposer(gl)
    const nextAo = new N8AOPass(scene, camera, size.width, size.height)
    nextAo.configuration.aoRadius = 1.5
    nextAo.configuration.distanceFalloff = 1.0
    nextAo.configuration.intensity = 2.0
    nextAo.configuration.gammaCorrection = false

    const nextInk = new ShaderPass(SOBEL_INK_SHADER)
    nextInk.uniforms.tDepth.value = nextAo.beautyRenderTarget.depthTexture
    nextInk.uniforms.inkColor.value.setRGB(0.17, 0.12, 0.09)
    const nextOutput = new OutputPass()
    nextComposer.addPass(nextAo)
    nextComposer.addPass(nextInk)
    nextComposer.addPass(nextOutput)
    return { composer: nextComposer, aoPass: nextAo, inkPass: nextInk, outputPass: nextOutput }
  }, [camera, gl, scene, size.height, size.width])

  useEffect(() => {
    composer.setSize(size.width, size.height)
    const pixelRatio = gl.getPixelRatio()
    inkPass.uniforms.resolution.value.set(size.width * pixelRatio, size.height * pixelRatio)
    inkPass.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse)
    inkPass.uniforms.tDepth.value = aoPass.beautyRenderTarget.depthTexture
    return () => {
      composer.dispose()
      aoPass.dispose()
      inkPass.dispose()
      outputPass.dispose()
    }
  }, [aoPass, camera, composer, gl, inkPass, outputPass, size.height, size.width])

  useFrame((_, delta) => {
    frameCount.value += 1
    if (frameCount.value % 30 === 0) applyToonGradient(scene)
    inkPass.uniforms.tDepth.value = aoPass.beautyRenderTarget.depthTexture
    inkPass.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse)
    composer.render(delta)
  }, 1)
  return null
}
