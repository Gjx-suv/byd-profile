import * as THREE from 'https://esm.sh/three@0.166.1';

const container = document.getElementById('scene');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 22, 84);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, 0, 16);

let renderer = null;

const webglProbe = document.createElement('canvas');
const canUseWebGL = Boolean(webglProbe.getContext('webgl2') || webglProbe.getContext('webgl'));

if (canUseWebGL) {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
  } catch (error) {
    console.warn('WebGL 初始化失败，已降级为静态提示。', error);
  }
}

if (!renderer) {
  const fallback = document.createElement('div');
  fallback.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'color:rgba(220,232,255,0.9)',
    'font-size:14px',
    'letter-spacing:0.04em',
    'background:radial-gradient(circle at 50% 52%, rgba(40,82,156,0.18), rgba(0,0,0,0.96) 60%)',
  ].join(';');
  fallback.textContent = '当前环境不支持 WebGL，无法渲染动态球体。';
  container.appendChild(fallback);
}

scene.add(new THREE.AmbientLight(0x7a9dff, 0.65));

const lightA = new THREE.DirectionalLight(0xa6c8ff, 1.05);
lightA.position.set(3, 2.8, 4.2);
scene.add(lightA);

const lightB = new THREE.DirectionalLight(0x5f8dff, 0.45);
lightB.position.set(-2.8, -1.5, -3);
scene.add(lightB);

const mouseNdc = new THREE.Vector2(2, 2);
const cameraDrift = { x: 0, y: 0, tx: 0, ty: 0 };
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

const dataChars = '01{}[]<>#*+?constletvar周期经济AI时间脉搏';
const symbolChars = '♪♫♩♬♭♯𝄞𝄢𝄡✦✧✶✹❋◇◆◈◎∞';
const poemLines = [
  '时间把晨昏折成一枚硬币，',
  '抛向每一次繁荣与回落；',
  '我们在噪声里追问方向，',
  '直到数据也学会了心跳。',
  '此刻，代码不是答案，',
  '而是黑夜里发光的潮汐。',
];

const textureCache = new Map();

function createGlyphTexture(glyph) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const glow = ctx.createRadialGradient(size / 2, size / 2, 16, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(198,226,255,0.95)');
  glow.addColorStop(1, 'rgba(119,170,255,0.12)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.font = "700 84px 'Cascadia Code', 'JetBrains Mono', 'Noto Music', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(124,182,255,0.65)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(240,247,255,0.96)';
  ctx.fillText(glyph, size / 2, size / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function getGlyphTexture(glyph) {
  if (!textureCache.has(glyph)) {
    textureCache.set(glyph, createGlyphTexture(glyph));
  }
  return textureCache.get(glyph);
}

function randomCharFrom(text) {
  return text[Math.floor(Math.random() * text.length)];
}

function sampleSpherePosition() {
  const u = Math.random();
  const v = Math.random();
  const theta = Math.acos(2 * u - 1);
  const phi = 2 * Math.PI * v;
  const radius = 5 + (Math.random() - 0.5) * 0.8;
  return {
    x: radius * Math.sin(theta) * Math.cos(phi),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(theta) * Math.sin(phi),
  };
}

function buildPoemTargets(total) {
  const targets = [];
  const lh = 1.2;
  const sy = ((poemLines.length - 1) * lh) / 2;

  for (let li = 0; li < poemLines.length; li += 1) {
    const line = poemLines[li];
    const centerOffset = (line.length - 1) / 2;
    for (let ci = 0; ci < line.length; ci += 1) {
      targets.push({
        x: (ci - centerOffset) * 0.72,
        y: sy - li * lh,
        z: (Math.random() - 0.5) * 0.24,
      });
    }
  }

  while (targets.length < total) {
    const base = targets[Math.floor(Math.random() * targets.length)];
    targets.push({
      x: base.x + (Math.random() - 0.5) * 0.28,
      y: base.y + (Math.random() - 0.5) * 0.28,
      z: base.z + (Math.random() - 0.5) * 0.14,
    });
  }
  return targets;
}

function createSoundEngine() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }

  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const padOsc = ctx.createOscillator();
  const padGain = ctx.createGain();
  padOsc.type = 'triangle';
  padOsc.frequency.value = 176;
  padGain.gain.value = 0.0001;
  padOsc.connect(padGain);

  const shimmerOsc = ctx.createOscillator();
  const shimmerGain = ctx.createGain();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.value = 352;
  shimmerGain.gain.value = 0.0001;
  shimmerOsc.connect(shimmerGain);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 840;
  lowpass.Q.value = 0.9;

  const delay = ctx.createDelay(0.45);
  delay.delayTime.value = 0.23;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;

  padGain.connect(lowpass);
  shimmerGain.connect(lowpass);
  lowpass.connect(master);
  lowpass.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(master);

  padOsc.start();
  shimmerOsc.start();

  return {
    ctx,
    master,
    padOsc,
    padGain,
    shimmerOsc,
    shimmerGain,
    lowpass,
    enabled: false,
    ensureRunning() {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (!this.enabled) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.linearRampToValueAtTime(0.11, now + 0.8);
        this.enabled = true;
      }
    },
    update(pulse, hoverMix) {
      if (!this.enabled) {
        return;
      }
      const now = this.ctx.currentTime;
      const baseFreq = 168 + pulse * 14;
      const hoverLift = hoverMix * 48;
      this.padOsc.frequency.setTargetAtTime(baseFreq, now, 0.11);
      this.shimmerOsc.frequency.setTargetAtTime(baseFreq * 2.02 + hoverLift, now, 0.12);
      this.padGain.gain.setTargetAtTime(0.028 + pulse * 0.018, now, 0.13);
      this.shimmerGain.gain.setTargetAtTime(0.009 + hoverMix * 0.018, now, 0.09);
      this.lowpass.frequency.setTargetAtTime(760 + hoverMix * 840 + pulse * 140, now, 0.12);
    },
  };
}

