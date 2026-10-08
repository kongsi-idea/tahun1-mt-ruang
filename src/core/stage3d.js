// 共用 3D 层：一个 renderer、灯光、地面投影、OrbitControls、镜头飞行、三个按钮、WebGL fallback
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setResolution, disposeTree, Corners } from './ink.js';

const HALF = Math.PI / 2;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const dur = (ms) => (reducedMotion() ? 1 : ms);
const isSmall = () => matchMedia('(pointer: coarse)').matches || innerWidth < 700;

class Stage3D {
  constructor() {
    this.ready = false; this.supported = null;
    this.mounted = false; this.hooks = []; this.home = null; this.fly = null;
    this.content = new THREE.Group();
    this.corners = new Corners();
    this._ray = new THREE.Raycaster();
    this.size = { w: 1, h: 1 };
  }

  _init() {
    if (this.ready) return this.supported;
    this.ready = true;
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      if (!r.getContext()) throw new Error('no ctx');
      this.renderer = r;
    } catch (e) { this.supported = false; return false; }
    this.supported = true;
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, r.domElement);
    const c = this.controls;
    c.enableDamping = true; c.dampingFactor = 0.12; c.enablePan = false;
    c.minDistance = 3.5; c.maxDistance = 14; c.rotateSpeed = 0.9; c.autoRotateSpeed = 2.4;
    r.domElement.style.touchAction = 'none';
    // 灯光：半球光＋方向光（背光面亮度 ≥ 原色约 80%）
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xfff0d0, 3.3));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(0.4, 14, 0.5); sun.castShadow = true;
    const ms = isSmall() ? 1024 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 4, far: 22 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -HALF; ground.position.y = -0.002; ground.receiveShadow = true;
    this.scene.add(ground);
    // 柔和接触阴影：模型正下方一团模糊的影子，永远不会跑到模型旁边
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128;
    const g = cvs.getContext('2d'), grd = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, 'rgba(59,42,26,.85)'); grd.addColorStop(0.55, 'rgba(59,42,26,.35)'); grd.addColorStop(1, 'rgba(59,42,26,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    this.blobTex = new THREE.CanvasTexture(cvs); this.blobTex.colorSpace = THREE.SRGBColorSpace;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, opacity: 0.3, depthWrite: false }));
    this.blob.rotation.x = -HALF; this.blob.position.y = 0.003; this.blob.renderOrder = -1; this.blob.visible = false;
    this.scene.add(this.blob);
    this.scene.add(this.content);
    this.scene.add(this.corners.mesh);
    this.cornerSegs = [];
    this._tick = this._tick.bind(this);
    return true;
  }

  // host: 放画布的元素。返回 { ok }。toolbar 按钮建在 host 内。
  mount(host, { home, onFrame } = {}) {
    this.host = host;
    host.classList.add('stage');
    host.innerHTML = '';
    if (!this._init()) {
      host.innerHTML = '<div class="gl-fallback"><div><b>这台设备打不开 3D 画面</b><br>请换一个浏览器（Chrome、Safari），或检查「硬件加速」有没有打开。<br>其他不用 3D 的部分仍可使用。</div></div>';
      this.mounted = false;
      return { ok: false };
    }
    this.cv = document.createElement('div'); this.cv.className = 'cv';
    this.cv.appendChild(this.renderer.domElement);
    this.overlay = document.createElement('div'); this.overlay.className = 'overlay';
    this.cv.appendChild(this.overlay);
    host.appendChild(this.cv);
    this.cv.addEventListener('pointerdown', () => { if (this.fly) { this.fly = null; this.controls.enabled = true; } }, true);
    this._buildBar();
    this.hooks = onFrame ? [onFrame] : [];
    this.home = home; this.fly = null;
    this.controls.enabled = true; this.controls.autoRotate = false; this.controls.maxDistance = 14; this.controls.minDistance = 3.5;
    this.cornerSegs = [];
    this.mounted = true; this.paused = false;
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.cv); this._ro.observe(this.renderer.domElement);
    this.resize();
    if (home) { const h0 = typeof home === 'function' ? home() : home; this.place(h0.target, h0.sph); }
    this._raf = requestAnimationFrame(this._tick);
    return { ok: true };
  }

  unmount() {
    this.mounted = false;
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    if (this.supported) {
      this.clear();
      this.renderer.domElement.remove();
    }
    this.host && (this.host.innerHTML = '');
    this.hooks = []; this.cornerSegs = [];
  }

  // 接触阴影的大小（半径 rx、rz）；k = 浓淡系数
  setFootprint(rx, rz = rx, k = 1) {
    this.blob.visible = k > 0.02;
    this.blob.scale.set(rx * 2.25, rz * 2.25, 1);
    this.blob.material.opacity = 0.3 * k;
  }

  clear() {
    if (this.blob) this.blob.visible = false;
    for (const ch of [...this.content.children]) { this.content.remove(ch); disposeTree(ch); }
  }

  _buildBar() {
    const bar = document.createElement('div'); bar.className = 'stage-bar';
    const mk = (txt, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ' + cls; b.textContent = txt; b.onclick = fn; bar.appendChild(b); return b; };
    mk('复位视角', () => this.reset());
    const auto = mk('自动旋转：关', () => {
      this.controls.autoRotate = !this.controls.autoRotate;
      auto.textContent = '自动旋转：' + (this.controls.autoRotate ? '开' : '关');
      auto.setAttribute('aria-pressed', this.controls.autoRotate);
    });
    auto.setAttribute('aria-pressed', 'false');
    this.autoBtn = auto;
    mk('全屏', () => this.toggleFullscreen());
    this.host.appendChild(bar);
  }

  toggleFullscreen() {
    const el = this.host.closest('.module') || this.host;
    const on = document.fullscreenElement || el.classList.contains('pseudo-fs');
    if (on) {
      if (document.fullscreenElement) document.exitFullscreen?.();
      el.classList.remove('pseudo-fs');
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => el.classList.add('pseudo-fs'));
    } else el.classList.add('pseudo-fs');
  }

  resize() {
    if (!this.mounted) return;
    const cs = this.renderer.domElement;
    const w = Math.max(cs.clientWidth || this.cv.clientWidth, 1), h = Math.max(cs.clientHeight || this.cv.clientHeight, 1);
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 窄（竖屏）画面：拉远一点，让模型完整入镜
    this.camera.fov = w / h < 0.9 ? 32 / Math.max(w / h, 0.55) * 0.9 : 32;
    this.camera.updateProjectionMatrix();
    setResolution(w, h);
  }

  place(target, sph) {
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(sph));
    this.camera.lookAt(target);
  }
  flyTo(v, ms = 1000) {
    const s0 = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dt = v.sph.theta - s0.theta; dt = Math.atan2(Math.sin(dt), Math.cos(dt));
    this.fly = { t0: performance.now(), ms: dur(ms), s0, s1: new THREE.Spherical(v.sph.radius, v.sph.phi, s0.theta + dt), a: this.controls.target.clone(), b: v.target.clone() };
    this.controls.enabled = false;
  }
  reset() { if (this.mounted && this.home) this.flyTo(typeof this.home === 'function' ? this.home() : this.home, 700); }
  setHome(h) { this.home = h; }

  // 世界座标 → 画面像素；visible=不被模型挡住
  project(p, occluders) {
    const v = p.clone().project(this.camera);
    const out = { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h, front: v.z < 1 };
    out.visible = true;
    if (occluders && out.front) {
      const dir = p.clone().sub(this.camera.position); const d = dir.length(); dir.normalize();
      this._ray.set(this.camera.position, dir);
      const hit = this._ray.intersectObjects(occluders, false)[0];
      out.visible = !hit || hit.distance > d - 0.06;
    }
    return out;
  }

  _tick(now) {
    if (!this.mounted) return;
    if (this.paused) { this._raf = requestAnimationFrame(this._tick); return; }
    const f = this.fly;
    if (f) {
      const t = Math.min((now - f.t0) / f.ms, 1), e = ease(t);
      const L = THREE.MathUtils.lerp;
      this.place(f.a.clone().lerp(f.b, e), new THREE.Spherical(L(f.s0.radius, f.s1.radius, e), L(f.s0.phi, f.s1.phi, e), L(f.s0.theta, f.s1.theta, e)));
      if (t >= 1) { this.fly = null; this.controls.enabled = true; }
    } else this.controls.update();
    for (const h of this.hooks) h(now);
    this.camera.updateMatrixWorld();
    this.corners.update(this.cornerSegs, this.camera, this.size.w, this.size.h);
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(this._tick);
  }
}

export const stage = new Stage3D();
export { THREE };
