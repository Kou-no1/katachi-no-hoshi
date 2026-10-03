import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const COLORS = {
  ink: 0x294f49,
  coral: 0xf19b79,
  mint: 0x81b8a2,
  sky: 0x89b5d1,
  yellow: 0xe6c573,
  purple: 0xb7a1c8,
  cream: 0xf9f6ed,
};

export function createThreeStage(host: HTMLElement, options: { span?: number; position?: THREE.Vector3; target?: THREE.Vector3 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.cream);
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  camera.position.copy(options.position ?? new THREE.Vector3(7, 6, 8));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(options.target ?? new THREE.Vector3());
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = false;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI - 0.05;
  let span = options.span ?? 7;
  let aspect = 1;
  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(5, 8, 7);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-5, 3, -3);
  scene.add(fill);
  const render = () => renderer.render(scene, camera);
  const updateFrustum = () => {
    const half = span / 2;
    camera.left = -half * Math.max(aspect, 1);
    camera.right = half * Math.max(aspect, 1);
    camera.top = half * Math.max(1 / aspect, 1);
    camera.bottom = -half * Math.max(1 / aspect, 1);
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    aspect = width / height;
    updateFrustum();
    renderer.setSize(width, height, false);
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener('change', render);
  controls.update();
  resize();
  return {
    scene, camera, renderer, controls, render,
    setSpan(value: number) { span = Math.max(value, 1); updateFrustum(); render(); },
    setCamera(position: THREE.Vector3, target = controls.target.clone()) {
      camera.position.copy(position);
      controls.target.copy(target);
      camera.up.set(0, 1, 0);
      if (Math.abs(position.x - target.x) + Math.abs(position.z - target.z) < 0.001) camera.up.set(0, 0, -1);
      camera.lookAt(target);
      controls.update();
      render();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          const collection = Array.isArray(object.material) ? object.material : [object.material];
          collection.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
