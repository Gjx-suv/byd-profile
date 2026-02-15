import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const PARTICLE_COUNT = 820;
const SPHERE_RADIUS = 2.1;
const POEM_LINES = [
  "时间把光折成潮汐，",
  "每一次涨落都像心跳。",
  "理性写下冰冷的曲线，",
  "感性让数据开始呼吸。",
  "当夜色落进代码，",
  "我们终于听见未来。"
];

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.12);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);

const rig = new THREE.Group();
scene.add(rig);

const glow = new THREE.Mesh(
  new THREE.SphereGeometry(2.5, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x2d77ff,
    transparent: true,
    opacity: 0.11
  })
);
rig.add(glow);

const chars = "{}<>/$#01AI+*";
const textureCache = new Map();

function makeCharTexture(char) {
  if (textureCache.has(char)) return textureCache.get(char);
  const c = document.createElement("canvas");
  c.width = 72;
  c.height = 72;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "rgba(155, 195, 255, 0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 42px monospace";
  ctx.fillText(char, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  textureCache.set(char, tex);
  return tex;
}

function fibSphere(i, total, radius) {
  const offset = 2 / total;
  const y = i * offset - 1 + offset / 2;
  const r = Math.sqrt(1 - y * y);
  const phi = i * (Math.PI * (3 - Math.sqrt(5)));
  return new THREE.Vector3(Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius);
}

function poemTargets(count) {
  const w = 980;
  const h = 540;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "700 62px PingFang SC, Microsoft YaHei, sans-serif";

  const lineHeight = 82;
  const startY = h / 2 - ((POEM_LINES.length - 1) * lineHeight) / 2;
  POEM_LINES.forEach((line, idx) => {
    ctx.fillText(line, w / 2, startY + idx * lineHeight);
  });

  const img = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  const step = 5;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const a = img[(y * w + x) * 4 + 3];
      if (a > 110 && Math.random() > 0.35) {
        const nx = (x / w - 0.5) * 7.6;
        const ny = -(y / h - 0.5) * 4.2;
        const nz = (Math.random() - 0.5) * 0.45;
        pts.push(new THREE.Vector3(nx, ny, nz));
      }
    }
  }

  while (pts.length < count) {
    const p = pts[Math.floor(Math.random() * pts.length)] ?? new THREE.Vector3();
    pts.push(p.clone().addScaledVector(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 0.08));
  }

  return pts.slice(0, count);
}

const targets = poemTargets(PARTICLE_COUNT);
const particles = [];

for (let i = 0; i < PARTICLE_COUNT; i += 1) {
  const home = fibSphere(i, PARTICLE_COUNT, SPHERE_RADIUS);
  const material = new THREE.SpriteMaterial({
    map: makeCharTexture(chars[Math.floor(Math.random() * chars.length)]),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const sprite = new THREE.Sprite(material);
  const s = 0.078 + Math.random() * 0.04;
  sprite.scale.setScalar(s);
  sprite.position.copy(home);
  rig.add(sprite);

  particles.push({
    sprite,
    home,
    poem: targets[i],
    jitter: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 0.8
  });
}

const sphereHitArea = new THREE.Mesh(
  new THREE.SphereGeometry(2.4, 24, 24),
  new THREE.MeshBasicMaterial({ visible: false })
);
rig.add(sphereHitArea);

const pointer = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
let scatter = 0;

window.addEventListener("pointermove", (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let audioStarted = false;
function bootAmbient() {
  if (audioStarted) return;
  audioStarted = true;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.06;
  master.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 110;

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = 164.81;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(filter.frequency);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(master);

  osc1.start();
  osc2.start();
  lfo.start();
}

window.addEventListener("pointerdown", bootAmbient, { once: true });
window.addEventListener("keydown", bootAmbient, { once: true });

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();

  raycaster.setFromCamera(pointer, camera);
  const hovering = raycaster.intersectObject(sphereHitArea).length > 0;
  scatter = THREE.MathUtils.lerp(scatter, hovering ? 1 : 0, 0.045);

  const pulse = 1 + Math.sin(t * 1.9) * 0.06;
  rig.scale.setScalar(pulse);
  rig.rotation.y = t * 0.18;
  rig.rotation.x = Math.sin(t * 0.2) * 0.2;

  particles.forEach((p, i) => {
    const breath = 1 + Math.sin(t * p.speed + p.jitter) * 0.08;
    const base = p.home.clone().multiplyScalar(breath);
    const target = base.lerp(p.poem, scatter);

    p.sprite.position.lerp(target, 0.14);
    p.sprite.material.opacity = 0.52 + (1 - scatter) * 0.4;

    const shimmer = 0.075 + Math.sin(t * 3 + i) * 0.006;
    p.sprite.scale.setScalar(shimmer + (scatter * 0.012));
  });

  glow.material.opacity = 0.1 + Math.sin(t * 1.8) * 0.03;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
