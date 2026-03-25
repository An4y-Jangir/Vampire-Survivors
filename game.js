import * as THREE from 'three';

// --- INITIALIZATION ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambLight);
const pointLight = new THREE.PointLight(0x00ffff, 5, 100);
scene.add(pointLight);

// --- PLAYER & STATE ---
const playerGeo = new THREE.IcosahedronGeometry(0.8, 0);
const playerMat = new THREE.MeshPhongMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, flatShading: true });
const player = new THREE.Mesh(playerGeo, playerMat);
scene.add(player);

let gameState = {
    hp: 100, xp: 0, lvl: 1, kills: 0,
    bullets: [], enemies: [], particles: [],
    gameOver: false,

    // --- NEW WEAPON STATS ---
    magSize: 5,         // Max bullets
    currentAmmo: 5,     // Current bullets
    isReloading: false,
    reloadStart: 0,
    reloadDuration: 1500 // 1.5 seconds to reload
};

// --- UI UPDATER ---
function updateHUD() {
    document.getElementById('stats').innerText = `KILLS: ${gameState.kills} | LVL: ${gameState.lvl}`;
    document.getElementById('hp-bar').style.width = `${Math.max(0, gameState.hp)}%`;

    const xpNeeded = gameState.lvl * 100;
    document.getElementById('xp-bar').style.width = `${Math.min(100, (gameState.xp / xpNeeded) * 100)}%`;

    // Update Ammo UI
    if (!gameState.isReloading) {
        document.getElementById('ammo-count').innerText = gameState.currentAmmo;
        document.getElementById('ammo-max').innerText = gameState.magSize;
        document.getElementById('ammo-count').style.color = gameState.currentAmmo === 0 ? "#f00" : "#ff0";
    }
}

// --- CORE SYSTEMS ---
function fireBullet(targetPos) {
    const bGeo = new THREE.SphereGeometry(0.2);
    const bMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bGeo, bMat);
    bullet.position.copy(player.position);

    const dir = new THREE.Vector3().subVectors(targetPos, player.position).normalize();
    bullet.userData.velocity = dir.multiplyScalar(0.8);

    scene.add(bullet);
    gameState.bullets.push(bullet);
}

function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const eGeo = new THREE.BoxGeometry(1, 1, 1);
    const eMat = new THREE.MeshPhongMaterial({ color: 0xff0066, emissive: 0x550022 });
    const enemy = new THREE.Mesh(eGeo, eMat);
    enemy.position.set(player.position.x + Math.cos(angle) * 30, 0, player.position.z + Math.sin(angle) * 30);
    scene.add(enemy);
    gameState.enemies.push(enemy);
}

function createExplosion(pos, colorHex = 0xff0066) {
    for (let i = 0; i < 10; i++) {
        const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const pMat = new THREE.MeshBasicMaterial({ color: colorHex });
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.copy(pos);
        p.userData.vel = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(0.3);
        p.userData.life = 1.0;
        scene.add(p);
        gameState.particles.push(p);
    }
}

function startReload() {
    gameState.isReloading = true;
    gameState.reloadStart = Date.now();
    document.getElementById('ammo-count').innerText = "RELOADING";
    document.getElementById('reload-container').style.display = "block";
}

// --- INPUT & RAYCASTING ---
const keys = {};
window.onkeydown = (e) => {
    keys[e.code] = true;
    // Manual Reload with 'R'
    if (e.code === 'KeyR' && !gameState.isReloading && gameState.currentAmmo < gameState.magSize) {
        startReload();
    }
};
window.onkeyup = (e) => keys[e.code] = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    // PREVENT SHOOTING IF RELOADING OR EMPTY
    if (gameState.gameOver || gameState.isReloading || gameState.currentAmmo <= 0) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(gameState.enemies);

    if (intersects.length > 0) {
        fireBullet(intersects[0].object.position);

        // Deduct Ammo
        gameState.currentAmmo--;
        updateHUD();

        // Auto-reload if empty
        if (gameState.currentAmmo <= 0) {
            startReload();
        }
    }
});

// --- MAIN LOOP ---
function update() {
    if (gameState.gameOver) return;

    // Movement
    if (keys['KeyW']) player.position.z -= 0.15;
    if (keys['KeyS']) player.position.z += 0.15;
    if (keys['KeyA']) player.position.x -= 0.15;
    if (keys['KeyD']) player.position.x += 0.15;

    // Handle Reloading Logic
    if (gameState.isReloading) {
        const elapsed = Date.now() - gameState.reloadStart;
        const progress = (elapsed / gameState.reloadDuration) * 100;
        document.getElementById('reload-bar').style.width = `${progress}%`;

        if (elapsed >= gameState.reloadDuration) {
            gameState.isReloading = false;
            gameState.currentAmmo = gameState.magSize; // Refill ammo
            document.getElementById('reload-container').style.display = "none";
            updateHUD();
        }
    }

    // Update Particles & Bullets
    gameState.particles.forEach((p, i) => {
        p.position.add(p.userData.vel);
        p.userData.life -= 0.05;
        p.scale.multiplyScalar(0.9);
        if (p.userData.life <= 0) { scene.remove(p); gameState.particles.splice(i, 1); }
    });

    gameState.bullets.forEach((b, i) => {
        b.position.add(b.userData.velocity);
        if (b.position.distanceTo(player.position) > 50) { scene.remove(b); gameState.bullets.splice(i, 1); }
    });

    // Update Enemies & Collisions
    gameState.enemies.forEach((e, ei) => {
        const dir = new THREE.Vector3().subVectors(player.position, e.position).normalize();
        e.position.add(dir.multiplyScalar(0.04 + (gameState.lvl * 0.005)));
        e.rotation.y += 0.05;

        // Player takes damage
        if (player.position.distanceTo(e.position) < 1.2) {
            gameState.hp -= 15;
            createExplosion(e.position, 0xffffff);
            scene.remove(e); gameState.enemies.splice(ei, 1);
            updateHUD();

            if (gameState.hp <= 0) {
                gameState.gameOver = true;
                document.getElementById('stats').innerText = "GAME OVER!";
                document.getElementById('stats').style.color = "#f00";
            }
        }

        // Bullet hits enemy
        gameState.bullets.forEach((b, bi) => {
            if (b.position.distanceTo(e.position) < 1.2) {
                createExplosion(e.position);
                scene.remove(e); scene.remove(b);
                gameState.enemies.splice(ei, 1); gameState.bullets.splice(bi, 1);

                gameState.kills++;
                gameState.xp += 30;
                const xpNeeded = gameState.lvl * 100;

                // --- LEVEL UP WEAPON LOGIC ---
                if (gameState.xp >= xpNeeded) {
                    gameState.lvl++;
                    gameState.xp -= xpNeeded;
                    gameState.hp = Math.min(100, gameState.hp + 25);

                    // UPGRADE WEAPON! +2 to magazine size
                    gameState.magSize += 2;
                    gameState.currentAmmo = gameState.magSize; // Free instant reload!

                    // Slightly faster reload time at higher levels
                    gameState.reloadDuration = Math.max(500, gameState.reloadDuration - 50);
                }
                updateHUD();
            }
        });
    });

    if (Math.random() < (0.02 + (gameState.lvl * 0.002))) spawnEnemy();

    camera.position.lerp(new THREE.Vector3(player.position.x, 15, player.position.z + 15), 0.1);
    camera.lookAt(player.position);
}

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

updateHUD();
animate();