let soundEngine = null;

const PARTICLE_COUNT = 3600;
const CLOUD_COUNT = 24;
const group = new THREE.Group();
scene.add(group);

const materials = Array.from({ length: CLOUD_COUNT }, (_, i) => {
  const hue = 0.55 + Math.random() * 0.08;
  return new THREE.PointsMaterial({
    size: 0.34,
    map: getGlyphTexture(randomCharFrom(dataChars)),
    transparent: true,
    alphaTest: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.84,
    color: new THREE.Color().setHSL(hue, 0.95, 0.72 + (i % 3) * 0.04),
  });
});

const poemTargets = buildPoemTargets(PARTICLE_COUNT);
const clouds = [];
const driftSeeds = new Float32Array(PARTICLE_COUNT);

let globalOffset = 0;
for (let i = 0; i < CLOUD_COUNT; i += 1) {
  const isLast = i === CLOUD_COUNT - 1;
  const count = Math.floor(PARTICLE_COUNT / CLOUD_COUNT) + (isLast ? PARTICLE_COUNT % CLOUD_COUNT : 0);

  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const offset = new Float32Array(count);

  for (let j = 0; j < count; j += 1) {
    const p = sampleSpherePosition();
    const idx = j * 3;
    pos[idx] = p.x;
    pos[idx + 1] = p.y;
    pos[idx + 2] = p.z;
    base[idx] = p.x;
    base[idx + 1] = p.y;
    base[idx + 2] = p.z;
    offset[j] = Math.random() * Math.PI * 2;
    driftSeeds[globalOffset + j] = Math.random() * 2 - 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('base', new THREE.BufferAttribute(base, 3));
  geometry.setAttribute('offset', new THREE.BufferAttribute(offset, 1));

  const points = new THREE.Points(geometry, materials[i]);
  group.add(points);

  clouds.push({ points, geometry, count, globalOffset });
  globalOffset += count;
}

const core = new THREE.Mesh(
  new THREE.SphereGeometry(3.1, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x6da6ff, transparent: true, opacity: 0.1 })
);
group.add(core);

const halo = new THREE.Mesh(
  new THREE.SphereGeometry(4.7, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x3d70ff, transparent: true, opacity: 0.06, side: THREE.BackSide })
);
group.add(halo);

const stars = new THREE.Points(
  (() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i += 1) {
      const i3 = i * 3;
      p[i3] = (Math.random() - 0.5) * 150;
      p[i3 + 1] = (Math.random() - 0.5) * 100;
      p[i3 + 2] = (Math.random() - 0.5) * 150;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  })(),
  new THREE.PointsMaterial({ color: 0x7ba3ff, size: 0.22, transparent: true, opacity: 0.55, depthWrite: false })
);
scene.add(stars);

