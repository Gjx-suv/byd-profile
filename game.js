import * as THREE from 'https://esm.sh/three@0.166.1';
import { PointerLockControls } from 'https://esm.sh/three@0.166.1/examples/jsm/controls/PointerLockControls.js';

const container = document.getElementById('game-container');
const overlay = document.getElementById('start-overlay');
const scoreEl = document.getElementById('score');
const hitsEl = document.getElementById('hits');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dd6ff);
scene.fog = new THREE.Fog(0x9dd6ff, 70, 190);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const shootDirection = new THREE.Vector3();

const WORLD_SIZE = 120;
const HALF_WORLD = WORLD_SIZE / 2;

const player = {
  body: new THREE.Group(),
  velocityY: 0,
  moveSpeed: 13,
  sprintSpeed: 20,
  gravity: 28,
  jumpSpeed: 10,
  onGround: true,
};

const keyState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ShiftLeft: false,
};

const gameState = {
  score: 0,
  hits: 0,
};

const targets = [];
const hitEffects = [];
const bulletTrails = [];
const bulletProjectiles = [];

function updateHud() {
  scoreEl.textContent = String(gameState.score);
  hitsEl.textContent = String(gameState.hits);
}

function createBullseyeTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const rings = [
    { r: 230, color: '#d72828' },
    { r: 180, color: '#f5f5f5' },
    { r: 130, color: '#2f73ff' },
    { r: 85, color: '#f5f5f5' },
    { r: 45, color: '#ffd839' },
  ];

  for (const ring of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
}

function setupLighting() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  scene.add(sun);
}

function createEnvironment() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x3f8f3b })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(WORLD_SIZE, 24, 0x333333, 0x555555);
  grid.position.y = 0.02;
  scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
  const thickness = 1.5;
  const height = 7;

  function wall(w, d, x, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wallMat);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  wall(WORLD_SIZE + thickness, thickness, 0, -HALF_WORLD);
  wall(WORLD_SIZE + thickness, thickness, 0, HALF_WORLD);
  wall(thickness, WORLD_SIZE + thickness, -HALF_WORLD, 0);
  wall(thickness, WORLD_SIZE + thickness, HALF_WORLD, 0);
}

function createPlayerModel() {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x3ba0ff });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), bodyMat);
  torso.position.y = 1.0;
  torso.castShadow = true;
  player.body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), accentMat);
  head.position.set(0, 1.85, 0);
  head.castShadow = true;
  player.body.add(head);

  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  gun.position.set(0.45, 1.2, 0.45);
  gun.castShadow = true;
  player.body.add(gun);

  player.body.position.set(0, 0, 10);
  scene.add(player.body);
}

function createTargets() {
  const bullseye = createBullseyeTexture();
  const targetDefs = [
    { x: -22, z: -34, y: 1.6 },
    { x: -10, z: -34, y: 1.45 },
    { x: 2, z: -34, y: 1.55 },
    { x: 14, z: -34, y: 1.5 },
    { x: 26, z: -34, y: 1.62 },
    { x: -30, z: -20, y: 1.4 },
    { x: 30, z: -20, y: 1.48 },
  ];

  for (const def of targetDefs) {
    const target = new THREE.Group();

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, def.y, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5a5a })
    );
    stand.position.y = def.y / 2;
    stand.castShadow = true;
    target.add(stand);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshStandardMaterial({ map: bullseye, side: THREE.DoubleSide })
    );
    board.position.y = def.y + 1.3;
    board.castShadow = true;
    target.add(board);

    target.position.set(def.x, 0, def.z);
    scene.add(target);

    targets.push({
      group: target,
      board,
      wobbleSeed: Math.random() * 10,
    });
  }
}

function playShootSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(520, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.07);

  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.11);
  setTimeout(() => ctx.close(), 180);
}

function playHitSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.09);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.13);
  setTimeout(() => ctx.close(), 200);
}

function spawnHitEffect(position, color = 0xffd85a) {
  const group = new THREE.Group();
  group.position.copy(position);

  const particles = [];
  for (let i = 0; i < 14; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.4,
      (Math.random() - 0.5) * 2
    ).normalize();

    dot.userData.velocity = dir.multiplyScalar(2.4 + Math.random() * 1.6);
    dot.userData.life = 0.35 + Math.random() * 0.18;
    group.add(dot);
    particles.push(dot);
  }

  scene.add(group);
  hitEffects.push({ group, particles });
}

function spawnBulletTrail(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 0.01) return;

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, len, 8),
    new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 })
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  scene.add(mesh);

  bulletTrails.push({ mesh, life: 0.06 });
}

function spawnBulletMesh(from, to) {
  const distance = from.distanceTo(to);
  if (distance < 0.05) return;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2aa })
  );
  mesh.position.copy(from);
  scene.add(mesh);

  const duration = Math.max(0.06, Math.min(0.35, distance / 120));
  bulletProjectiles.push({
    mesh,
    from: from.clone(),
    to: to.clone(),
    t: 0,
    duration,
  });
}

function getMuzzleWorldPosition() {
  return player.body
    .localToWorld(new THREE.Vector3(0.55, 1.25, 1.15));
}

function getForwardOnGround() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;

  if (forward.lengthSq() < 1e-6) {
    return new THREE.Vector3(0, 0, -1);
  }

  return forward.normalize();
}

function updateCameraThirdPerson(delta) {
  const pivot = player.body.position.clone().add(new THREE.Vector3(0, 1.45, 0));
  const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  const desired = pivot
    .clone()
    .addScaledVector(backward, 5.4)
    .add(new THREE.Vector3(0, 0.9, 0));

  camera.position.lerp(desired, Math.min(1, 12 * delta));
}

