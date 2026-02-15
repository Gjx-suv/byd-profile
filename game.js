import * as THREE from 'https://esm.sh/three@0.166.1';

const container = document.getElementById('scene');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 25, 78);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0x89a8ff, 0.8);
scene.add(ambient);

const rim = new THREE.DirectionalLight(0x7cb4ff, 1.1);
rim.position.set(2.2, 2.6, 4);
scene.add(rim);

const group = new THREE.Group();
scene.add(group);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(2, 2);
const clock = new THREE.Clock();

const PARTICLE_COUNT = 3200;
const chars = '0101{}[]<>constletvarfunction周期经济AI时间脉搏';

const poemLines = [
  '时间把晨昏折成一枚硬币，',
  '抛向每一次繁荣与回落；',
  '我们在噪声里追问方向，',
  '直到数据也学会了心跳。',
  '此刻，代码不是答案，',
  '而是黑夜里发光的潮汐。',
];

function randomChar() {
  return chars[Math.floor(Math.random() * chars.length)];
}

function makeGlyphTexture(glyph) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,255,255,0.96)');
  grad.addColorStop(1, 'rgba(156,200,255,0.88)');

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = grad;
  ctx.font = "700 88px 'Cascadia Code', 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(120,190,255,0.45)';
  ctx.shadowBlur = 8;
  ctx.fillText(glyph, size / 2, size / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const materials = Array.from({ length: 22 }, () => {
  const texture = makeGlyphTexture(randomChar());
  return new THREE.PointsMaterial({
    size: 0.35,
    map: texture,
    transparent: true,
    alphaTest: 0.15,
    depthWrite: false,
    color: new THREE.Color().setHSL(0.56 + Math.random() * 0.06, 0.95, 0.72),
    blending: THREE.AdditiveBlending,
    opacity: 0.88,
  });
});

function sampleSpherePosition() {
  const u = Math.random();
  const v = Math.random();
  const theta = Math.acos(2 * u - 1);
  const phi = 2 * Math.PI * v;
  const radius = 5.2 + (Math.random() - 0.5) * 0.65;
  return {
    x: radius * Math.sin(theta) * Math.cos(phi),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(theta) * Math.sin(phi),
  };
}

function buildPoemPositions(total) {
  const positions = [];
  const lineHeight = 1.18;
  const startY = ((poemLines.length - 1) * lineHeight) / 2;

  for (let li = 0; li < poemLines.length; li += 1) {
    const line = poemLines[li];
    const centerOffset = (line.length - 1) / 2;
    for (let ci = 0; ci < line.length; ci += 1) {
      positions.push({
        x: (ci - centerOffset) * 0.72,
        y: startY - li * lineHeight,
        z: (Math.random() - 0.5) * 0.18,
      });
    }
  }

  while (positions.length < total) {
    const p = positions[Math.floor(Math.random() * positions.length)];
    positions.push({
      x: p.x + (Math.random() - 0.5) * 0.25,
      y: p.y + (Math.random() - 0.5) * 0.25,
      z: p.z + (Math.random() - 0.5) * 0.12,
    });
  }

  return positions;
}

const poemTargets = buildPoemPositions(PARTICLE_COUNT);

const clouds = [];
const scatterVelocity = [];
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

for (let i = 0; i < materials.length; i += 1) {
  const count = Math.floor(PARTICLE_COUNT / materials.length) + (i === materials.length - 1 ? PARTICLE_COUNT % materials.length : 0);
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const offsets = new Float32Array(count);

  for (let j = 0; j < count; j += 1) {
    const s = sampleSpherePosition();
    const idx = j * 3;
    pos[idx] = s.x;
    pos[idx + 1] = s.y;
    pos[idx + 2] = s.z;
    base[idx] = s.x;
    base[idx + 1] = s.y;
    base[idx + 2] = s.z;
    offsets[j] = Math.random() * Math.PI * 2;
    scatterVelocity.push((Math.random() * 0.6 + 0.4) * (Math.random() > 0.5 ? 1 : -1));
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('base', new THREE.BufferAttribute(base, 3));
  geometry.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));

  const points = new THREE.Points(geometry, materials[i]);
  group.add(points);
  clouds.push({ points, geometry, count, globalOffset: clouds.reduce((acc, c) => acc + c.count, 0) });
}

const pulseCore = new THREE.Mesh(
  new THREE.SphereGeometry(3.2, 52, 52),
  new THREE.MeshBasicMaterial({ color: 0x5ea4ff, transparent: true, opacity: 0.12 })
);
group.add(pulseCore);

let hoverMix = 0;

function animate() {
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();

  mouse.x += (mouse.tx - mouse.x) * 0.06;
  mouse.y += (mouse.ty - mouse.y) * 0.06;

  camera.position.x = mouse.x * 2.4;
  camera.position.y = mouse.y * 1.4;
  camera.lookAt(0, 0, 0);

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(pulseCore, false);
  const targetHover = intersects.length > 0 ? 1 : 0;
  hoverMix += (targetHover - hoverMix) * 0.06;

  const pulse = 1 + Math.sin(t * 2.2) * 0.08;
  group.scale.setScalar(THREE.MathUtils.lerp(pulse, 1.02, hoverMix));
  pulseCore.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05);
  pulseCore.material.opacity = 0.09 + Math.sin(t * 2.2) * 0.03;

  let k = 0;
  for (const cloud of clouds) {
    const posAttr = cloud.geometry.getAttribute('position');
    const baseAttr = cloud.geometry.getAttribute('base');
    const offAttr = cloud.geometry.getAttribute('offset');

    for (let i = 0; i < cloud.count; i += 1) {
      const idx = i * 3;
      const globalIndex = cloud.globalOffset + i;

      const bx = baseAttr.array[idx];
      const by = baseAttr.array[idx + 1];
      const bz = baseAttr.array[idx + 2];

      const wave = Math.sin(t * 3 + offAttr.array[i]) * 0.18;
      const sphereX = bx * pulse + wave;
      const sphereY = by * pulse + Math.cos(t * 2.4 + offAttr.array[i]) * 0.14;
      const sphereZ = bz * pulse;

      const poem = poemTargets[globalIndex];
      const drift = scatterVelocity[k] * 0.17;
      const poemX = poem.x + Math.sin(t * 0.75 + k * 0.08) * drift;
      const poemY = poem.y + Math.cos(t * 0.6 + k * 0.05) * drift * 0.65;
      const poemZ = poem.z + Math.sin(t * 0.5 + k * 0.03) * 0.22;

      posAttr.array[idx] = THREE.MathUtils.lerp(sphereX, poemX, hoverMix);
      posAttr.array[idx + 1] = THREE.MathUtils.lerp(sphereY, poemY, hoverMix);
      posAttr.array[idx + 2] = THREE.MathUtils.lerp(sphereZ, poemZ, hoverMix);
      k += 1;
    }

    posAttr.needsUpdate = true;
    cloud.points.rotation.y += dt * (0.11 + hoverMix * 0.16);
    cloud.points.rotation.x = Math.sin(t * 0.3) * 0.12;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  mouse.tx = pointer.x;
  mouse.ty = -pointer.y * 0.75;
}

window.addEventListener('pointermove', onPointerMove);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
