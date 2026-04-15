// ========================================
// SHADOW LEAP — Main JavaScript (Three.js + Interactions)
// ========================================

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ---- Globals ----
let scene, camera, renderer, mixer, character, clock;
let animationAction = null;
const keys = {};
const characterSpeed = 3.5;
const characterRotationSpeed = 5;
let targetRotation = 0;
let isLoaded = false;
const CHARACTER_TARGET_HEIGHT = 1.8;

// ---- DOM References ----
const canvas = document.getElementById('three-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loaderBar = document.getElementById('loader-bar');
const loaderText = document.getElementById('loader-text');

// ---- Initialize Three.js ----
function initThree() {
    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf5f7ff, 0.02);

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2.5, 7);
    camera.lookAt(0, 1.2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lights
    setupLights();

    // Ground
    setupGround();

    // Load FBX Character
    loadCharacter();

    // Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

    // Start render loop
    animate();
}

// ---- Lights ----
function setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x8a64ff, 0x0a0a0f, 0.5);
    scene.add(hemi);

    // Main directional (key light)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Accent rim light (purple) from back-left
    const rimLight1 = new THREE.DirectionalLight(0x8a64ff, 1.25);
    rimLight1.position.set(-4, 4, -3);
    scene.add(rimLight1);

    // Accent fill light (cyan) from right
    const rimLight2 = new THREE.DirectionalLight(0x00e5ff, 0.9);
    rimLight2.position.set(4, 2, -2);
    scene.add(rimLight2);

    // Front fill light focused on the hero so dark FBX materials remain readable.
    const frontFill = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 5, 0.45, 1.2);
    frontFill.position.set(0, 5.5, 6.5);
    frontFill.target.position.set(0, 1, 0);
    frontFill.castShadow = false;
    scene.add(frontFill);
    scene.add(frontFill.target);

    // Spot light for dramatic ground lighting
    const spot = new THREE.SpotLight(0x8a64ff, 2, 20, Math.PI / 6, 0.5, 1);
    spot.position.set(0, 10, 0);
    spot.target.position.set(0, 0, 0);
    scene.add(spot);
    scene.add(spot.target);

    // Point lights for atmosphere
    const pointLight1 = new THREE.PointLight(0x8a64ff, 1, 15);
    pointLight1.position.set(-5, 1, 2);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x00e5ff, 0.5, 15);
    pointLight2.position.set(5, 1, -2);
    scene.add(pointLight2);
}

// ---- Ground ----
function setupGround() {
    // Ground plane with grid-like reflective surface
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f7ff,
        metalness: 0.2,
        roughness: 0.85,
        transparent: true,
        opacity: 0.92,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper for cyberpunk effect
    const gridHelper = new THREE.GridHelper(40, 40, 0xb7bde0, 0xd8dcf0);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.45;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Glow ring under character
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x8a64ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.name = 'glowRing';
    scene.add(ring);

    // Floating particles in 3D scene
    const particleCount = 100;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = Math.random() * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
        color: 0x8a64ff,
        size: 0.05,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    particles.name = 'sceneParticles';
    scene.add(particles);
}

// ---- Load FBX Character ----
function loadCharacter() {
    updateLoader(10, 'Loading character model...');

    const loader = new FBXLoader();
    loader.load(
        'Jump.fbx',
        (object) => {
            character = object;
            character.scale.setScalar(1);
            character.position.set(0, 0, 0);

            // Normalize imported FBX so it is always visible regardless of source units/pivot.
            fitCharacterToScene(character);

            // Setup materials and shadows
            character.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Enhance materials
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach((mat, index) => {
                            const tunedMat = tuneMaterialForVisibility(mat, child);
                            if ('metalness' in tunedMat) tunedMat.metalness = 0.15;
                            if ('roughness' in tunedMat) tunedMat.roughness = 0.7;
                            if ('envMapIntensity' in tunedMat) tunedMat.envMapIntensity = 0.6;
                            if ('emissiveIntensity' in tunedMat) tunedMat.emissiveIntensity = 0.08;
                            tunedMat.needsUpdate = true;
                            materials[index] = tunedMat;
                        });
                        child.material = Array.isArray(child.material) ? materials : materials[0];
                    }
                }
            });

            scene.add(character);

            // Setup animation
            if (object.animations && object.animations.length > 0) {
                mixer = new THREE.AnimationMixer(character);
                animationAction = mixer.clipAction(object.animations[0]);
                animationAction.play();
            }

            updateLoader(100, 'Ready!');
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                isLoaded = true;
            }, 600);
        },
        (progress) => {
            if (progress.lengthComputable) {
                const pct = Math.round((progress.loaded / progress.total) * 80) + 10;
                updateLoader(pct, 'Loading character model...');
            }
        },
        (error) => {
            console.error('Error loading FBX:', error);
            updateLoader(100, 'Loading complete (no model)');
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                isLoaded = true;
            }, 600);
        }
    );
}

function fitCharacterToScene(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.y > 0) {
        const scale = CHARACTER_TARGET_HEIGHT / size.y;
        model.scale.setScalar(scale);
    }

    // Recompute bounds after scaling and move pivot to center X/Z with feet on y=0.
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;
}

