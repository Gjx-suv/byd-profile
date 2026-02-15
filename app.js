import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.06);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6.8);

const group = new THREE.Group();
scene.add(group);

const ambient = new THREE.AmbientLight(0x4460ff, 0.45);
const rim = new THREE.PointLight(0x7ca5ff, 2.5, 20, 2);
rim.position.set(2.5, 2.5, 3.5);
scene.add(ambient, rim);

const PARTICLE_COUNT = 11000;
const sphereTargets = new Float32Array(PARTICLE_COUNT * 3);
const poemTargets = new Float32Array(PARTICLE_COUNT * 3);
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i += 1) {
  const i3 = i * 3;
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const radius = 1.75 + (Math.random() - 0.5) * 0.2;

  sphereTargets[i3] = radius * Math.sin(phi) * Math.cos(theta);
  sphereTargets[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  sphereTargets[i3 + 2] = radius * Math.cos(phi);

  positions[i3] = sphereTargets[i3];
  positions[i3 + 1] = sphereTargets[i3 + 1];
  positions[i3 + 2] = sphereTargets[i3 + 2];

  const hueMix = 0.35 + 0.65 * Math.random();
  colors[i3] = 0.35 * hueMix;
  colors[i3 + 1] = 0.6 * hueMix;
  colors[i3 + 2] = 1.0;
  sizes[i] = 1.2 + Math.random() * 2.2;
}

const poem = [
  'TIME DRIPS IN SILICON VEINS',
  'EACH CYCLE BREATHES A NEW DAWN',
  'WE CODE THE TIDE,',
  'YET THE HEART DECIDES'
];

const poemCanvas = document.createElement('canvas');
poemCanvas.width = 1800;
poemCanvas.height = 820;
const poemCtx = poemCanvas.getContext('2d');
poemCtx.fillStyle = '#000';
poemCtx.fillRect(0, 0, poemCanvas.width, poemCanvas.height);
poemCtx.fillStyle = '#fff';
poemCtx.textAlign = 'center';
poemCtx.font = "600 108px 'Cormorant Garamond', serif";
poem.forEach((line, index) => {
  poemCtx.fillText(line, poemCanvas.width / 2, 220 + index * 145);
});

const data = poemCtx.getImageData(0, 0, poemCanvas.width, poemCanvas.height).data;
const poemPoints = [];
for (let y = 0; y < poemCanvas.height; y += 4) {
  for (let x = 0; x < poemCanvas.width; x += 4) {
    const idx = (y * poemCanvas.width + x) * 4;
    if (data[idx] > 220) {
      poemPoints.push({
        x: (x / poemCanvas.width - 0.5) * 7.2,
        y: -(y / poemCanvas.height - 0.5) * 3.2,
        z: (Math.random() - 0.5) * 0.6
      });
    }
  }
}

for (let i = 0; i < PARTICLE_COUNT; i += 1) {
  const p = poemPoints[(i * 17) % poemPoints.length];
  const i3 = i * 3;
  poemTargets[i3] = p.x + (Math.random() - 0.5) * 0.05;
  poemTargets[i3 + 1] = p.y + (Math.random() - 0.5) * 0.05;
  poemTargets[i3 + 2] = p.z;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (280.0 / -mvPosition.z) * (1.0 + 0.2 * sin(uTime + position.y * 2.0));
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float alpha = smoothstep(0.48, 0.06, d);
      gl_FragColor = vec4(vColor, alpha * 0.95);
    }
  `
});

const points = new THREE.Points(geometry, material);
group.add(points);

const collider = new THREE.Mesh(
  new THREE.SphereGeometry(2.1, 32, 32),
  new THREE.MeshBasicMaterial({ visible: false })
);
group.add(collider);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);

let hoverTarget = 0;
let hoverAmount = 0;

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  startAudio();
});

window.addEventListener('pointerleave', () => {
  pointer.x = 10;
  pointer.y = 10;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

let audioStarted = false;
function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.05;
  master.connect(ctx.destination);

  const drone = ctx.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 110;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 420;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.22;
  drone.connect(droneFilter).connect(droneGain).connect(master);
  drone.start();

  const shimmer = ctx.createOscillator();
  shimmer.type = 'triangle';
  shimmer.frequency.value = 330;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.08;
  shimmer.connect(shimmerGain).connect(master);
  shimmer.start();

  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.12;
  lfoDepth.gain.value = 30;
  lfo.connect(lfoDepth).connect(droneFilter.frequency);
  lfo.start();

  const beat = () => {
    const t = ctx.currentTime;
    const pulse = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(70, t);
    pulse.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    pulseGain.gain.setValueAtTime(0.0001, t);
    pulseGain.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    pulse.connect(pulseGain).connect(master);
    pulse.start(t);
    pulse.stop(t + 0.24);
  };

  beat();
  setInterval(beat, 860);
}

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  material.uniforms.uTime.value = t;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(collider);
  hoverTarget = intersects.length > 0 ? 1 : 0;
  hoverAmount += (hoverTarget - hoverAmount) * 0.06;

  const pulse = 1 + 0.13 * Math.sin(t * 2.4) + 0.05 * Math.sin(t * 4.1 + 1.2);
  const breath = 0.18 + 0.1 * Math.sin(t * 1.2);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const sx = sphereTargets[i3] * pulse;
    const sy = sphereTargets[i3 + 1] * pulse;
    const sz = sphereTargets[i3 + 2] * pulse;

    const swirl = Math.sin(t + sx * 2.6 + sy * 1.8);
    const sphereX = sx + swirl * 0.03;
    const sphereY = sy + Math.cos(t * 1.3 + sz * 2.1) * breath * 0.1;
    const sphereZ = sz + Math.sin(t * 1.6 + sy * 2.4) * breath * 0.1;

    const px = poemTargets[i3] + Math.sin(t * 0.8 + i * 0.02) * 0.02;
    const py = poemTargets[i3 + 1] + Math.cos(t * 0.9 + i * 0.015) * 0.02;
    const pz = poemTargets[i3 + 2] + Math.sin(t * 0.7 + i * 0.011) * 0.1;

    positions[i3] += (THREE.MathUtils.lerp(sphereX, px, hoverAmount) - positions[i3]) * 0.16;
    positions[i3 + 1] += (THREE.MathUtils.lerp(sphereY, py, hoverAmount) - positions[i3 + 1]) * 0.16;
    positions[i3 + 2] += (THREE.MathUtils.lerp(sphereZ, pz, hoverAmount) - positions[i3 + 2]) * 0.16;
  }

  geometry.attributes.position.needsUpdate = true;
  group.rotation.y = t * 0.16 * (1 - hoverAmount * 0.7);
  group.rotation.x = Math.sin(t * 0.3) * 0.08;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
