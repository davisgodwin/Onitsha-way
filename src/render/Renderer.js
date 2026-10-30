import * as THREE from 'three';
import { CONFIG } from '../config.js';

/** Owns the WebGL renderer, scene, camera, lights and sky. */
export class Renderer {
  constructor(container, qualityName = 'medium') {
    this.container = container;
    this.qualityName = qualityName;
    const q = CONFIG.quality[qualityName];
    this.renderer = new THREE.WebGLRenderer({ antialias: qualityName !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'game-canvas';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 1400);
    this.scene.fog = new THREE.Fog('#cdd3d3', 80, q.drawDistance);

    this.hemi = new THREE.HemisphereLight('#dfe8f0', '#8a6a52', 1.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    this.sun.castShadow = true;
    const r = CONFIG.world.shadowRange;
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 400 });
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize();

    this.sky = makeSky();
    this.scene.add(this.sky);

    this.applyQuality(qualityName);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  applyQuality(name) {
    const q = CONFIG.quality[name] ?? CONFIG.quality.medium;
    this.qualityName = name;
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    this.resScale = 1;
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    if (this.sun.shadow.map && this.sun.shadow.mapSize.x !== q.shadowMap) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.scene.fog.far = q.drawDistance;
    this.camera.far = q.drawDistance + 150;
    this.camera.updateProjectionMatrix();
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => (mm.needsUpdate = true)); } });
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the shadow frustum centred on the area of interest, snapped to texels to avoid shimmer. */
  followShadows(focus) {
    const d = this.sunDir;
    const texel = (CONFIG.world.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + d.x * 150, Math.max(10, d.y * 150), fz + d.z * 150);
    this.sky.position.copy(this.camera.position);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /**
   * Adaptive resolution: every 2 seconds, if the frame rate is low the render resolution steps down
   * (to 55% at most), and back up when there's headroom. Keeps phones and old laptops playable.
   */
  adapt(dt, enabled = true) {
    if (!enabled) { if (this.resScale !== 1) { this.resScale = 1; this.renderer.setPixelRatio(this.basePixelRatio); } return; }
    this._ad ??= { t: 0, n: 0 };
    const a = this._ad; a.t += dt; a.n++;
    if (a.t < 2) return;
    const fps = a.n / a.t; a.t = 0; a.n = 0;
    let s = this.resScale;
    if (fps < 34) s = Math.max(0.55, s - 0.1); else if (fps > 56) s = Math.min(1, s + 0.05);
    if (Math.abs(s - this.resScale) > 1e-3) { this.resScale = s; this.renderer.setPixelRatio(this.basePixelRatio * s); }
    this.lastFps = fps;
  }

  /** Field of view in degrees. */
  setFov(deg) { this.camera.fov = deg; this.camera.updateProjectionMatrix(); }

  dispose() { window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#4a86c8') },
      horizon: { value: new THREE.Color('#d6dcdc') },
      ground: { value: new THREE.Color('#8b7a6a') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color('#fff2d6') },
      sunVis: { value: 1 },
      cloud: { value: 0.3 },
      skyTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunVis;
      uniform float cloud; uniform float skyTime;
      varying vec3 vDir;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.0,w=.52;for(int i=0;i<4;i++){n+=noise(p)*w;p=p*2.03+vec2(9.2,3.7);w*=.49;}return n;}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 1200.0) * 4.0 + pow(s, 12.0) * 0.28) * sunVis;
        // Soft, layered tropical cloud banks in perspective, with silver sun-facing edges.
        if(h>0.015){
          vec2 uv=d.xz/(h+.22)*2.6+vec2(skyTime*.002,skyTime*.0005);
          float n=fbm(uv), detail=noise(uv*2.3+4.0);
          float density=smoothstep(.60-cloud*.22,.80-cloud*.20,n+detail*.12)*smoothstep(.015,.12,h);
          float lit=clamp(sunDir.y*2.0+.12,.08,1.0);
          vec3 shadow=mix(vec3(.065,.085,.12),horizon*.8,lit);
          vec3 rim=mix(vec3(.13,.16,.22),vec3(1.0,.97,.91),lit);
          col=mix(col,mix(shadow,rim,smoothstep(.42,.72,n)+pow(s,9.0)*.25),density*.85);
          float night=1.0-smoothstep(-.08,.12,sunDir.y);
          float star=step(.9988,hash(floor(d.xz/(h+.1)*450.0)))*pow(max(0.0,h),.5);
          col+=vec3(star*.55*night*(1.0-density));
          float moon=max(dot(d,normalize(vec3(-.35,.75,-.4))),0.0);
          col+=vec3(.55,.63,.75)*pow(moon,2000.0)*night*(1.0-density);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}
