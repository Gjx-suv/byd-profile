import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const poem = `
时间是一枚低鸣的齿轮
咬住黎明，也轻抚黄昏
我们在涨落之间学会呼吸
让每一次回撤都变成星辰
周期从不说话，却在脉搏里回声
`.trim();

const codeGlyphs = `{}[]()<>=+-*/0123456789AI经济周期数据macroflow`;
const container = document.querySelector('#scene-wrap');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 8, 24);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
camera.position.set(0, 0, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();

const ambient = new THREE.AmbientLight(0x8ba7ff, 0.55);
scene.add(ambient);

const point = new THREE.PointLight(0x7fb2ff, 1.2, 100);
point.position.set(3, 4, 8);
scene.add(point);

const textCanvas = document.createElement('canvas');
textCanvas.width = 2048;
textCanvas.height = 2048;
const textCtx = textCanvas.getContext('2d');
textCtx.textAlign = 'center';
textCtx.textBaseline = 'middle';
textCtx.fillStyle = '#dfe6ff';
textCtx.shadowColor = 'rgba(94, 130, 255, 0.45)';
textCtx.shadowBlur = 8;
textCtx.font = 'bold 68px "JetBrains Mono", "Fira Code", monospace';
textCtx.fillText(codeGlyphs[Math.floor(Math.random() * codeGlyphs.length)], textCanvas.width / 2, textCanvas.height / 2);
const glyphTexture = new THREE.CanvasTexture(textCanvas);
glyphTexture.minFilter = THREE.LinearFilter;
glyphTexture.magFilter = THREE.LinearFilter;

const particleCount = 2200;
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);
const targetsSphere = new Float32Array(particleCount * 3);
const targetsPoem = new Float32Array(particleCount * 3);
const jitter = new Float32Array(particleCount * 3);

const colorInside = new THREE.Color('#d5e1ff');
const colorOutside = new THREE.Color('#4b70ff');

function randomOnSphere(radius = 1.9) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * (0.74 + Math.random() * 0.26);
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
}

function buildPoemTargets() {
  const lines = poem.split('\n');
  const startY = (lines.length - 1) * 0.52;
  let index = 0;

  for (let i = 0; i < particleCount; i++) {
    const line = lines[i % lines.length];
    const char = line[i % line.length] || ' ';
    const x = ((i % 100) - 50) * 0.08;
    const y = startY - (index % lines.length) * 0.52;
    const z = (Math.random() - 0.5) * 0.22;
    const lineOffset = (line.length * 0.08) / 2;

    targetsPoem[i * 3] = x - lineOffset;
    targetsPoem[i * 3 + 1] = y;
    targetsPoem[i * 3 + 2] = z;

    if ((i + 1) % 100 === 0) {
      index += 1;
    }

    const depthTone = char === ' ' ? 0.1 : 0.55;
    colors[i * 3] = depthTone + Math.random() * 0.25;
    colors[i * 3 + 1] = depthTone + Math.random() * 0.2;
    colors[i * 3 + 2] = 1;
  }
}

buildPoemTargets();

for (let i = 0; i < particleCount; i++) {
  const sphere = randomOnSphere();
  targetsSphere[i * 3] = sphere.x;
  targetsSphere[i * 3 + 1] = sphere.y;
  targetsSphere[i * 3 + 2] = sphere.z;

  positions[i * 3] = sphere.x;
  positions[i * 3 + 1] = sphere.y;
  positions[i * 3 + 2] = sphere.z;

  jitter[i * 3] = (Math.random() - 0.5) * 0.4;
  jitter[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
  jitter[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

  const mix = Math.random();
  const blended = colorInside.clone().lerp(colorOutside, mix);
  colors[i * 3] *= blended.r;
  colors[i * 3 + 1] *= blended.g;
  colors[i * 3 + 2] *= blended.b;

  sizes[i] = 20 + Math.random() * 16;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: glyphTexture },
    uTime: { value: 0 },
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float uTime;

    void main() {
      vColor = color;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = size * (360.0 / -viewPosition.z);
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    uniform sampler2D uTexture;

    void main() {
      vec2 uv = gl_PointCoord;
      vec4 t = texture2D(uTexture, uv);
      if (t.a < 0.08) discard;
      gl_FragColor = vec4(vColor, t.a);
    }
  `,
  transparent: true,
  depthWrite: false,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

let hoverProgress = 0;
let hovered = false;

container.addEventListener('pointerenter', () => {
  hovered = true;
});

container.addEventListener('pointerleave', () => {
  hovered = false;
});

function resize() {
  const { clientWidth, clientHeight } = container;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

function animate() {
  const elapsed = clock.getElapsedTime();
  material.uniforms.uTime.value = elapsed;

  const target = hovered ? 1 : 0;
  hoverProgress += (target - hoverProgress) * 0.05;

  const breath = 1 + Math.sin(elapsed * 2.2) * 0.08;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    const sphereX = targetsSphere[i3] * breath;
    const sphereY = targetsSphere[i3 + 1] * breath;
    const sphereZ = targetsSphere[i3 + 2] * breath;

    const poemX = targetsPoem[i3] + jitter[i3] * Math.sin(elapsed + i * 0.03);
    const poemY = targetsPoem[i3 + 1] + jitter[i3 + 1] * Math.cos(elapsed * 1.2 + i * 0.01);
    const poemZ = targetsPoem[i3 + 2] + jitter[i3 + 2] * Math.sin(elapsed * 1.4 + i * 0.02);

    positions[i3] += (THREE.MathUtils.lerp(sphereX, poemX, hoverProgress) - positions[i3]) * 0.12;
    positions[i3 + 1] += (THREE.MathUtils.lerp(sphereY, poemY, hoverProgress) - positions[i3 + 1]) * 0.12;
    positions[i3 + 2] += (THREE.MathUtils.lerp(sphereZ, poemZ, hoverProgress) - positions[i3 + 2]) * 0.12;
  }

  geometry.attributes.position.needsUpdate = true;
  points.rotation.y += 0.003 + hoverProgress * 0.002;
  points.rotation.x = Math.sin(elapsed * 0.3) * 0.12;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

const hint = document.querySelector('.hint');
setInterval(() => {
  hint.style.opacity = hint.style.opacity === '0.35' ? '1' : '0.35';
}, 1200);

const demoLine = document.createElement('div');
demoLine.className = 'demo-line';
demoLine.textContent = 'Demo ready · 把链接发给她，见证“科技魔法”';
Object.assign(demoLine.style, {
  position: 'absolute',
  bottom: '14px',
  left: '14px',
  color: '#8ea6ff',
  fontSize: '12px',
  letterSpacing: '0.08em',
  opacity: '0.8',
});
container.appendChild(demoLine);
