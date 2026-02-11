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

const world = {
  size: 120,
  half: 60,
};

const player = {
  body: new THREE.Group(),
  velocityY: 0,
  eyeHeight: 1.65,
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

function updateHud() {
  scoreEl.textContent = String(gameState.score);
  hitsEl.textContent = String(gameState.hits);
}

function setupLighting() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.52);
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
    new THREE.PlaneGeometry(world.size, world.size),
    new THREE.MeshStandardMaterial({ color: 0x3f8f3b })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(world.size, 24, 0x333333, 0x555555);
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

  wall(world.size + thickness, thickness, 0, -world.half);
  wall(world.size + thickness, thickness, 0, world.half);
  wall(thickness, world.size + thickness, -world.half, 0);
  wall(thickness, world.size + thickness, world.half, 0);
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

  player.body.position.set(0, 0, 8);
  scene.add(player.body);
}

function createTargets() {
  const defs = [
    { x: -25, z: -35, y: 2.5 },
    { x: -10, z: -35, y: 3.1 },
    { x: 5, z: -35, y: 2.7 },
    { x: 20, z: -35, y: 3.4 },
    { x: 30, z: -18, y: 2.6 },
    { x: -28, z: -12, y: 3.0 },
  ];

  for (const def of defs) {
    const target = new THREE.Group();

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, def.y, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5a5a })
    );
    stand.position.y = def.y / 2;
    stand.castShadow = true;
    target.add(stand);

    const board = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.28, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    board.rotation.x = Math.PI / 2;
    board.position.y = def.y + 1.2;
    board.castShadow = true;
    target.add(board);

    const ringRed = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.1, 40),
      new THREE.MeshBasicMaterial({ color: 0xd22121, side: THREE.DoubleSide })
    );
    ringRed.rotation.x = -Math.PI / 2;
    ringRed.position.copy(board.position).add(new THREE.Vector3(0, 0.145, 0));
    target.add(ringRed);

    const ringBlue = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.7, 40),
      new THREE.MeshBasicMaterial({ color: 0x2f73ff, side: THREE.DoubleSide })
    );
    ringBlue.rotation.x = -Math.PI / 2;
    ringBlue.position.copy(board.position).add(new THREE.Vector3(0, 0.146, 0));
    target.add(ringBlue);

    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 40),
      new THREE.MeshBasicMaterial({ color: 0xffdf2f, side: THREE.DoubleSide })
    );
    center.rotation.x = -Math.PI / 2;
    center.position.copy(board.position).add(new THREE.Vector3(0, 0.147, 0));
    target.add(center);

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
  try {
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
  } catch (_) {
    // ignore browser audio restrictions
  }
}

function playHitSound() {
  try {
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
  } catch (_) {
    // ignore browser audio restrictions
  }
}

function spawnHitEffect(position, color = 0xffd85a) {
  const group = new THREE.Group();
  group.position.copy(position);

  const particles = [];
  for (let i = 0; i < 12; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.4,
      (Math.random() - 0.5) * 2
    ).normalize();

    dot.userData.velocity = dir.multiplyScalar(2.4 + Math.random() * 1.6);
    dot.userData.life = 0.38 + Math.random() * 0.16;
    group.add(dot);
    particles.push(dot);
  }

  scene.add(group);
  hitEffects.push({ group, particles });
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
  const idealOffset = new THREE.Vector3(0, 2.2, 5.3);
  const yaw = controls.getObject().rotation.y;

  const offset = idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const desired = player.body.position.clone().add(offset);

  camera.position.lerp(desired, Math.min(1, 10 * delta));
  camera.lookAt(player.body.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
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
    -world.half + 1.5,
    world.half - 1.5
  );
  player.body.position.z = THREE.MathUtils.clamp(
    player.body.position.z,
    -world.half + 1.5,
    world.half - 1.5
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
}

function shoot() {
  if (!controls.isLocked) return;

  playShootSound();

  shootDirection.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  raycaster.set(camera.position, shootDirection);

  const boards = targets.map((x) => x.board);
  const hits = raycaster.intersectObjects(boards, false);

  if (hits.length > 0) {
    const hit = hits[0];
    const distance = hit.distance;
    const board = hit.object;
    const localPoint = board.worldToLocal(hit.point.clone());

    const centerDist = Math.sqrt(localPoint.x * localPoint.x + localPoint.z * localPoint.z);

    let gain = 10;
    if (centerDist < 0.25) gain = 50;
    else if (centerDist < 0.7) gain = 25;

    gameState.score += gain;
    gameState.hits += 1;
    updateHud();

    spawnHitEffect(hit.point, centerDist < 0.25 ? 0xffee66 : 0xff7a38);
    playHitSound();
  } else {
    const missPoint = camera.position
      .clone()
      .add(shootDirection.clone().multiplyScalar(30));
    spawnHitEffect(missPoint, 0xdde8ff);
  }
}

function onStartClick() {
  controls.lock();
}

overlay.addEventListener('click', onStartClick);
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
