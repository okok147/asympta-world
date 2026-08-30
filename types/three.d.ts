declare module "three" {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    setScalar(value: number): this;
    lerp(target: Vector3, alpha: number): this;
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
  }

  export class Object3D {
    children: Object3D[];
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    userData: Record<string, unknown>;
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    traverse(callback: (object: Object3D) => void): void;
  }

  export class Group extends Object3D {}
  export class Scene extends Object3D {}

  export class Material {
    dispose(): void;
    clone(): this;
  }

  export class BufferGeometry {
    dispose(): void;
    setFromPoints(points: readonly Vector3[]): this;
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: Material | Material[];
    constructor(geometry?: BufferGeometry, material?: Material | Material[]);
  }

  export class Line extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: Record<string, unknown>);
  }

  export class LineBasicMaterial extends Material {
    constructor(parameters?: Record<string, unknown>);
  }

  export class CircleGeometry extends BufferGeometry {
    constructor(radius?: number, segments?: number);
  }

  export class CylinderGeometry extends BufferGeometry {
    constructor(radiusTop?: number, radiusBottom?: number, height?: number, radialSegments?: number);
  }

  export class TorusGeometry extends BufferGeometry {
    constructor(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number);
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class ConeGeometry extends BufferGeometry {
    constructor(radius?: number, height?: number, radialSegments?: number);
  }

  export class QuadraticBezierCurve3 {
    constructor(start: Vector3, control: Vector3, end: Vector3);
    getPoints(divisions?: number): Vector3[];
  }

  export class OrthographicCamera extends Object3D {
    left: number;
    right: number;
    top: number;
    bottom: number;
    constructor(left: number, right: number, top: number, bottom: number, near?: number, far?: number);
    lookAt(x: number, y: number, z: number): void;
    updateProjectionMatrix(): void;
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor?: number, groundColor?: number, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    outputColorSpace: string;
    constructor(parameters?: Record<string, unknown>);
    setClearColor(color: number, alpha?: number): void;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: OrthographicCamera): void;
    dispose(): void;
  }

  export const SRGBColorSpace: string;
}
