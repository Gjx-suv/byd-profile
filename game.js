import * as THREE from 'https://esm.sh/three@0.166.1';
import { PointerLockControls } from 'https://esm.sh/three@0.166.1/examples/jsm/controls/PointerLockControls.js';

const container = document.getElementById('game-container');
const overlay = document.getElementById('start-overlay');
const scoreEl = document.getElementById('score');
const hitsEl = document.getElementById('hits');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fcfff);
scene.fog = new THREE.Fog(0x9fcfff, 90, 340);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.1,
  700
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
container.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const shootDirection = new THREE.Vector3();

const WORLD_SIZE = 220;
const HALF_WORLD = WORLD_SIZE / 2;

const keyState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ShiftLeft: false,
};

const gameState = { score: 0, hits: 0 };

const player = {
  body: new THREE.Group(),
  velocityY: 0,
  moveSpeed: 13,
  sprintSpeed: 21,
  gravity: 26,
  jumpSpeed: 8.8,
  onGround: true,
  leftArm: null,
  rightArm: null,
  weapon: null,
};

const targets = [];
const hitEffects = [];
const bulletTrails = [];
const bulletProjectiles = [];

function updateHud() {
  scoreEl.textContent = String(gameState.score);
  hitsEl.textContent = String(gameState.hits);
}