function updatePlayerMovement(delta) {
  const moveForward = Number(keyState.KeyW) - Number(keyState.KeyS);
  const moveRight = Number(keyState.KeyD) - Number(keyState.KeyA);

  const forward = getForwardOnGround();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

  const dir = new THREE.Vector3();
  dir.addScaledVector(forward, moveForward);
  dir.addScaledVector(right, moveRight);

  if (dir.lengthSq() > 0) {
    dir.normalize();
    const speed = keyState.ShiftLeft ? player.sprintSpeed : player.moveSpeed;
    player.body.position.addScaledVector(dir, speed * delta);

    const targetYaw = Math.atan2(dir.x, dir.z);
    player.body.rotation.y = THREE.MathUtils.lerp(
      player.body.rotation.y,
      targetYaw,
      Math.min(1, 12 * delta)
    );
  }

  player.velocityY -= player.gravity * delta;
  player.body.position.y += player.velocityY * delta;

  if (player.body.position.y <= 0) {
    player.body.position.y = 0;
    player.velocityY = 0;
    player.onGround = true;
  }

  player.body.position.x = THREE.MathUtils.clamp(
    player.body.position.x,
    -HALF_WORLD + 1.5,
    HALF_WORLD - 1.5
  );
  player.body.position.z = THREE.MathUtils.clamp(
    player.body.position.z,
    -HALF_WORLD + 1.5,
    HALF_WORLD - 1.5
  );
}

function updateTargets(t) {
  for (const tData of targets) {
    const sway = Math.sin(t * 1.2 + tData.wobbleSeed) * 0.08;
    tData.group.rotation.y = sway;
  }
}

function updateEffects(delta) {
  for (let i = hitEffects.length - 1; i >= 0; i--) {
    const fx = hitEffects[i];
    let alive = 0;

    for (const p of fx.particles) {
      p.userData.life -= delta;
      if (p.userData.life > 0) {
        p.position.addScaledVector(p.userData.velocity, delta);
        p.userData.velocity.y -= 7 * delta;
        p.scale.setScalar(Math.max(0.01, p.userData.life * 2.1));
        alive++;
      } else {
        p.visible = false;
      }
    }

    if (alive === 0) {
      scene.remove(fx.group);
      hitEffects.splice(i, 1);
    }
  }

  for (let i = bulletTrails.length - 1; i >= 0; i--) {
    const trail = bulletTrails[i];
    trail.life -= delta;
    trail.mesh.material.opacity = Math.max(0, trail.life / 0.06);
    if (trail.life <= 0) {
      scene.remove(trail.mesh);
      bulletTrails.splice(i, 1);
    }
  }

  for (let i = bulletProjectiles.length - 1; i >= 0; i--) {
    const bullet = bulletProjectiles[i];
    bullet.t += delta / bullet.duration;

    if (bullet.t >= 1) {
      scene.remove(bullet.mesh);
      bulletProjectiles.splice(i, 1);
      continue;
    }

    bullet.mesh.position.lerpVectors(bullet.from, bullet.to, bullet.t);
  }
}

function shoot() {
  if (!controls.isLocked) return;

  playShootSound();

  shootDirection.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  raycaster.set(camera.position, shootDirection);

  const boards = targets.map((t) => t.board);
  const hits = raycaster.intersectObjects(boards, false);

  const muzzlePos = getMuzzleWorldPosition();
  let finalPoint = camera.position.clone().add(shootDirection.clone().multiplyScalar(40));

  if (hits.length > 0) {
    const hit = hits[0];
    finalPoint = hit.point.clone();

    const uv = hit.uv ?? new THREE.Vector2(0.5, 0.5);
    const dx = uv.x - 0.5;
    const dy = uv.y - 0.5;
    const centerDist = Math.sqrt(dx * dx + dy * dy) * 2.6;

    let gain = 10;
    if (centerDist < 0.25) gain = 50;
    else if (centerDist < 0.7) gain = 25;

    gameState.score += gain;
    gameState.hits += 1;
    updateHud();

    spawnHitEffect(hit.point, centerDist < 0.25 ? 0xffee66 : 0xff7a38);
    playHitSound();
  } else {
    spawnHitEffect(finalPoint, 0xdde8ff);
  }

  const projectileTarget = finalPoint.clone();
  if (muzzlePos.distanceTo(projectileTarget) < 0.5) {
    projectileTarget.add(shootDirection.clone().multiplyScalar(8));
  }

  spawnBulletTrail(muzzlePos, projectileTarget);
  spawnBulletMesh(muzzlePos, projectileTarget);
}

overlay.addEventListener('click', () => controls.lock());
renderer.domElement.addEventListener('click', () => {
  if (!controls.isLocked) {
    controls.lock();
  }
});

document.addEventListener('mousedown', (event) => {
  if (event.button === 0 && controls.isLocked) {
    shoot();
  }
});

controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
});

controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
});

window.addEventListener('keydown', (event) => {
  if (event.code in keyState) {
    keyState[event.code] = true;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (player.onGround) {
      player.velocityY = player.jumpSpeed;
      player.onGround = false;
    }
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code in keyState) {
    keyState[event.code] = false;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setupLighting();
createEnvironment();
createPlayerModel();
createTargets();
updateHud();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  if (controls.isLocked) {
    updatePlayerMovement(delta);
  }

  updateTargets(elapsed);
  updateEffects(delta);
  updateCameraThirdPerson(delta);

  renderer.render(scene, camera);
}

animate();
