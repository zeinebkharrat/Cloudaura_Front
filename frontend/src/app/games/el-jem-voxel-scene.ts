import * as THREE from 'three';

export function mountElJemVoxelScene(
  container: HTMLElement,
  zone: { runOutsideAngular: (fn: () => void) => void },
): { destroy: () => void; resize: () => void; getPlayerPos: () => { x: number; z: number } } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Bright Minecraft Sky
  scene.fog = new THREE.Fog(0x87ceeb, 40, 160);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(35, 1.8, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // High Fidelity Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(50, 80, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);

  // Materials & Geometry
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const matSand = new THREE.MeshStandardMaterial({ color: 0xead9b6, roughness: 0.9 });
  const matStone = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.7 });
  const matStoneDark = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0xae604c, roughness: 1.0 });
  const matOlive = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.4 });
  const matTrunk = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });

  const world = new THREE.Group();
  scene.add(world);

  // Player Entity (Invisible in First Person)
  const player = new THREE.Group();
  player.position.set(35, 0, 0); 
  scene.add(player);

  // Advanced Weapon System Models
  const weaponGroup = new THREE.Group();
  camera.add(weaponGroup);
  scene.add(camera);

  const createModel = (parts: { pos: number[], scale: number[], color: number }[]) => {
    const g = new THREE.Group();
    parts.forEach(p => {
        const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: p.color }));
        m.position.set(p.pos[0], p.pos[1], p.pos[2]);
        m.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        m.castShadow = true;
        g.add(m);
    });
    return g;
  };

  const createVoxelSprite = (pattern: string[], colors: Record<string, number>, scale = 0.08) => {
    const g = new THREE.Group();
    const rows = pattern.length;
    const cols = pattern[0].length;
    
    for (let r = 0; r < rows; r++) {
       for (let c = 0; c < cols; c++) {
           const char = pattern[r][c];
           if (char === '.' || char === ' ') continue;
           const mat = new THREE.MeshStandardMaterial({ color: colors[char] || 0xffffff });
           const m = new THREE.Mesh(boxGeo, mat);
           m.position.set((c - cols/2) * scale, (rows/2 - r) * scale, 0);
           m.scale.set(scale, scale, scale);
           g.add(m);
       }
    }
    // Positioning for better FPS view
    g.position.set(0.6, -0.6, -1.2);
    g.rotation.set(0, -Math.PI / 4, Math.PI / 8); 
    return g;
  };

  const swordPattern = [
    "............XX..",
    "...........XOXX.",
    "..........XOX..." ,
    ".........XOX...." ,
    "........XOX....." ,
    ".......XOX......" ,
    "......XOX......." ,
    ".....XOX........" ,
    "....XOX........." ,
    "...XXX.........." ,
    "..XHHX.........." ,
    ".X.HHX.........." ,
    "....X..........." ,
  ];
  
  const hammerPattern = [
    ".......XXXXX....",
    "......XOOOOOXX..",
    "......XOOOOOOOX.",
    ".......XXXXXXOX.",
    "..........XOX...",
    ".........XHX....",
    "........XHX.....",
    ".......XHX......",
  ];

  const spearPattern = [
    "...............X",
    "..............XX",
    ".............XO.",
    "............XO..",
    "...........XH...",
    "..........XH....",
    ".........XH.....",
    "........XH......",
    ".......XH.......",
  ];

  const colorsStone = { 'X': 0x333333, 'O': 0xbdc3c7, 'H': 0x5d4037 };
  const colorsElite = { 'X': 0x000000, 'O': 0x334155, 'H': 0x000000 };
  const colorsWood  = { 'X': 0x3e2723, 'O': 0x5d4037, 'H': 0x5d4037 };
  const colorsNature = { 'X': 0x1b5e20, 'O': 0x556b2f, 'H': 0x5d4037 };

  const models: Record<string, THREE.Group> = {
    'hand': createModel([{ pos: [0.3, -0.4, -0.5], scale: [0.18, 0.18, 0.6], color: 0xffdbac }]),
    'STONE_SWORD': createVoxelSprite(swordPattern, colorsStone),
    'ELITE_BLADE': createVoxelSprite(swordPattern, colorsElite),
    'HEAVY_HAMMER': createVoxelSprite(hammerPattern, colorsStone),
    'NATURE_SPEAR': createVoxelSprite(spearPattern, colorsNature),
    'REINFORCED_CLUB': createVoxelSprite(swordPattern, colorsWood)
  };

  Object.values(models).forEach(m => {
    m.visible = false;
    weaponGroup.add(m);
  });
  models['hand'].visible = true;

  const showWeapon = (name: string) => {
      Object.keys(models).forEach(k => models[k].visible = (k === name));
      if (!models[name]) models['hand'].visible = true;
  };

  // 3D Voxel Clouds
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 25; i++) {
    const cx = (Math.random() - 0.5) * 250;
    const cz = (Math.random() - 0.5) * 250;
    const cw = 15 + Math.random() * 20;
    const cd = 10 + Math.random() * 30;
    const cloud = new THREE.Mesh(boxGeo, cloudMat);
    cloud.scale.set(cw, 3, cd);
    cloud.position.set(cx, 45 + Math.random() * 10, cz);
    clouds.add(cloud);
  }
  scene.add(clouds);

  // Global State
  let isLocked = false;
  let yaw = 0; let pitch = 0;
  const velocity = new THREE.Vector3();
  let canJump = false;
  let isMining = false;

  // Interaction State
  const activeDrops: { mesh: THREE.Mesh; material: any }[] = [];
  const zombies: { mesh: THREE.Group; hp: number; lastAttack: number }[] = [];
  const raycaster = new THREE.Raycaster();

  // Weapon System
  let currentWeaponStats = { damage: 1, knockback: 1, mat: 'WOOD' };
  (window as any)._ej_update_weapon = (stats: any) => {
      currentWeaponStats = stats;
      showWeapon(stats.name);
  };

  const meshes: { mesh: THREE.Mesh; targetScale: THREE.Vector3; delay: number }[] = [];
  const collidables: THREE.Box3[] = [];
  const startTime = performance.now();

  const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, cast = true) => {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    const targetScale = new THREE.Vector3(sx, sy, sz);
    m.scale.set(0.0001, 0.0001, 0.0001); 
    m.castShadow = cast; m.receiveShadow = true;
    world.add(m);
    if (y > -0.5) {
      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(x, y, z), new THREE.Vector3(sx, sy, sz));
      collidables.push(box);
    }
    meshes.push({ mesh: m, targetScale, delay: Math.random() * 300 }); 
  };

  container.addEventListener('contextmenu', (e) => e.preventDefault());

  container.addEventListener('mousedown', (e) => {
    if (!isLocked) {
        container.requestPointerLock();
        return;
    }
    
    const pos = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    
    // 1. Treasure Interaction
    const distToCenter = new THREE.Vector2(pos.x, pos.z).length();
    if (distToCenter < 3.0 && (window as any)._ej_kill_count >= 20) {
        (window as any)._ej_on_win?.();
        const flash = document.createElement('div');
        flash.style.position = 'fixed'; flash.style.inset = '0'; flash.style.background = 'white'; flash.style.zIndex = '9999';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 100);
        return;
    }

    raycaster.set(pos, dir);
    const intersects = raycaster.intersectObjects(world.children, true);
    const zombieIntersects = raycaster.intersectObjects(zombies.map(z => z.mesh), true);

    if (e.button === 0) { // Left click: Mine or Attack
        isMining = true;
        if (zombieIntersects.length > 0) {
            const hit = zombieIntersects[0];
            if (hit.distance < 8) {
                const zombieMesh = hit.object.parent as THREE.Group;
                const zIdx = zombies.findIndex(z => z.mesh === zombieMesh);
                if (zIdx !== -1) {
                    zombies[zIdx].hp -= currentWeaponStats.damage;
                    (zombies[zIdx] as any).hurtTime = performance.now();
                    const kbFactor = currentWeaponStats.knockback;
                    const kb = zombieMesh.position.clone().sub(player.position).normalize().multiplyScalar(1 * kbFactor);
                    zombieMesh.position.add(kb);
                    
                    if (zombies[zIdx].hp <= 0) {
                        scene.remove(zombies[zIdx].mesh);
                        zombies.splice(zIdx, 1);
                        (window as any)._ej_on_kill?.(); 
                    }
                    return;
                }
            }
        }

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < 8) {
                const obj = hit.object as THREE.Mesh;
                if (obj.position.y <= -0.9) return;
                if (!obj.userData['hp']) obj.userData['hp'] = 3;
                obj.userData['hp'] -= currentWeaponStats.damage;
                obj.scale.multiplyScalar(0.9);
                setTimeout(() => { if (obj.parent) obj.scale.copy((meshes.find(m => m.mesh === obj)?.targetScale) || new THREE.Vector3(1,1,1)); }, 50);
                if (obj.userData['hp'] <= 0) {
                    const drop = obj.clone();
                    drop.scale.set(0.25, 0.25, 0.25);
                    scene.add(drop);
                    activeDrops.push({ mesh: drop, material: obj.material });
                    const idx = meshes.findIndex(m => m.mesh === obj);
                    if (idx !== -1) meshes.splice(idx, 1);
                    const cIdx = collidables.findIndex(b => b.containsPoint(obj.position));
                    if (cIdx !== -1) collidables.splice(cIdx, 1);
                    world.remove(obj);
                }
            }
        }
    } else if (e.button === 2) { // Right click: Build
        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < 10) {
                const chosen = (window as any)._ej_get_selected_mat?.();
                if (!chosen) return;
                const bpos = hit.point.clone().add(hit.face!.normal.clone().multiplyScalar(0.5));
                bpos.x = Math.round(bpos.x); bpos.y = Math.round(bpos.y); bpos.z = Math.round(bpos.z);
                if (bpos.distanceTo(player.position) < 1.2) return;
                const mat = chosen === 'CARREAUX' ? matStoneDark : (chosen === 'WOOD' ? matTrunk : (chosen === 'HERBES' ? matOlive : matStone));
                addBox(bpos.x, bpos.y, bpos.z, 1, 1, 1, mat);
                (window as any)._ej_item_use?.(chosen);
            }
        }
    }
  });

  container.addEventListener('mouseup', () => isMining = false);
  document.addEventListener('pointerlockchange', () => isLocked = document.pointerLockElement === container);
  container.addEventListener('mousemove', (e) => {
    if (!isLocked) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
  });

  const keys: Record<string, boolean> = {};
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if ([' ', 'space', 'w', 's', 'a', 'd', 'z', 'q'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

  const addPalm = (px: number, pz: number) => {
    const h = 3 + Math.random() * 2;
    addBox(px, h / 2, pz, 0.6, h, 0.6, matTrunk);
    addBox(px, h + 0.2, pz, 3.5, 0.4, 3.5, matOlive);
  };

  const addRuin = (rx: number, rz: number) => {
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const h = 0.4 + Math.random() * 0.8;
        addBox(rx + (Math.random()-0.5)*3, h/2, rz + (Math.random()-0.5)*3, 0.8, h, 0.8, matStone);
    }
  };

  const addColumn = (cx: number, cz: number) => {
    const h = 2 + Math.random() * 3;
    const broken = Math.random() > 0.5;
    const finalH = broken ? h * 0.4 : h;
    addBox(cx, finalH/2, cz, 1.2, finalH, 1.2, matStone);
    if (!broken) addBox(cx, finalH + 0.2, cz, 1.6, 0.4, 1.6, matStone);
  };

  const addBush = (bx: number, bz: number) => addBox(bx, 0.2, bz, 0.8, 0.4, 0.8, matOlive);

  const spawnZombie = () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 20;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const group = new THREE.Group();
    const zombieMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
    const body = new THREE.Mesh(boxGeo, zombieMat);
    body.scale.set(0.6, 0.7, 0.35); body.position.y = 1.05; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x4a7a44 }));
    head.scale.set(0.4, 0.4, 0.4); head.position.y = 1.6; group.add(head);
    const limbGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const limbs: any = {};
    [['armL', -0.4, 1.2], ['armR', 0.4, 1.2], ['legL', -0.15, 0.3], ['legR', 0.15, 0.3]].forEach(p => {
        const l = new THREE.Mesh(limbGeo, zombieMat);
        l.position.set(p[1] as number, p[2] as number, 0);
        group.add(l); limbs[p[0] as string] = l;
    });
    group.position.set(x, 0, z);
    scene.add(group);
    zombies.push({ mesh: group, hp: 3, lastAttack: 0, limbs, hurtTime: 0 } as any);
  };

  const addTreasure = () => {
    const tGroup = new THREE.Group();
    const chest = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xDAA520, metalness: 0.8, roughness: 0.2 }));
    chest.scale.set(1.5, 1.2, 1); chest.position.y = 0.6; tGroup.add(chest);
    const lid = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xB8860B }));
    lid.scale.set(1.6, 0.3, 1.1); lid.position.y = 1.2; tGroup.add(lid);
    tGroup.position.set(0, 0, 0); scene.add(tGroup);
    const pLight = new THREE.PointLight(0xFFD700, 2, 10); pLight.position.y = 2; tGroup.add(pLight);
  };
  addTreasure();

  addBox(0, -1, 0, 250, 2, 250, matSand, false);
  const arenaA = 11; const arenaB = 8;
  for (let x = -arenaA; x <= arenaA; x += 2) {
    for (let z = -arenaB; z <= arenaB; z += 2) {
      if ((x/arenaA)**2 + (z/arenaB)**2 <= 1.05) {
          const isCheck = (Math.round(x/2) + Math.round(z/2)) % 2 === 0;
          addBox(x, -0.6, z, 1.9, 0.8, 1.9, isCheck ? matSand : matStoneDark);
      }
    }
  }

  const entrances: THREE.Vector3[] = [];
  const rings = [{ a:13, b:10, h:6, mat:matStoneDark, steps:60 }, { a:16.5, b:13, h:5, mat:matStone, steps:64 }];
  for (const ring of rings) {
    for (let i = 0; i < ring.steps; i++) {
        const t = (i / ring.steps) * Math.PI * 2;
        const x = Math.cos(t) * ring.a; const z = Math.sin(t) * ring.b;
        const arch = i % 10 < 3;
        if (arch && entrances.length < ring.steps/10) entrances.push(new THREE.Vector3(x, 0, z));
        for (let ly = 0; ly < ring.h; ly++) {
            if (arch && ly < 3) continue;
            addBox(x, 0.5 + ly * 1.1, z, 2.3, 1.0, 2.3, ring.mat);
        }
        if (i % 20 === 0) {
            addBox(x * 0.85, 1, z * 0.85, 0.5, 3, 0.5, matTrunk);
            addBox(x * 0.85, 3, z * 0.85, 4, 0.2, 1, matTrunk);
        }
    }
  }

  for (let i = 0; i < 100; i++) {
    const ang = Math.random() * Math.PI * 2; const dist = 30 + Math.random() * 90;
    addPalm(Math.cos(ang) * dist, Math.sin(ang) * dist);
  }
  for (let i = 0; i < 150; i++) {
    const ang = Math.random() * Math.PI * 2; const dist = 25+Math.random()*80;
    const rx = Math.cos(ang)*dist; const rz = Math.sin(ang)*dist;
    const rng = Math.random();
    if (rng > 0.7) addColumn(rx, rz); else if (rng > 0.3) addRuin(rx, rz); else addBush(rx, rz);
  }

  const playerBox = new THREE.Box3();
  const playerSize = new THREE.Vector3(0.4, 1.8, 0.4);
  let lastTime = performance.now();
  let raf = 0;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    const elapsed = time - startTime;

    const inputDir = new THREE.Vector3();
    const moveSpeed = 12; const jumpForce = 8; const gravity = 22;
    if (keys['w'] || keys['z']) inputDir.z -= 1; if (keys['s']) inputDir.z += 1;
    if (keys['a'] || keys['q']) inputDir.x -= 1; if (keys['d']) inputDir.x += 1;
    inputDir.normalize().applyEuler(new THREE.Euler(0, yaw, 0));
    velocity.y -= gravity * delta;
    if (canJump && (keys[' '] || keys['space'])) { velocity.y = jumpForce; canJump = false; }
    const frameMove = inputDir.multiplyScalar(moveSpeed * delta);
    const nextPos = player.position.clone().add(frameMove).add(new THREE.Vector3(0, velocity.y * delta, 0));
    playerBox.setFromCenterAndSize(new THREE.Vector3(nextPos.x, nextPos.y + 0.9, nextPos.z), playerSize);
    let collision = false;
    for (const wall of collidables) { if (playerBox.intersectsBox(wall)) { collision = true; break; } }
    if (!collision) player.position.copy(nextPos);
    if (player.position.y <= 0) { player.position.y = 0; velocity.y = 0; canJump = true; }

    camera.position.set(player.position.x, player.position.y + 1.7, player.position.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    for (let i = activeDrops.length - 1; i >= 0; i--) {
        const d = activeDrops[i]; d.mesh.rotation.y += 0.05;
        const dist = d.mesh.position.distanceTo(player.position);
        if (dist < 10) {
            d.mesh.position.add(player.position.clone().sub(d.mesh.position).normalize().multiplyScalar(0.15));
            if (dist < 1.2) { (window as any)._ej_item_collect?.(d.material); scene.remove(d.mesh); activeDrops.splice(i, 1); }
        }
    }

    const swing = isMining ? Math.abs(Math.sin(time * 25)) * 0.4 : 0;
    weaponGroup.position.y = -0.42 + Math.sin(time * 0.003) * 0.005 - swing;
    weaponGroup.rotation.x = swing * 1.5;
    if (inputDir.lengthSq() > 0) { weaponGroup.position.y += Math.sin(time * 0.012) * 0.02; weaponGroup.position.x = 0.3 + Math.cos(time * 0.006) * 0.01; }

    for (const item of meshes) {
      if (elapsed > item.delay) {
        const t = Math.min(1, (elapsed - item.delay) / 600);
        item.mesh.scale.lerpVectors(new THREE.Vector3(0,0,0), item.targetScale, 1 - Math.pow(1 - t, 3));
      }
    }

    const isCombatPhase = elapsed > 120000;
    const canSpawn = isCombatPhase && (zombies.length < 10) && ( (window as any)._ej_spawned_count || 0) < 20;
    if (canSpawn && Math.random() < 0.01) {
        spawnZombie(); (window as any)._ej_spawned_count = ((window as any)._ej_spawned_count || 0) + 1;
    }

    const zombieBox = new THREE.Box3(); const zombieSize = new THREE.Vector3(0.6, 1.8, 0.4);
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i] as any;
        let targetPos = new THREE.Vector3(0, 0, 0); const distToCenter = z.mesh.position.length();
        if (distToCenter > 18) {
            let nearestEnt = entrances[0]; let minDist = 999;
            entrances.forEach(e => { const d = z.mesh.position.distanceTo(e); if (d < minDist) { minDist = d; nearestEnt = e; } });
            targetPos = nearestEnt.clone();
        }
        const avoidDir = targetPos.clone().sub(z.mesh.position).normalize();
        const isAttacking = (time - z.lastAttack < 500);
        const moveStep = (isAttacking ? 6 : 3) * delta;
        const nextZPos = z.mesh.position.clone().add(avoidDir.clone().multiplyScalar(moveStep));
        zombieBox.setFromCenterAndSize(new THREE.Vector3(nextZPos.x, nextZPos.y + 0.9, nextZPos.z), zombieSize);
        let zCollision = false;
        for (const wall of collidables) { if (zombieBox.intersectsBox(wall)) { zCollision = true; break; } }
        if (!zCollision) { z.mesh.position.copy(nextZPos); z.mesh.lookAt(z.mesh.position.clone().add(avoidDir)); }
        if (time - z.hurtTime < 200) z.mesh.traverse((c: any) => c.material?.emissive?.setHex(0xff0000));
        else z.mesh.traverse((c: any) => c.material?.emissive?.setHex(0x000000));
        if (z.mesh.position.length() < 2 && time - z.lastAttack > 2000) { z.lastAttack = time; (window as any)._ej_on_damage_treasure?.(); }
        if (z.mesh.position.distanceTo(player.position) < 1.5 && time - z.lastAttack > 1500) {
            z.lastAttack = time; (window as any)._ej_on_take_damage?.(); velocity.y = 3; yaw += (Math.random() - 0.5) * 0.1;
        }
        const walkCycle = Math.sin(time * 0.05);
        z.limbs.legL.rotation.x = walkCycle * 0.5; z.limbs.legR.rotation.x = -walkCycle * 0.5;
    }
    renderer.render(scene, camera);
  };
  zone.runOutsideAngular(() => tick());

  const resize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  setTimeout(resize, 100);
  
  return {
    resize,
    getPlayerPos: () => ({ x: player.position.x, z: player.position.z }),
    destroy: () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      renderer.dispose(); boxGeo.dispose();
      [matSand, matStone, matStoneDark, matRoof, matOlive, matTrunk].forEach(m => m.dispose());
    },
  };
}