function makeTexture(size, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const groundTexture = makeTexture(512, (ctx, s) => {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, '#2f7833');
  grad.addColorStop(1, '#1f5a24');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = Math.random() * 1.5;
    ctx.fillStyle = `rgba(${40 + Math.random() * 40}, ${100 + Math.random() * 80}, ${30 + Math.random() * 30}, 0.34)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
});
groundTexture.repeat.set(20, 20);

const clothTexture = makeTexture(256, (ctx, s) => {
  ctx.fillStyle = '#2c3440';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 8) {
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y + Math.random() * 3);
    ctx.stroke();
  }
});
clothTexture.repeat.set(2, 2);

const gunTexture = makeTexture(256, (ctx, s) => {
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#2f3238');
  grad.addColorStop(1, '#17191d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(90,110,140,${0.12 + Math.random() * 0.13})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 8 + Math.random() * 20, 4 + Math.random() * 12);
  }
});

const targetTexture = makeTexture(512, (ctx, s) => {
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, s, s);
  const cx = s / 2;
  const cy = s / 2;
  const rings = [
    [230, '#d72d2d'],
    [180, '#f5f5f5'],
    [130, '#2f73ff'],
    [85, '#f5f5f5'],
    [45, '#ffd839'],
  ];
  for (const [r, color] of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
});

function setupLighting() {
  const hemi = new THREE.HemisphereLight(0xdff2ff, 0x517047, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(80, 110, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  scene.add(sun);
}

function createEnvironment() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.95, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 52),
    new THREE.MeshStandardMaterial({ color: 0x6f6f70, roughness: 0.88 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.02, -24);
  plaza.receiveShadow = true;
  scene.add(plaza);

  const grid = new THREE.GridHelper(WORLD_SIZE, 36, 0x2b2b2b, 0x444444);
  grid.position.y = 0.03;
  grid.material.opacity = 0.33;
  grid.material.transparent = true;
  scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x686868, roughness: 0.9 });
  const wallH = 8;
  const t = 2;
  const addWall = (w, d, x, z) => {
    const wMesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wMesh.position.set(x, wallH / 2, z);
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    scene.add(wMesh);
  };
  addWall(WORLD_SIZE + t, t, 0, -HALF_WORLD);
  addWall(WORLD_SIZE + t, t, 0, HALF_WORLD);
  addWall(t, WORLD_SIZE + t, -HALF_WORLD, 0);
  addWall(t, WORLD_SIZE + t, HALF_WORLD, 0);

  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x58626d, roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(8 + Math.random() * 14, 24 + Math.random() * 28, 8),
      mountainMat
    );
    const angle = (i / 18) * Math.PI * 2;
    const radius = 120 + Math.random() * 25;
    m.position.set(Math.cos(angle) * radius, 12, Math.sin(angle) * radius);
    m.rotation.y = Math.random() * Math.PI;
    m.castShadow = true;
    scene.add(m);
  }

  const towerMat = new THREE.MeshStandardMaterial({ color: 0x83888f, roughness: 0.82 });
  const towerPos = [
    [-45, -40], [-25, -48], [25, -50], [44, -39], [-50, -8], [51, -7],
  ];
  for (const [x, z] of towerPos) {
    const h = 12 + Math.random() * 16;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), towerMat);
    tower.position.set(x, h / 2, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
  }
}

function createPlayerModel() {
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c39f, roughness: 0.8 });
  const clothMat = new THREE.MeshStandardMaterial({ map: clothTexture, roughness: 0.9 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6 });
  const gunMat = new THREE.MeshStandardMaterial({ map: gunTexture, metalness: 0.4, roughness: 0.55 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.3, 0.48), clothMat);
  torso.position.y = 1.3;
  torso.castShadow = true;
  player.body.add(torso);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x2d3f58 }));
  chestPlate.position.set(0, 1.35, 0.28);
  chestPlate.castShadow = true;
  player.body.add(chestPlate);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 10), skinMat);
  neck.position.y = 2.02;
  neck.castShadow = true;
  player.body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 20), skinMat);
  head.position.set(0, 2.28, 0);
  head.castShadow = true;
  player.body.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.345, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), new THREE.MeshStandardMaterial({ color: 0x2e1e18 }));
  hair.position.set(0, 2.37, 0);
  hair.castShadow = true;
  player.body.add(hair);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();

  const upperArmGeo = new THREE.CapsuleGeometry(0.11, 0.36, 6, 10);
  const lowerArmGeo = new THREE.CapsuleGeometry(0.09, 0.32, 6, 10);

  const lUpper = new THREE.Mesh(upperArmGeo, clothMat);
  lUpper.position.y = -0.2;
  lUpper.castShadow = true;
  leftArm.add(lUpper);
  const lLower = new THREE.Mesh(lowerArmGeo, skinMat);
  lLower.position.y = -0.66;
  lLower.castShadow = true;
  leftArm.add(lLower);

  const rUpper = new THREE.Mesh(upperArmGeo, clothMat);
  rUpper.position.y = -0.2;
  rUpper.castShadow = true;
  rightArm.add(rUpper);
  const rLower = new THREE.Mesh(lowerArmGeo, skinMat);
  rLower.position.y = -0.66;
  rLower.castShadow = true;
  rightArm.add(rLower);

  leftArm.position.set(-0.62, 1.8, 0.02);
  rightArm.position.set(0.62, 1.8, 0.02);
  player.body.add(leftArm);
  player.body.add(rightArm);

  const legGeo = new THREE.CapsuleGeometry(0.12, 0.55, 6, 10);
  const leftLeg = new THREE.Mesh(legGeo, clothMat);
  leftLeg.position.set(-0.22, 0.5, 0);
  leftLeg.castShadow = true;
  player.body.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, clothMat);
  rightLeg.position.set(0.22, 0.5, 0);
  rightLeg.castShadow = true;
  player.body.add(rightLeg);

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.14, 0.46), bootMat);
  leftBoot.position.set(-0.22, 0.08, 0.1);
  leftBoot.castShadow = true;
  player.body.add(leftBoot);

  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.14, 0.46), bootMat);
  rightBoot.position.set(0.22, 0.08, 0.1);
  rightBoot.castShadow = true;
  player.body.add(rightBoot);

  const weapon = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 1.4), gunMat);
  body.castShadow = true;
  weapon.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.7, roughness: 0.35 }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 1.05;
  barrel.castShadow = true;
  weapon.add(barrel);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.52), gunMat);
  stock.position.set(0, 0, -0.87);
  stock.castShadow = true;
  weapon.add(stock);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0x0f1114 }));
  sight.position.set(0, 0.15, 0.2);
  sight.castShadow = true;
  weapon.add(sight);

  weapon.position.set(0.44, 1.35, 0.62);
  weapon.rotation.x = -0.12;
  player.body.add(weapon);

  player.leftArm = leftArm;
  player.rightArm = rightArm;
  player.weapon = weapon;

  player.body.position.set(0, 0, 24);
  scene.add(player.body);
}

function createTargets() {
  const defs = [
    { x: -28, z: -48, y: 1.35 },
    { x: -14, z: -50, y: 1.45 },
    { x: 0, z: -52, y: 1.3 },
    { x: 14, z: -50, y: 1.48 },
    { x: 28, z: -48, y: 1.4 },
    { x: -34, z: -30, y: 1.32 },
    { x: 34, z: -30, y: 1.32 },
  ];

  for (const def of defs) {
    const group = new THREE.Group();

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, def.y, 12),
      new THREE.MeshStandardMaterial({ color: 0x686868 })
    );
    stand.position.y = def.y / 2;
    stand.castShadow = true;
    group.add(stand);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.8),
      new THREE.MeshStandardMaterial({ map: targetTexture, side: THREE.DoubleSide })
    );
    board.position.y = def.y + 1.35;
    board.castShadow = true;
    group.add(board);

    group.position.set(def.x, 0, def.z);
    scene.add(group);

    targets.push({ group, board, wobbleSeed: Math.random() * 10 });
  }
}

function playShootSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(530, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.11);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
  setTimeout(() => ctx.close(), 170);
}

function playHitSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(280, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.13);
  setTimeout(() => ctx.close(), 180);
}

function spawnHitEffect(position, color = 0xffd86b) {
  const group = new THREE.Group();
  group.position.copy(position);
  const particles = [];
  for (let i = 0; i < 16; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.3,
      (Math.random() - 0.5) * 2
    ).normalize();
    dot.userData.velocity = dir.multiplyScalar(2.2 + Math.random() * 2.1);
    dot.userData.life = 0.34 + Math.random() * 0.2;
    particles.push(dot);
    group.add(dot);
  }
  scene.add(group);
  hitEffects.push({ group, particles });
}

function spawnBulletTrail(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 0.05) return;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, len, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0a5, transparent: true, opacity: 0.92 })
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  scene.add(mesh);
  bulletTrails.push({ mesh, life: 0.07 });
}

function spawnBulletMesh(from, to) {
  const distance = from.distanceTo(to);
  if (distance < 0.05) return;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3b6 })
  );
  mesh.position.copy(from);
  scene.add(mesh);
  const duration = Math.max(0.06, Math.min(0.33, distance / 120));
  bulletProjectiles.push({ mesh, from: from.clone(), to: to.clone(), t: 0, duration });
}

function getMuzzleWorldPosition() {
  return player.body.localToWorld(new THREE.Vector3(0.55, 1.37, 1.95));
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

function updatePlayerPose(t, moving, sprinting) {
  const walk = moving ? Math.sin(t * (sprinting ? 13 : 8)) : 0;
  const armAmp = moving ? (sprinting ? 0.55 : 0.35) : 0.08;
  const legAmp = moving ? (sprinting ? 0.6 : 0.35) : 0;

  player.leftArm.rotation.x = -0.5 + walk * armAmp;
  player.rightArm.rotation.x = -0.35 - walk * armAmp * 0.9;
  player.leftArm.rotation.z = 0.18;
  player.rightArm.rotation.z = -0.12;

  if (player.weapon) {
    player.weapon.rotation.x = -0.15 + Math.sin(t * 7) * 0.015;
  }

  const leftLeg = player.body.children.find((x) => x.geometry?.type === 'CapsuleGeometry' && x.position.x < 0);
  const rightLeg = player.body.children.find((x) => x.geometry?.type === 'CapsuleGeometry' && x.position.x > 0);
  if (leftLeg && rightLeg) {
    leftLeg.rotation.x = walk * legAmp;
    rightLeg.rotation.x = -walk * legAmp;
  }
}

function updateCameraThirdPerson(delta) {
  const pivot = player.body.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  const desired = pivot.clone().addScaledVector(backward, 5.8).add(new THREE.Vector3(0, 0.95, 0));
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

  const moving = dir.lengthSq() > 0;
  const sprinting = moving && keyState.ShiftLeft;

  if (moving) {
    dir.normalize();
    const speed = sprinting ? player.sprintSpeed : player.moveSpeed;
    player.body.position.addScaledVector(dir, speed * delta);

    const targetYaw = Math.atan2(dir.x, dir.z);
    player.body.rotation.y = THREE.MathUtils.lerp(
      player.body.rotation.y,
      targetYaw,
      Math.min(1, 11 * delta)
    );
  }

  player.velocityY -= player.gravity * delta;
  player.body.position.y += player.velocityY * delta;
  if (player.body.position.y <= 0) {
    player.body.position.y = 0;
    player.velocityY = 0;
    player.onGround = true;
  }

  player.body.position.x = THREE.MathUtils.clamp(player.body.position.x, -HALF_WORLD + 2.2, HALF_WORLD - 2.2);
  player.body.position.z = THREE.MathUtils.clamp(player.body.position.z, -HALF_WORLD + 2.2, HALF_WORLD - 2.2);

  updatePlayerPose(clock.elapsedTime, moving, sprinting);
}

function updateTargets(t) {
  for (const tr of targets) {
    tr.group.rotation.y = Math.sin(t * 1.12 + tr.wobbleSeed) * 0.07;
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
        p.scale.setScalar(Math.max(0.01, p.userData.life * 2.2));
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
    const tr = bulletTrails[i];
    tr.life -= delta;
    tr.mesh.material.opacity = Math.max(0, tr.life / 0.07);
    if (tr.life <= 0) {
      scene.remove(tr.mesh);
      bulletTrails.splice(i, 1);
    }
  }

  for (let i = bulletProjectiles.length - 1; i >= 0; i--) {
    const b = bulletProjectiles[i];
    b.t += delta / b.duration;
    if (b.t >= 1) {
      scene.remove(b.mesh);
      bulletProjectiles.splice(i, 1);
      continue;
    }
    b.mesh.position.lerpVectors(b.from, b.to, b.t);
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
  let finalPoint = camera.position.clone().add(shootDirection.clone().multiplyScalar(64));

  if (hits.length > 0) {
    const hit = hits[0];
    finalPoint = hit.point.clone();

    const uv = hit.uv ?? new THREE.Vector2(0.5, 0.5);
    const dx = uv.x - 0.5;
    const dy = uv.y - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy) * 2.8;

    let gain = 10;
    if (dist < 0.22) gain = 50;
    else if (dist < 0.68) gain = 25;

    gameState.score += gain;
    gameState.hits += 1;
    updateHud();

    spawnHitEffect(finalPoint, dist < 0.22 ? 0xffef77 : 0xff7f3f);
    playHitSound();
  } else {
    spawnHitEffect(finalPoint, 0xdfe8ff);
  }

  const projectileTarget = finalPoint.clone();
  if (muzzlePos.distanceTo(projectileTarget) < 1) {
    projectileTarget.add(shootDirection.clone().multiplyScalar(8));
  }

  spawnBulletTrail(muzzlePos, projectileTarget);
  spawnBulletMesh(muzzlePos, projectileTarget);
}

overlay.addEventListener('click', () => controls.lock());
renderer.domElement.addEventListener('click', () => {
  if (!controls.isLocked) controls.lock();
});

document.addEventListener('mousedown', (event) => {
  if (event.button === 0 && controls.isLocked) shoot();
});

controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

window.addEventListener('keydown', (event) => {
  if (event.code in keyState) keyState[event.code] = true;
  if (event.code === 'Space') {
    event.preventDefault();
    if (player.onGround) {
      player.velocityY = player.jumpSpeed;
      player.onGround = false;
    }
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code in keyState) keyState[event.code] = false;
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

  if (controls.isLocked) {
    updatePlayerMovement(delta);
  } else {
    updatePlayerPose(clock.elapsedTime, false, false);
  }

  updateTargets(clock.elapsedTime);
  updateEffects(delta);
  updateCameraThirdPerson(delta);

  renderer.render(scene, camera);
}

animate();
