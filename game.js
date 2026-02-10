import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/PointerLockControls.js';

const container = document.getElementById('game-container');
const hint = document.getElementById('hint');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

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
scene.add(controls.getObject());

hint.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => hint.classList.add('hidden'));
controls.addEventListener('unlock', () => hint.classList.remove('hidden'));

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 5);
scene.add(dirLight);

const MAP_SIZE = 100;
const HALF_MAP = MAP_SIZE / 2;

// 地面
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
  new THREE.MeshStandardMaterial({ color: 0x4e8a3c })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 网格辅助线
const grid = new THREE.GridHelper(MAP_SIZE, 20, 0x444444, 0x666666);
grid.position.y = 0.01;
scene.add(grid);

// 简单边界墙
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

// 几个简单方块障碍物
const boxGeo = new THREE.BoxGeometry(3, 3, 3);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
for (let i = 0; i < 12; i++) {
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set((Math.random() - 0.5) * 70, 1.5, (Math.random() - 0.5) * 70);
  scene.add(box);
}

const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  speed: 25,
  jumpSpeed: 9,
  gravity: 28,
  eyeHeight: 1.8,
  onGround: true,
};

controls.getObject().position.set(0, player.eyeHeight, 10);

const keyState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
};

window.addEventListener('keydown', (e) => {
  if (e.code in keyState) keyState[e.code] = true;

  if (e.code === 'Space' && controls.isLocked && player.onGround) {
    player.velocity.y = player.jumpSpeed;
    player.onGround = false;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in keyState) keyState[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  if (controls.isLocked) {
    // 计算前后左右方向
    player.direction.z = Number(keyState.KeyW) - Number(keyState.KeyS);
    player.direction.x = Number(keyState.KeyD) - Number(keyState.KeyA);
    player.direction.normalize();

    // 水平移动
    const moveDistance = player.speed * delta;
    if (player.direction.z !== 0) {
      controls.moveForward(player.direction.z * moveDistance);
    }
    if (player.direction.x !== 0) {
      controls.moveRight(player.direction.x * moveDistance);
    }

    // 重力与跳跃
    player.velocity.y -= player.gravity * delta;
    controls.getObject().position.y += player.velocity.y * delta;

    if (controls.getObject().position.y <= player.eyeHeight) {
      controls.getObject().position.y = player.eyeHeight;
      player.velocity.y = 0;
      player.onGround = true;
    }

    // 地图边界限制（防止走出去）
    controls.getObject().position.x = THREE.MathUtils.clamp(
      controls.getObject().position.x,
      -HALF_MAP + 1,
      HALF_MAP - 1
    );
    controls.getObject().position.z = THREE.MathUtils.clamp(
      controls.getObject().position.z,
      -HALF_MAP + 1,
      HALF_MAP - 1
    );
  }

  renderer.render(scene, camera);
}

animate();
