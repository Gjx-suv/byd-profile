import * as THREE from 'https://esm.sh/three@0.166.1';
import { PointerLockControls } from 'https://esm.sh/three@0.166.1/examples/jsm/controls/PointerLockControls.js';

const container = document.getElementById('game-container');
const hint = document.getElementById('hint');
const hintText = document.getElementById('hint-text');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 180);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

const MAP_SIZE = 100;
const HALF_MAP = MAP_SIZE / 2;
const PLAYER_RADIUS = 0.8;

const player = {
  velocity: new THREE.Vector3(),
  moveDirection: new THREE.Vector3(),
  moveSpeed: 22,
  jumpSpeed: 9,
  gravity: 28,
  eyeHeight: 1.8,
  onGround: true,
};

camera.position.set(0, player.eyeHeight, 10);

const keyState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
};

function tryLock() {
  controls.lock();
}

hint.addEventListener('click', tryLock);
renderer.domElement.addEventListener('click', () => {
  if (!controls.isLocked) {
    tryLock();
  }
});

controls.addEventListener('lock', () => {
  hint.classList.add('hidden');
});

controls.addEventListener('unlock', () => {
  hint.classList.remove('hidden');
  hintText.textContent = '点击继续（锁定鼠标）';
});

controls.addEventListener('lockerror', () => {
  hint.classList.remove('hidden');
  hintText.textContent = '浏览器阻止锁定鼠标，请先点击页面再试';
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(30, 40, 10);
scene.add(dirLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
  new THREE.MeshStandardMaterial({ color: 0x4e8a3c })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid = new THREE.GridHelper(MAP_SIZE, 20, 0x444444, 0x666666);
grid.position.y = 0.01;
scene.add(grid);

const wallHeight = 6;
const wallThickness = 1;
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6d6d6d });

function createWall(width, depth, x, z) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    wallMaterial
  );
  wall.position.set(x, wallHeight / 2, z);
  scene.add(wall);
}

createWall(MAP_SIZE + wallThickness, wallThickness, 0, -HALF_MAP);
createWall(MAP_SIZE + wallThickness, wallThickness, 0, HALF_MAP);
createWall(wallThickness, MAP_SIZE + wallThickness, -HALF_MAP, 0);
createWall(wallThickness, MAP_SIZE + wallThickness, HALF_MAP, 0);

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
const obstacleDefinitions = [
  [0, 0, 5, 3, 5],
  [-15, -10, 3, 3, 3],
  [18, -14, 4, 4, 4],
  [-20, 18, 6, 3, 4],
  [22, 16, 3, 5, 3],
  [6, -25, 8, 3, 3],
];

for (const [x, z, w, h, d] of obstacleDefinitions) {
  const obstacle = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    obstacleMaterial
  );
  obstacle.position.set(x, h / 2, z);
  scene.add(obstacle);
}

window.addEventListener('keydown', (event) => {
  if (event.code in keyState) {
    keyState[event.code] = true;
  }

  if (event.code === 'Space') {
    event.preventDefault();

    if (controls.isLocked && player.onGround) {
      player.velocity.y = player.jumpSpeed;
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

const clock = new THREE.Clock();

function updateMovement(deltaTime) {
  player.moveDirection.z = Number(keyState.KeyW) - Number(keyState.KeyS);
  player.moveDirection.x = Number(keyState.KeyD) - Number(keyState.KeyA);
  player.moveDirection.normalize();

  const moveDistance = player.moveSpeed * deltaTime;

  if (player.moveDirection.z !== 0) {
    controls.moveForward(player.moveDirection.z * moveDistance);
  }

  if (player.moveDirection.x !== 0) {
    controls.moveRight(player.moveDirection.x * moveDistance);
  }

  player.velocity.y -= player.gravity * deltaTime;
  camera.position.y += player.velocity.y * deltaTime;

  if (camera.position.y <= player.eyeHeight) {
    camera.position.y = player.eyeHeight;
    player.velocity.y = 0;
    player.onGround = true;
  }

  camera.position.x = THREE.MathUtils.clamp(
    camera.position.x,
    -HALF_MAP + PLAYER_RADIUS,
    HALF_MAP - PLAYER_RADIUS
  );
  camera.position.z = THREE.MathUtils.clamp(
    camera.position.z,
    -HALF_MAP + PLAYER_RADIUS,
    HALF_MAP - PLAYER_RADIUS
  );
}

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = Math.min(clock.getDelta(), 0.1);

  if (controls.isLocked) {
    updateMovement(deltaTime);
  }

  renderer.render(scene, camera);
}

animate();