let hoverMix = 0;
let hoverState = false;
let glyphSwapCooldown = 0;

function updateMaterialGlyphs(useSymbols) {
  const pool = useSymbols ? symbolChars : dataChars;
  for (const mat of materials) {
    mat.map = getGlyphTexture(randomCharFrom(pool));
    mat.needsUpdate = true;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  const dt = clock.getDelta();

  cameraDrift.x += (cameraDrift.tx - cameraDrift.x) * 0.05;
  cameraDrift.y += (cameraDrift.ty - cameraDrift.y) * 0.05;
  camera.position.x = cameraDrift.x * 2.6;
  camera.position.y = cameraDrift.y * 1.5;
  camera.lookAt(0, 0, 0);

  raycaster.setFromCamera(mouseNdc, camera);
  const isHover = raycaster.intersectObject(core, false).length > 0;
  hoverMix += ((isHover ? 1 : 0) - hoverMix) * 0.055;

  if (isHover !== hoverState) {
    hoverState = isHover;
    updateMaterialGlyphs(hoverState);
  }

  if (hoverState) {
    glyphSwapCooldown -= dt;
    if (glyphSwapCooldown <= 0) {
      glyphSwapCooldown = 0.15;
      updateMaterialGlyphs(true);
    }
  }

  const pulse = 1 + Math.sin(t * 2.15) * 0.085;
  const glow = 1 + Math.sin(t * 2.15 + 1.1) * 0.06;

  group.scale.setScalar(THREE.MathUtils.lerp(pulse, 1.03, hoverMix));
  core.scale.setScalar(glow);
  halo.scale.setScalar(1.05 + Math.sin(t * 1.2) * 0.04);
  core.material.opacity = 0.08 + Math.sin(t * 2.15) * 0.035;
  halo.material.opacity = 0.05 + hoverMix * 0.06;

  stars.rotation.y += dt * 0.008;
  stars.rotation.x = Math.sin(t * 0.05) * 0.08;

  soundEngine?.update(pulse, hoverMix);

  for (const cloud of clouds) {
    const pos = cloud.geometry.getAttribute('position');
    const base = cloud.geometry.getAttribute('base');
    const offset = cloud.geometry.getAttribute('offset');

    for (let i = 0; i < cloud.count; i += 1) {
      const idx = i * 3;
      const gIdx = cloud.globalOffset + i;
      const seed = driftSeeds[gIdx];

      const bx = base.array[idx];
      const by = base.array[idx + 1];
      const bz = base.array[idx + 2];

      const wave = Math.sin(t * 3 + offset.array[i]) * 0.18;
      const sx = bx * pulse + wave;
      const sy = by * pulse + Math.cos(t * 2.4 + offset.array[i]) * 0.15;
      const sz = bz * pulse;

      const tx = poemTargets[gIdx].x + Math.sin(t * 0.8 + gIdx * 0.06) * seed * 0.2;
      const ty = poemTargets[gIdx].y + Math.cos(t * 0.66 + gIdx * 0.04) * seed * 0.14;
      const tz = poemTargets[gIdx].z + Math.sin(t * 0.5 + gIdx * 0.02) * 0.2;

      pos.array[idx] = THREE.MathUtils.lerp(sx, tx, hoverMix);
      pos.array[idx + 1] = THREE.MathUtils.lerp(sy, ty, hoverMix);
      pos.array[idx + 2] = THREE.MathUtils.lerp(sz, tz, hoverMix);
    }

    pos.needsUpdate = true;
    cloud.points.rotation.y += dt * (0.1 + hoverMix * 0.16);
    cloud.points.rotation.x = Math.sin(t * 0.35) * 0.11;
  }

  if (renderer) {
    renderer.render(scene, camera);
  }
}

window.addEventListener('pointermove', (event) => {
  mouseNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
  cameraDrift.tx = mouseNdc.x;
  cameraDrift.ty = -mouseNdc.y * 0.72;
});

window.addEventListener('pointerdown', () => {
  if (!soundEngine) {
    soundEngine = createSoundEngine();
  }
  soundEngine?.ensureRunning();
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

animate();
