declare module 'n8ao' {
  import type * as THREE from 'three'
  import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js'

  export class N8AOPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number)
    configuration: {
      aoRadius: number
      distanceFalloff: number
      intensity: number
      halfRes: boolean
    }
  }
}
