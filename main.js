import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

const wrap = document.getElementById("canvas-wrap");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.09);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
wrap.appendChild(renderer.domElement);

const pulseChars = "01<>/$#AI周期经济呼吸";
const poemLines = [
  "时间不是钟摆，",
  "是市场胸腔里忽明忽暗的光，",
  "衰退与繁荣互相借火，",
  "我们在波峰写代码，",
  "也在波谷学会仰望。"
];
const poem = poemLines.join(" ");

const fontCanvas = document.createElement("canvas");
fontCanvas.width = 128;
fontCanvas.height = 128;
const fontCtx = fontCanvas.getContext("2d");
fontCtx.fillStyle = "#d6f3ff";
fontCtx.font = "700 90px 'Courier New', monospace";
fontCtx.textAlign = "center";
fontCtx.textBaseline = "middle";
fontCtx.fillText("A", 64, 66);
const glyphTexture = new THREE.CanvasTexture(fontCanvas);
glyphTexture.needsUpdate = true;

const count = 900;
const sphereRadius = 2;

const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);
const randomPhase = new Float32Array(count);
const sphereTargets = new Float32Array(count * 3);
const poemTargets = new Float32Array(count * 3);

const colorA = new THREE.Color("#89d1ff");
const colorB = new THREE.Color("#c5d8ff");

const poemCanvas = document.createElement("canvas");
poemCanvas.width = 1400;
poemCanvas.height = 800;
const poemCtx = poemCanvas.getContext("2d");
poemCtx.fillStyle = "#000";
poemCtx.fillRect(0, 0, poemCanvas.width, poemCanvas.height);
poemCtx.fillStyle = "#fff";
poemCtx.font = "700 56px 'PingFang SC', sans-serif";
poemCtx.textAlign = "center";
poemCtx.textBaseline = "middle";
poemLines.forEach((line, i) => poemCtx.fillText(line, poemCanvas.width / 2, 200 + i * 95));

const poemData = poemCtx.getImageData(0, 0, poemCanvas.width, poemCanvas.height).data;
const points = [];
for (let y = 0; y < poemCanvas.height; y += 6) {
  for (let x = 0; x < poemCanvas.width; x += 6) {
    const idx = (y * poemCanvas.width + x) * 4 + 3;
    if (poemData[idx] > 120) {
      points.push([
        (x / poemCanvas.width - 0.5) * 8,
        (0.5 - y / poemCanvas.height) * 4.8,
        (Math.random() - 0.5) * 0.6
      ]);
    }
  }
}

for (let i = 0; i < count; i++) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);

  const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
  const y = sphereRadius * Math.cos(phi);
  const z = sphereRadius * Math.sin(phi) * Math.sin(theta);

  sphereTargets[i * 3] = x;
  sphereTargets[i * 3 + 1] = y;
  sphereTargets[i * 3 + 2] = z;

  const pick = points[Math.floor(Math.random() * points.length)] || [0, 0, 0];
  poemTargets[i * 3] = pick[0];
  poemTargets[i * 3 + 1] = pick[1];
  poemTargets[i * 3 + 2] = pick[2];

  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  const blend = Math.random();
  const c = colorA.clone().lerp(colorB, blend);
  colors[i * 3] = c.r;
  colors[i * 3 + 1] = c.g;
  colors[i * 3 + 2] = c.b;

  randomPhase[i] = Math.random() * Math.PI * 2;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.11,
  transparent: true,
  opacity: 0.95,
  map: glyphTexture,
  alphaTest: 0.3,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true
});

const cloud = new THREE.Points(geometry, material);
scene.add(cloud);

const mouse = new THREE.Vector2(2, 2);
let hover = 0;
let audioStarted = false;

addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
});

addEventListener("pointerleave", () => {
  mouse.set(2, 2);
});

addEventListener("click", startAmbientAudio, { once: true });

function startAmbientAudio() {
  if (audioStarted) return;
  audioStarted = true;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.08;
  master.connect(ctx.destination);

  const beat = [0, 0.8, 1.6, 2.6];
  beat.forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i % 2 ? "triangle" : "sine";
    osc.frequency.value = i % 2 ? 110 : 82;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    for (let t = 0; t < 60; t += 3.2) {
      const start = ctx.currentTime + offset + t;
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.85);
    }
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 64);
  });
}

const raycaster = new THREE.Raycaster();
const zero = new THREE.Vector3();
const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();

  raycaster.setFromCamera(mouse, camera);
  const dist = raycaster.ray.distanceToPoint(zero);
  const targetHover = dist < 2.3 ? 1 : 0;
  hover += (targetHover - hover) * 0.045;

  const pulse = 1 + Math.sin(t * 2.1) * 0.09;
  cloud.rotation.y += 0.0025;

  const pos = geometry.attributes.position.array;
  for (let i = 0; i < count; i++) {
    const si = i * 3;
    const wobble = Math.sin(t * 3 + randomPhase[i]) * 0.06;

    const sx = sphereTargets[si] * (pulse + wobble);
    const sy = sphereTargets[si + 1] * (pulse + wobble);
    const sz = sphereTargets[si + 2] * (pulse + wobble);

    const px = poemTargets[si];
    const py = poemTargets[si + 1];
    const pz = poemTargets[si + 2];

    pos[si] = THREE.MathUtils.lerp(sx, px, hover);
    pos[si + 1] = THREE.MathUtils.lerp(sy, py, hover);
    pos[si + 2] = THREE.MathUtils.lerp(sz, pz, hover);
  }
  geometry.attributes.position.needsUpdate = true;

  material.opacity = 0.86 + hover * 0.14;
  material.size = 0.11 - hover * 0.02;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

console.info("Poem:", poem);
console.info("Preview text:", "把宏观经济的枯燥数据，用前端视角重新解构。");
