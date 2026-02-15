import * as THREE from "https://unpkg.com/three@0.167.1/build/three.module.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0, 11);

const group = new THREE.Group();
scene.add(group);

const ambient = new THREE.AmbientLight(0x90a6ff, 0.85);
const rim = new THREE.PointLight(0x80a0ff, 2.1, 120, 2);
rim.position.set(0, 0, 13);
const fill = new THREE.PointLight(0x6e3dff, 1.2, 70, 2.4);
fill.position.set(-8, -4, -10);
scene.add(ambient, rim, fill);

const particleCount = 1050;
const baseRadius = 3.15;
const symbols = "01{}[]<>/#$%&*+-=;:AI经济周期TIME";
const particles = [];

function randomOnSphere(radius) {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const root = Math.sqrt(1 - u * u);
  return new THREE.Vector3(
    radius * root * Math.cos(theta),
    radius * u,
    radius * root * Math.sin(theta),
  );
}

function makeCharTexture(char) {
  const size = 96;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(225, 235, 255, 0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 46px 'JetBrains Mono', 'Consolas', monospace";
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(136, 167, 255, 0.65)";
  ctx.fillText(char, size * 0.5, size * 0.52);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function poemTargets(total) {
  const lines = [
    "时间把浪潮折进指缝，",
    "每一次扩张都藏着回声；",
    "我们在衰退里点亮代码，",
    "让数据像心跳一样发光。",
  ];

  const points = [];
  const sampleCanvas = document.createElement("canvas");
  const width = 1200;
  const height = 560;
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = 118;
  lines.forEach((line, index) => {
    ctx.font = index === 3 ? "700 68px 'PingFang SC', sans-serif" : "600 62px 'PingFang SC', sans-serif";
    ctx.fillText(line, width / 2, 120 + index * lineHeight);
  });

  const { data } = ctx.getImageData(0, 0, width, height);
  const stride = 5;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 130) {
        points.push(
          new THREE.Vector3(
            ((x / width) * 2 - 1) * 6.4,
            (1 - (y / height) * 2) * 3.15,
            (Math.random() - 0.5) * 0.7,
          ),
        );
      }
    }
  }

  for (let i = points.length; i < total; i += 1) {
    points.push(new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 7));
  }

  for (let i = points.length - 1; i > 0; i -= 1) {
    const j = (Math.random() * (i + 1)) | 0;
    [points[i], points[j]] = [points[j], points[i]];
  }

  return points.slice(0, total);
}

const targets = poemTargets(particleCount);

for (let i = 0; i < particleCount; i += 1) {
  const char = symbols[(Math.random() * symbols.length) | 0];
  const texture = makeCharTexture(char);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    color: new THREE.Color().setHSL(0.6 + Math.random() * 0.08, 0.7, 0.74 + Math.random() * 0.2),
  });

  const sprite = new THREE.Sprite(material);
  const base = randomOnSphere(baseRadius + (Math.random() - 0.5) * 0.35);
  sprite.position.copy(base);
  const scale = 0.19 + Math.random() * 0.16;
  sprite.scale.setScalar(scale);

  group.add(sprite);
  particles.push({
    sprite,
    base,
    scatter: targets[i],
    speed: 0.5 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2,
    drift: (Math.random() - 0.5) * 0.5,
  });
}

const hoverMesh = new THREE.Mesh(new THREE.SphereGeometry(baseRadius + 0.42, 40, 40), new THREE.MeshBasicMaterial({ visible: false }));
hoverMesh.position.set(0, 0, 0);
group.add(hoverMesh);

const mouse = new THREE.Vector2(2, 2);
const raycaster = new THREE.Raycaster();
let hover = false;
let hoverMix = 0;

window.addEventListener("pointermove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();

  raycaster.setFromCamera(mouse, camera);
  hover = raycaster.intersectObject(hoverMesh).length > 0;

  hoverMix = THREE.MathUtils.damp(hoverMix, hover ? 1 : 0, hover ? 5 : 3.5, clock.getDelta());

  const pulse = 1 + Math.sin(t * 2.3) * 0.08 + Math.pow(Math.max(0, Math.sin(t * 4.6)), 4) * 0.11;

  group.rotation.y += 0.0022;
  group.rotation.x = Math.sin(t * 0.3) * 0.08;

  particles.forEach((particle, index) => {
    const wave = 1 + Math.sin(t * particle.speed + particle.phase) * 0.08;
    const orbit = 1 + particle.drift * Math.sin(t * 0.6 + index * 0.01);
    const sphereTarget = particle.base.clone().multiplyScalar(pulse * wave * orbit);

    const target = sphereTarget.lerp(particle.scatter, hoverMix);
    particle.sprite.position.lerp(target, 0.14);

    const sparkle = 0.7 + Math.sin(t * 3.3 + particle.phase) * 0.2;
    particle.sprite.material.opacity = THREE.MathUtils.lerp(0.86 * sparkle, 0.95, hoverMix);
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
