import * as THREE from 'three';

// ── Theme detection ────────────────────────────
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches ||
               !window.matchMedia('(prefers-color-scheme: light)').matches;

// ── Three.js Scene ─────────────────────────────
const canvas = document.getElementById('bg');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Reduce particles on mobile
const isMobile = window.innerWidth < 700;
const particleCount = isMobile ? 800 : 2000;

// ── Particle Geometry ──────────────────────────
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);
const basePositions = new Float32Array(particleCount * 3);

// Color palettes
const darkColors = [
  [0.9, 0.92, 0.96],   // white
  [0.31, 0.61, 0.97],  // cyan-blue
  [0.65, 0.55, 0.98],  // violet
  [0.96, 0.77, 0.26],  // gold (rare)
];
const lightColors = [
  [0.3, 0.3, 0.45],    // dark gray-blue
  [0.26, 0.22, 0.79],  // indigo
  [0.49, 0.23, 0.93],  // violet
  [0.71, 0.33, 0.04],  // amber (rare)
];
const palette = isDark ? darkColors : lightColors;

for (let i = 0; i < particleCount; i++) {
  // Sphere distribution with some clustering
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 3 + Math.random() * 18;

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);

  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;
  basePositions[i * 3] = x;
  basePositions[i * 3 + 1] = y;
  basePositions[i * 3 + 2] = z;

  // Color selection weighted toward white/neutral
  const roll = Math.random();
  const c = roll < 0.5 ? palette[0]
          : roll < 0.75 ? palette[1]
          : roll < 0.92 ? palette[2]
          : palette[3];

  colors[i * 3] = c[0];
  colors[i * 3 + 1] = c[1];
  colors[i * 3 + 2] = c[2];

  sizes[i] = 0.4 + Math.random() * 1.8;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

// ── Shader Material ────────────────────────────
const material = new THREE.ShaderMaterial({
  vertexShader: `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uTime;

    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float pulse = 0.85 + 0.15 * sin(uTime * 0.5 + position.x * 0.3 + position.y * 0.2);
      gl_PointSize = size * pulse * (250.0 / -mvPosition.z);
      gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);
      vAlpha = pulse;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.05, d) * vAlpha * 0.6;
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
  uniforms: {
    uTime: { value: 0 },
  },
  transparent: true,
  depthWrite: false,
  blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

camera.position.z = 12;

// ── Scroll tracking ────────────────────────────
let scrollY = 0;
let targetScrollY = 0;

window.addEventListener('scroll', () => {
  targetScrollY = window.scrollY;
}, { passive: true });

// ── Mouse parallax (desktop only) ──────────────
let mouseX = 0;
let mouseY = 0;

if (!isMobile) {
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

// ── Resize ─────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, { passive: true });

// ── Animation Loop ─────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  material.uniforms.uTime.value = elapsed;

  // Smooth scroll interpolation
  scrollY += (targetScrollY - scrollY) * 0.08;

  // Gentle rotation
  particles.rotation.y = elapsed * 0.03 + mouseX * 0.05;
  particles.rotation.x = elapsed * 0.015 + mouseY * 0.03;

  // Scroll-driven camera movement
  const scrollFactor = scrollY * 0.0008;
  camera.position.y = -scrollFactor * 3;
  camera.position.z = 12 + scrollFactor * 0.5;
  camera.rotation.x = scrollFactor * 0.08;

  renderer.render(scene, camera);
}

animate();

// ── Scroll Animations ──────────────────────────
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px',
};

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

// Prologue entries
document.querySelectorAll('.prologue-entry').forEach((el, i) => {
  el.style.transitionDelay = `${i * 0.06}s`;
  revealObserver.observe(el);
});

// Timeline entries
document.querySelectorAll('.timeline-entry').forEach((el) => {
  revealObserver.observe(el);
});

// Stats
document.querySelectorAll('.stat').forEach((el) => {
  revealObserver.observe(el);
});

// Closing
const closingBody = document.querySelector('.closing-body');
if (closingBody) revealObserver.observe(closingBody);

// Links section
const linksSection = document.querySelector('.links');
if (linksSection) revealObserver.observe(linksSection);

// ── Counter Animation ──────────────────────────
let countersStarted = false;

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && !countersStarted) {
      countersStarted = true;
      document.querySelectorAll('.stat-number').forEach((el) => {
        const target = parseInt(el.dataset.target, 10);
        animateCounter(el, target);
      });
    }
  });
}, { threshold: 0.3 });

const statsSection = document.querySelector('.stats');
if (statsSection) statsObserver.observe(statsSection);

function animateCounter(element, target) {
  const duration = target > 100 ? 2200 : 1400;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(target * eased);
    element.textContent = current.toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target.toLocaleString();
    }
  }

  requestAnimationFrame(update);
}