function tuneMaterialForVisibility(material, mesh) {
    let tuned = material;

    // FBX files often ship with unlit/basic materials that look black under tone mapping.
    if (material && material.isMeshBasicMaterial) {
        tuned = new THREE.MeshStandardMaterial({
            color: material.color ? material.color.clone() : new THREE.Color(0xc6d0e6),
            map: material.map || null,
            transparent: Boolean(material.transparent),
            opacity: material.opacity ?? 1,
            side: material.side ?? THREE.FrontSide,
            skinning: Boolean(mesh.isSkinnedMesh),
        });
    }

    if (tuned && 'map' in tuned && tuned.map) {
        tuned.map.colorSpace = THREE.SRGBColorSpace;
    }

    if (tuned && 'color' in tuned && tuned.color) {
        const color = tuned.color;
        const darkest = Math.max(color.r, color.g, color.b) < 0.08;
        if (darkest) {
            // Neutral bright tint keeps character readable if source model color is pure black.
            color.set(0xc6d0e6);
        }
    }

    return tuned;
}

function updateLoader(percent, text) {
    loaderBar.style.width = percent + '%';
    loaderText.textContent = text;
}

// ---- Animation Loop ----
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Update animation mixer
    if (mixer) {
        mixer.update(delta);
    }

    // Character movement via WASD / Arrow Keys
    if (character && isLoaded) {
        let moveX = 0;
        let moveZ = 0;

        if (keys['w'] || keys['arrowup']) moveZ -= 1;
        if (keys['s'] || keys['arrowdown']) moveZ += 1;
        if (keys['a'] || keys['arrowleft']) moveX -= 1;
        if (keys['d'] || keys['arrowright']) moveX += 1;

        if (moveX !== 0 || moveZ !== 0) {
            // Normalize direction
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length;
            moveZ /= length;

            // Move character
            character.position.x += moveX * characterSpeed * delta;
            character.position.z += moveZ * characterSpeed * delta;

            // Clamp to reasonable bounds
            character.position.x = THREE.MathUtils.clamp(character.position.x, -8, 8);
            character.position.z = THREE.MathUtils.clamp(character.position.z, -5, 5);

            // Rotate character to face direction of movement
            targetRotation = Math.atan2(moveX, moveZ);
            character.rotation.y = THREE.MathUtils.lerp(
                character.rotation.y,
                targetRotation,
                characterRotationSpeed * delta
            );

            // Speed up animation when moving
            if (animationAction) {
                animationAction.timeScale = THREE.MathUtils.lerp(animationAction.timeScale, 1.5, 0.1);
            }
        } else {
            // Slow down animation when idle
            if (animationAction) {
                animationAction.timeScale = THREE.MathUtils.lerp(animationAction.timeScale, 1.0, 0.05);
            }
        }

        // Update glow ring to follow character
        const ring = scene.getObjectByName('glowRing');
        if (ring) {
            ring.position.x = character.position.x;
            ring.position.z = character.position.z;
            ring.material.opacity = 0.2 + Math.sin(elapsed * 2) * 0.1;
            ring.rotation.z = elapsed * 0.3;
        }

        // Camera follows character slightly
        const camTargetX = character.position.x * 0.15;
        const camTargetZ = character.position.z * 0.1;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.02);
        camera.lookAt(
            THREE.MathUtils.lerp(0, character.position.x * 0.3, 0.02),
            1.2,
            THREE.MathUtils.lerp(0, character.position.z * 0.2, 0.02)
        );
    }

    // Animate scene particles
    const particles = scene.getObjectByName('sceneParticles');
    if (particles) {
        particles.rotation.y = elapsed * 0.02;
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(elapsed + i) * 0.002;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

// ---- Resize Handler ----
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---- UI Interactions ----
function initUI() {
    // Navigation scroll effect
    const nav = document.getElementById('main-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        // Update active nav link based on scroll position
        updateActiveNavLink();
    });

    // Smooth scroll for nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Scroll indicator click
    document.getElementById('scroll-indicator').addEventListener('click', () => {
        document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    });

    // Generate floating particles in hero
    createHeroParticles();

    // Scroll reveal for sections
    setupScrollReveal();

    // Animate stats on scroll
    setupStatsAnimation();
}

function updateActiveNavLink() {
    const sections = ['hero', 'features', 'gameplay', 'cta'];
    const scrollPos = window.scrollY + window.innerHeight / 3;

    sections.forEach(id => {
        const section = document.getElementById(id);
        const link = document.getElementById('nav-' + id);
        if (section && link) {
            const top = section.offsetTop;
            const bottom = top + section.offsetHeight;
            if (scrollPos >= top && scrollPos < bottom) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        }
    });
}

function createHeroParticles() {
    const container = document.getElementById('hero-particles');
    const count = 30;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (6 + Math.random() * 10) + 's';
        p.style.animationDelay = (Math.random() * 8) + 's';
        p.style.width = (2 + Math.random() * 3) + 'px';
        p.style.height = p.style.width;
        const colors = ['#8a64ff', '#00e5ff', '#a78bfa', '#fbbf24'];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(p);
    }
}

function setupScrollReveal() {
    const cards = document.querySelectorAll('.feature-card, .stat-card');
    cards.forEach((card, i) => {
        card.classList.add('reveal');
        card.style.transitionDelay = (i % 3) * 0.15 + 's';
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        { threshold: 0.15 }
    );

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function setupStatsAnimation() {
    const statNumbers = document.querySelectorAll('.stat-number');
    let animated = false;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animated) {
                    animated = true;
                    statNumbers.forEach(num => {
                        const target = parseInt(num.getAttribute('data-target'));
                        animateCounter(num, target);
                    });
                }
            });
        },
        { threshold: 0.3 }
    );

    const gameplaySection = document.getElementById('gameplay');
    if (gameplaySection) observer.observe(gameplaySection);
}

function animateCounter(element, target) {
    const duration = 2000;
    const start = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ---- Initialize ----
initThree();
initUI();
