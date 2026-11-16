// MekongSense hero globe: embedded WebGL Earth with real-time day/night terminator,
// the Mekong thalweg (ground-truth GIS vertices), and Keplerian SWOT / Sentinel-1 orbits.
// Requires: three.min.js (r128), OrbitControls.js, earth_textures.js, mekong_3d_thalweg.js.
(function () {
  'use strict';

  const stage = document.getElementById('globe-stage');
  const mount = document.getElementById('globe-mount');
  if (!stage || !mount || !window.THREE || !window.EARTH_TEX || !window.MEKONG_3D_DATA) return;
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;

  const THREE = window.THREE;
  const R = 100;                       // globe radius in scene units (1 unit = 63.71 km)
  const EARTH_KM = 6371;
  const MU = 398600.4418;              // km^3/s^2, Earth gravitational parameter
  const OMEGA_E = 7.2921159e-5;        // rad/s, Earth sidereal rotation rate
  const TIMELAPSE = 150;               // orbital time-lapse factor shown in the HUD
  const DEG = Math.PI / 180;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Station values mirror the "Synoptic Basin Station Ledger" table on this page (same source of truth).
  const STATIONS = [
    { id: 'xiaowan', short: 'Xiaowan', name: 'Xiaowan Arch Dam (B01)', region: 'Upper Lancang Cascade · Yunnan', lat: 24.70, lon: 100.09, km: 1540, z: 1238.40, q: 1840, sat: 'SWOT KaRIn · Reservoir Node' },
    { id: 'chiang_saen', short: 'Chiang Saen', name: 'Chiang Saen Gauge (B04)', region: 'Golden Triangle · Thai / Lao Border', lat: 20.27, lon: 100.09, km: 2360, z: 361.40, q: 2820, sat: 'SWOT KaRIn · Acoustic Gauge' },
    { id: 'vientiane', short: 'Vientiane', name: 'Vientiane / Nong Khai (B06)', region: 'Khorat–Lao Alluvial Reach', lat: 17.97, lon: 102.63, km: 3050, z: 162.30, q: 4120, sat: 'SWOT KaRIn · Virtual Station' },
    { id: 'kratie', short: 'Kratie', name: 'Kratie Reference Gauge (B07)', region: 'Lower Mekong Mainstem · Cambodia', lat: 12.49, lon: 106.02, km: 3750, z: 18.40, q: 14820, sat: 'Sentinel-1 SAR · Flood Boundary' },
    { id: 'tonle_sap', short: 'Tonle Sap', name: 'Tonle Sap Great Lake Buffer', region: 'Siem Reap · Bidirectional Wetland Core', lat: 12.85, lon: 104.15, km: 3880, kmStr: 'Area: 2,416 – 16,000 km²', zStr: '1.40 m -> 10.20 m (wet)', qStr: 'Reverse Inflow 9,840 m³/s', sat: 'SWOT + Sentinel-1 · 57.20 km³' },
    { id: 'phnom_penh', short: 'Phnom Penh', name: 'Phnom Penh Port · Chaktomuk (B08)', region: 'Four-Face Confluence & Reversal Node', lat: 11.57, lon: 104.93, km: 3920, z: 8.95, q: 9840, sat: 'Sentinel-1 SAR · Flow Reversal' },
    { id: 'chau_doc', short: 'Chau Doc', name: 'Chau Doc · Bassac Distributary (B10)', region: 'Upper Mekong Delta · Vietnam', lat: 10.70, lon: 105.12, km: 4115, z: 3.12, q: 6280, sat: 'SWOT + Tidal Acoustic Gauge' }
  ];
  const BASIN_VIEW = { lat: 17.5, lon: 102.5, dist: 345 };

  const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------- geodesy ----------
  function ll(lat, lon, r) {
    const phi = (90 - lat) * DEG, th = (lon + 180) * DEG;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  }
  function toLatLon(v) {
    const r = v.length();
    let lon = Math.atan2(v.z, -v.x) / DEG - 180;
    if (lon < -180) lon += 360;
    return { lat: 90 - Math.acos(v.y / r) / DEG, lon: lon };
  }
  function haversineKm(a, b) {
    const dLat = (b.lat - a.lat) * DEG, dLon = (b.lon - a.lon) * DEG;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Subsolar point with Spencer/NOAA Equation of Time correction (astronomical accuracy < 0.2°).
  function sunDirection(d) {
    const doy = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
    const B = (2 * Math.PI / 365) * (doy - 81);
    const eotHours = (9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)) / 60;
    const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (doy + 10));
    const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + eotHours;
    return ll(decl, (12 - hours) * 15, 1).normalize();
  }

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
  camera.position.copy(ll(BASIN_VIEW.lat, BASIN_VIEW.lon, BASIN_VIEW.dist));

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = false;          // the page keeps the wheel; zoom lives on the HUD buttons
  controls.rotateSpeed = 0.42;
  controls.minDistance = 118;
  controls.maxDistance = 470;
  if (coarsePointer) {                  // never trap vertical page scrolling on touch screens
    controls.enabled = false;
    renderer.domElement.style.touchAction = 'pan-y';
  }

  let sunDir = sunDirection(new Date());

  // ---------- textures ----------
  const loader = new THREE.TextureLoader();
  let pending = 3;
  function tex(uri) {
    const t = loader.load(uri, function () {
      pending -= 1;
      if (pending === 0) stage.classList.add('globe-ready');
    });
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  const dayMap = tex(window.EARTH_TEX.day);
  const nightMap = tex(window.EARTH_TEX.night);
  const specMap = tex(window.EARTH_TEX.spec);

  // ---------- Earth (day/night shader) ----------
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayMap }, nightMap: { value: nightMap }, specMap: { value: specMap },
      sunDir: { value: sunDir }, camPos: { value: camera.position }
    },
    vertexShader: [
      'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
      'void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);',
      '  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * w; }'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D specMap;',
      'uniform vec3 sunDir; uniform vec3 camPos;',
      'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec3 n = normalize(vN); vec3 v = normalize(camPos - vW);',
      '  float d = dot(n, sunDir);',
      '  // Civil/nautical twilight transition (-10 deg to +1 deg solar elevation)',
      '  // Ensures anywhere the sun is above the horizon (d > 0) stays 100% in daytime',
      '  float dayMix = smoothstep(-0.18, 0.02, d);',
      '  // Atmospheric Rayleigh sky-dome scattering + perceptual daylight curve',
      '  float sunIrr = pow(max(d + 0.08, 0.0), 0.28);',
      '  vec3 day = texture2D(dayMap, vUv).rgb;',
      '  vec3 lit = day * (0.48 + 0.92 * sunIrr);',
      '  vec3 h = normalize(sunDir + v);',
      '  float spec = texture2D(specMap, vUv).r;',
      '  lit += vec3(0.55, 0.78, 1.0) * pow(max(dot(n, h), 0.0), 36.0) * spec * 0.55 * step(0.0, d);',
      '  vec3 lights = texture2D(nightMap, vUv).rgb;',
      '  vec3 night = lights * vec3(1.0, 0.80, 0.52) * 1.7 + day * 0.06;',
      '  vec3 col = mix(night, lit, dayMix);',
      '  col += vec3(0.95, 0.45, 0.16) * exp(-pow((d + 0.02) / 0.07, 2.0)) * 0.10;',
      '  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
      '  col += vec3(0.10, 0.55, 1.0) * rim * (0.12 + 0.38 * dayMix);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, 128, 80), earthMat));

  // ---------- Regional High-Res Mekong Satellite Inset (2560x2560 Tile, CORS-safe Data URI) ----------
  const insetSrc = (typeof window !== 'undefined' && window.MEKONG_HIGHRES_TILE) ? window.MEKONG_HIGHRES_TILE : 'assets/globe/mekong_sat_inset.webp';
  const insetTex = loader.load(insetSrc);
  insetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  insetTex.generateMipmaps = true;
  insetTex.minFilter = THREE.LinearMipmapLinearFilter;
  insetTex.magFilter = THREE.LinearFilter;

  const insetMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: insetTex },
      dayMap: { value: dayMap },
      specMap: { value: specMap },
      nightMap: { value: nightMap },
      sunDir: { value: sunDir },
      camPos: { value: camera.position },
      uOpacity: { value: 0.96 },
      uLod: { value: 0.0 }
    },
    vertexShader: [
      'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
      'void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);',
      '  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * w; }'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D map; uniform sampler2D dayMap; uniform sampler2D specMap; uniform sampler2D nightMap;',
      'uniform vec3 sunDir; uniform vec3 camPos; uniform float uOpacity; uniform float uLod;',
      'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec4 tex = texture2D(map, vUv);',
      '  vec2 earthUv = vec2((mix(87.5, 114.5, vUv.x) + 180.0) / 360.0, (mix(8.0, 35.0, vUv.y) + 90.0) / 180.0);',
      '  vec3 earthDay = texture2D(dayMap, earthUv).rgb;',
      '  float ocean = texture2D(specMap, earthUv).r;',
      '  vec3 n = normalize(vN); vec3 v = normalize(camPos - vW);',
      '  float d = dot(n, sunDir);',
      '  float dayMix = smoothstep(-0.18, 0.02, d);',
      '  float sunIrr = pow(max(d + 0.08, 0.0), 0.28);',
      '  // Lift tropical forest reflectance and harmonize with global earth tone at macro view',
      '  vec3 hiRes = pow(tex.rgb, vec3(0.84)) * vec3(1.06, 1.03, 0.96);',
      '  vec3 baseRgb = mix(mix(earthDay, hiRes, 0.55 + 0.45 * uLod), earthDay, ocean * (0.85 - 0.35 * uLod));',
      '  vec3 lit = baseRgb * (0.48 + 0.92 * sunIrr);',
      '  vec3 h = normalize(sunDir + v);',
      '  lit += vec3(0.55, 0.78, 1.0) * pow(max(dot(n, h), 0.0), 36.0) * ocean * 0.55 * step(0.0, d);',
      '  vec3 lights = texture2D(nightMap, earthUv).rgb;',
      '  vec3 night = lights * vec3(1.0, 0.80, 0.52) * 1.7 + baseRgb * 0.06;',
      '  vec3 col = mix(night, lit, dayMix);',
      '  col += vec3(0.95, 0.45, 0.16) * exp(-pow((d + 0.02) / 0.07, 2.0)) * 0.10;',
      '  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
      '  col += vec3(0.10, 0.55, 1.0) * rim * (0.12 + 0.38 * dayMix);',
      '  // Seamless radial + box edge feathering, plus ocean transparency at macro view',
      '  float fx = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));',
      '  float fy = smoothstep(0.0, 0.16, vUv.y) * (1.0 - smoothstep(0.84, 1.0, vUv.y));',
      '  float landAlpha = 1.0 - ocean * (0.78 - 0.55 * uLod);',
      '  float edgeAlpha = fx * fy * landAlpha;',
      '  gl_FragColor = vec4(col, tex.a * uOpacity * edgeAlpha);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  (function makeMekongInset() {
    // True geographic extent of the 1:1 square ArcGIS World_Imagery export (centered on 101E, 21.5N, span 27x27 deg)
    const latMin = 8.0, latMax = 35.0, lonMin = 87.5, lonMax = 114.5;
    const M = 96, N = 96;
    const pos = [], uvs = [], idx = [];
    for (let j = 0; j <= N; j++) {
      const lat = latMin + (latMax - latMin) * (j / N);
      const v = j / N;
      for (let i = 0; i <= M; i++) {
        const lon = lonMin + (lonMax - lonMin) * (i / M);
        const u = i / M;
        const p = ll(lat, lon, R + 0.035);
        pos.push(p.x, p.y, p.z);
        uvs.push(u, v);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < M; i++) {
        const p00 = j * (M + 1) + i;
        const p10 = j * (M + 1) + (i + 1);
        const p01 = (j + 1) * (M + 1) + i;
        const p11 = (j + 1) * (M + 1) + (i + 1);
        idx.push(p00, p10, p01, p10, p11, p01);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    scene.add(new THREE.Mesh(geom, insetMat));
  })();

  // ---------- atmosphere halo (back-face Fresnel, brighter on the sunlit limb) ----------
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: sunDir } },
    vertexShader: [
      'varying vec3 vN; varying vec3 vWN; varying vec3 vP;',
      'void main(){ vN = normalize(normalMatrix * normal); vWN = normalize(mat3(modelMatrix) * normal);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 sunDir; varying vec3 vN; varying vec3 vWN; varying vec3 vP;',
      'void main(){',
      '  float f = -dot(normalize(vN), normalize(-vP));',
      '  float i = pow(clamp(f / 0.38, 0.0, 1.0), 2.4);',
      '  float lit = smoothstep(-0.35, 0.55, dot(normalize(vWN), sunDir));',
      '  vec3 c = mix(vec3(0.05, 0.18, 0.45), vec3(0.22, 0.70, 1.0), lit);',
      '  gl_FragColor = vec4(c * i * (0.35 + 0.9 * lit), 1.0);',
      '}'
    ].join('\n'),
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.075, 96, 64), atmoMat));

  // ---------- soft round point sprites (stars, flow particles, station beacons) ----------
  function pointsMaterial(maxPx, baseOpacity) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPR: { value: pixelRatio },
        uMax: { value: maxPx },
        uOpacity: { value: baseOpacity !== undefined ? baseOpacity : 1.0 }
      },
      vertexShader: [
        'attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uPR; uniform float uMax;',
        'void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = min(aSize * uPR * (320.0 / -mv.z), uMax * uPR); gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vC; uniform float uOpacity;',
        'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * uOpacity;',
        '  gl_FragColor = vec4(vC * a, a); }'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
  }
  function pointCloud(positions, colors, sizes, maxPx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const p = new THREE.Points(g, pointsMaterial(maxPx));
    scene.add(p);
    return p;
  }

  (function stars() {
    const n = 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 1800 + Math.random() * 1200, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph); pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const b = 0.35 + Math.random() * 0.65;
      col[i * 3] = b * 0.85; col[i * 3 + 1] = b * 0.92; col[i * 3 + 2] = b;
      size[i] = 6 + Math.random() * 14;
    }
    pointCloud(pos, col, size, 3.2);
  })();

  // ---------- Tonle Sap Great Lake 3D Body & Glowing Shoreline (hugging spherical surface) ----------
  if (window.TONLE_SAP_LAKE) {
    const lake = window.TONLE_SAP_LAKE;
    if (lake.verts && lake.idx) {
      const pos = [];
      const vSph = lake.verts.map(function (v) { return ll(v[1], v[0], R + 0.05); });
      for (let i = 0; i < lake.idx.length; i++) {
        const p = vSph[lake.idx[i]];
        if (p) pos.push(p.x, p.y, p.z);
      }
      if (pos.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geom.computeVertexNormals();
        scene.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
          color: 0x06b6d4, transparent: true, opacity: 0.65, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        })));
      }
    }
    if (lake.shoreline && lake.shoreline.length > 3) {
      const sPts = lake.shoreline.map(function (p) { return ll(p[1], p[0], R + 0.06); });
      scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sPts), new THREE.LineBasicMaterial({
        color: 0x10b981, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false
      })));
    }
  }

  // ---------- Mekong thalweg (clamped to spherical curvature R + 0.075) ----------
  const DATA = window.MEKONG_3D_DATA;
  const thalwegLL = DATA.thalweg.map(function (p) { return { lat: p[1], lon: p[0] }; });
  const thalwegPts = DATA.thalweg.map(function (p) { return ll(p[1], p[0], R + 0.075); });
  const curve = new THREE.CatmullRomCurve3(thalwegPts, false, 'centripetal');
  const thalwegDense = curve.getPoints(thalwegPts.length * 3).map(function (p) {
    return p.setLength(R + 0.075);
  });
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(thalwegDense),
    new THREE.LineBasicMaterial({
      color: 0x9beaff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  ));

  // Thin river network: brightness falls with stream order, every spline point projected onto spherical shell R + 0.065
  const NET_STYLE = {
    1: { color: 0xb8f0ff, opacity: 0.95 },
    2: { color: 0x4cc4fa, opacity: 0.72 },
    3: { color: 0x3a9fd0, opacity: 0.45 }
  };
  (window.MEKONG_NETWORK || []).forEach(function (r) {
    const pts = r.pts.map(function (p) { return ll(p[1], p[0], R + 0.065); });
    if (pts.length < 2) return;
    const level = r.id.indexOf('distributary_') === 0 ? 3 : (r.id.indexOf('tributary_') === 0 ? 2 : 1);
    const st = NET_STYLE[level];
    const tonle = r.id.indexOf('tonle') !== -1;
    const densePts = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
      .getPoints(pts.length * 3)
      .map(function (p) { return p.setLength(R + 0.065); });
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(densePts),
      new THREE.LineBasicMaterial({ color: tonle ? 0x28c58c : st.color, transparent: true, opacity: st.opacity, blending: THREE.AdditiveBlending, depthWrite: false })));
  });

  // Flow particles ride a precomputed arc-length lookup table clamped to R + 0.09
  const LUT_N = 2400;
  const lut = curve.getSpacedPoints(LUT_N - 1).map(function (p) { return p.clone().setLength(R + 0.09); });
  const FLOW_N = 720;
  const flowT = new Float32Array(FLOW_N), flowV = new Float32Array(FLOW_N);
  const flowPos = new Float32Array(FLOW_N * 3), flowCol = new Float32Array(FLOW_N * 3), flowSize = new Float32Array(FLOW_N);
  const ramp = [[0.92, 0.98, 1.0], [0.37, 0.86, 1.0], [0.16, 0.77, 0.55], [0.15, 0.66, 0.95]];
  for (let i = 0; i < FLOW_N; i++) {
    flowT[i] = Math.random();
    flowV[i] = 0.018 + Math.random() * 0.012;          // fraction of the channel per second
    flowSize[i] = 1.2 + Math.random() * 1.4;
  }
  const flow = pointCloud(flowPos, flowCol, flowSize, 9);
  function updateFlow(dt) {
    for (let i = 0; i < FLOW_N; i++) {
      flowT[i] = (flowT[i] + flowV[i] * dt) % 1;
      const f = flowT[i] * (LUT_N - 1), k = Math.floor(f), a = lut[k], b = lut[Math.min(k + 1, LUT_N - 1)], w = f - k;
      flowPos[i * 3] = a.x + (b.x - a.x) * w; flowPos[i * 3 + 1] = a.y + (b.y - a.y) * w; flowPos[i * 3 + 2] = a.z + (b.z - a.z) * w;
      const s = flowT[i] * 3, j = Math.min(2, Math.floor(s)), m = s - j, c0 = ramp[j], c1 = ramp[j + 1];
      const fade = Math.min(1, flowT[i] * 25, (1 - flowT[i]) * 25);
      flowCol[i * 3] = (c0[0] + (c1[0] - c0[0]) * m) * fade;
      flowCol[i * 3 + 1] = (c0[1] + (c1[1] - c0[1]) * m) * fade;
      flowCol[i * 3 + 2] = (c0[2] + (c1[2] - c0[2]) * m) * fade;
    }
    flow.geometry.attributes.position.needsUpdate = true;
    flow.geometry.attributes.aColor.needsUpdate = true;
  }

  // ---------- stations ----------
  const stPos = new Float32Array(STATIONS.length * 3), stCol = new Float32Array(STATIONS.length * 3), stSize = new Float32Array(STATIONS.length);
  STATIONS.forEach(function (s, i) {
    s.surface = ll(s.lat, s.lon, R);
    const p = ll(s.lat, s.lon, R + 0.12);
    stPos[i * 3] = p.x; stPos[i * 3 + 1] = p.y; stPos[i * 3 + 2] = p.z;
    stCol[i * 3] = 1.0; stCol[i * 3 + 1] = 0.95; stCol[i * 3 + 2] = 0.85;
    stSize[i] = 7;
  });
  const beacons = pointCloud(stPos, stCol, stSize, 16);

  // ---------- Semantic LOD: Technical Hydrological Landmarks (Dams & Nodes) ----------
  const TECHNICAL_DAMS = [
    { id: 'xiaowan', short: 'Xiaowan', name: 'Xiaowan Arch Dam (B01)', region: 'Upper Lancang · 4,200 MW', lat: 24.70, lon: 100.09, km: 1540, kmStr: 'Head: 292.0 m', zStr: 'Pool: 1,238.40 m', qStr: '1,840 m³/s · 4.2 GW', sat: 'SWOT KaRIn · Reservoir Node', type: 'dam' },
    { id: 'nuozhadu', short: 'Nuozhadu', name: 'Nuozhadu Embankment Dam (B02)', region: 'Middle Lancang · 5,850 MW', lat: 22.64, lon: 100.43, km: 1820, kmStr: 'Head: 261.5 m', zStr: 'Pool: 809.20 m', qStr: '2,150 m³/s · 5.85 GW', sat: 'SWOT + Sentinel-1 SAR', type: 'dam' },
    { id: 'jinghong', short: 'Jinghong', name: 'Jinghong Gravity Dam (B03)', region: 'Lower Lancang Outflow · 1,750 MW', lat: 22.05, lon: 100.77, km: 2080, kmStr: 'Head: 108.0 m', zStr: 'Pool: 598.15 m', qStr: '1,960 m³/s · 1.75 GW', sat: 'SWOT KaRIn · Regulating Node', type: 'dam' },
    { id: 'xayaburi', short: 'Xayaburi', name: 'Xayaburi Run-of-River Barrage', region: 'Northern Lao Mainstem · 1,285 MW', lat: 19.25, lon: 101.81, km: 2510, kmStr: 'Head: 32.0 m', zStr: 'Storage: 0.23 km³', qStr: '1,285 MW · Barrage', sat: 'SWOT KaRIn · Mainstem Node', type: 'dam' },
    { id: 'luang_prabang', short: 'Luang Prabang', name: 'Luang Prabang Gauge (B05)', region: 'Nam Ou Confluence · Northern Laos', lat: 19.89, lon: 102.13, km: 2710, z: 282.10, q: 3450, sat: 'SWOT + Acoustic Gauge', type: 'dam' },
    { id: 'nam_theun_2', short: 'Nam Theun 2', name: 'Nam Theun 2 · Nakai Reservoir', region: 'Central Laos · Trans-Basin Diversion', lat: 17.99, lon: 104.97, km: 3120, kmStr: 'Head: 348.0 m', zStr: 'Storage: 3.50 km³', qStr: '1,070 MW', sat: 'Sentinel-1 SAR · Reservoir', type: 'dam' },
    { id: 'pak_mun', short: 'Pak Mun', name: 'Pak Mun Barrage', region: 'Mun–Chi Confluence · NE Thailand', lat: 15.28, lon: 105.47, km: 3340, kmStr: 'Head: 17.0 m', zStr: 'Storage: 0.22 km³', qStr: '136 MW', sat: 'SWOT KaRIn · Tributary Mouth', type: 'dam' },
    { id: 'don_sahong', short: 'Don Sahong', name: 'Don Sahong & Khone Phapheng Falls', region: 'Siphandone · Southern Laos', lat: 13.95, lon: 105.95, km: 3580, kmStr: 'Head: 19.0 m', zStr: 'Khone Falls Drop', qStr: '260 MW', sat: 'Sentinel-1 SAR · Bedrock Anabranch', type: 'dam' },
    { id: 'yali', short: 'Yali Falls', name: 'Yali Falls Dam (Sesan 3S)', region: 'Central Highlands · Vietnam', lat: 14.22, lon: 107.82, km: 3650, kmStr: 'Head: 69.0 m', zStr: 'Storage: 1.04 km³', qStr: '720 MW', sat: 'SWOT KaRIn · 3S Subbasin', type: 'dam' },
    { id: 'sesan_basin', short: 'Sê San', name: 'Sê San Calibrated Catchment (B02-01)', region: 'Central Highlands · 18,888 km²', lat: 14.30, lon: 107.50, km: 3650, kmStr: 'Area: 18,888 km²', zStr: 'El. 200–1,800 m', qStr: 'Calibrated GPM IMERG', sat: 'B02 · 3-Layer Bias Correction', type: 'dam' },
    { id: 'srepok_basin', short: 'Srepok', name: 'Srepok Calibrated Catchment (B02-02)', region: 'Central Highlands · 30,942 km²', lat: 12.80, lon: 107.80, km: 3700, kmStr: 'Area: 30,942 km²', zStr: 'El. 150–2,100 m', qStr: 'Calibrated GPM IMERG', sat: 'B02 · 3-Layer Bias Correction', type: 'dam' },
    { id: 'tan_chau', short: 'Tan Chau', name: 'Tan Chau · Tien River (B09)', region: 'Mekong Main Distributary · Vietnam', lat: 10.80, lon: 105.24, km: 4110, z: 3.45, q: 12400, sat: 'Tidal Acoustic Gauge', type: 'dam' }
  ];
  const damPos = new Float32Array(TECHNICAL_DAMS.length * 3);
  const damCol = new Float32Array(TECHNICAL_DAMS.length * 3);
  const damSize = new Float32Array(TECHNICAL_DAMS.length);
  TECHNICAL_DAMS.forEach(function (d, i) {
    d.surface = ll(d.lat, d.lon, R);
    const p = ll(d.lat, d.lon, R + 0.12);
    damPos[i * 3] = p.x; damPos[i * 3 + 1] = p.y; damPos[i * 3 + 2] = p.z;
    damCol[i * 3] = 0.96; damCol[i * 3 + 1] = 0.65; damCol[i * 3 + 2] = 0.15; // amber #f59e0b
    damSize[i] = 9;
  });
  const damMat = pointsMaterial(18, 0.0);
  const damGeom = new THREE.BufferGeometry();
  damGeom.setAttribute('position', new THREE.BufferAttribute(damPos, 3));
  damGeom.setAttribute('aColor', new THREE.BufferAttribute(damCol, 3));
  damGeom.setAttribute('aSize', new THREE.BufferAttribute(damSize, 1));
  const damBeacons = new THREE.Points(damGeom, damMat);
  scene.add(damBeacons);

  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48),
    new THREE.MeshBasicMaterial({ color: 0x28c58c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  pulse.visible = false;
  scene.add(pulse);

  // ---------- satellites (two-body Keplerian circular orbits, Earth-fixed frame) ----------
  function makeSatellite(cfg) {
    const a = EARTH_KM + cfg.altKm;
    const rOrb = R * a / EARTH_KM;
    const inc = cfg.inc * DEG;
    const n = Math.sqrt(MU / (a * a * a));            // mean motion, rad/s
    const group = new THREE.Group();
    scene.add(group);

    function canon(u, r) {
      return new THREE.Vector3(r * Math.cos(u), r * Math.sin(u) * Math.sin(inc), -r * Math.sin(u) * Math.cos(inc));
    }
    const ring = [];
    for (let i = 0; i <= 256; i++) ring.push(canon(i / 256 * Math.PI * 2, rOrb));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring),
      new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.38 })));

    const sat = new THREE.Group();
    // Compact, refined telemetry satellite bus (no gigantic white box blocking the basin)
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.20), bodyMat));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(cfg.span * 0.35, 0.02, 0.12), new THREE.MeshBasicMaterial({ color: cfg.color }));
    sat.add(wing);
    const glow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), pointsMaterial(22));
    glow.geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(new THREE.Color(cfg.color).toArray()), 3));
    glow.geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([10]), 1));
    sat.add(glow);

    // Swath cone: apex at the spacecraft, base on the ground, true swath width (km -> scene units).
    const h = rOrb - R;
    const cone = new THREE.ConeGeometry((cfg.swathKm / 2) / EARTH_KM * R, h, 32, 1, true);
    cone.rotateX(-Math.PI / 2);
    cone.translate(0, 0, h / 2);
    sat.add(new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    group.add(sat);

    // Phase the orbit so the spacecraft crosses the basin (16°N, 103°E) passT real seconds after load.
    const sinU = Math.sin(16 * DEG) / Math.sin(inc);
    const uPass = cfg.ascending ? Math.asin(sinU) : Math.PI - Math.asin(sinU);
    const dLon = Math.atan2(Math.cos(inc) * Math.sin(uPass), Math.cos(uPass));
    const tPass = cfg.passT * TIMELAPSE;
    const raan0 = 103 * DEG - dLon + OMEGA_E * tPass;

    return {
      name: cfg.name, swathKm: cfg.swathKm, periodMin: 2 * Math.PI / n / 60,
      update: function (tSim) {
        group.rotation.y = raan0 - OMEGA_E * tSim;
        sat.position.copy(canon(uPass + n * (tSim - tPass), rOrb));
        group.updateMatrixWorld();
        sat.lookAt(0, 0, 0);
        // Adaptive satellite bus scale: scales down gracefully on close zoom to preserve surface view
        const dCam = camera.position.length();
        const sBus = THREE.MathUtils.clamp((dCam - 140) / (250 - 140), 0.25, 1.0);
        sat.scale.setScalar(sBus);
      },
      subPoint: function () { return toLatLon(sat.getWorldPosition(new THREE.Vector3())); }
    };
  }
  const satellites = [
    makeSatellite({ name: 'SWOT', altKm: 890.6, inc: 77.6, swathKm: 120, span: 2.6, color: 0x38baf5, ascending: true, passT: 7 }),
    makeSatellite({ name: 'Sentinel-1', altKm: 693, inc: 98.18, swathKm: 250, span: 3.0, color: 0xf5a524, ascending: false, passT: 24 }),
    makeSatellite({ name: 'ICESat-2', altKm: 496, inc: 92.0, swathKm: 50, span: 2.1, color: 0x10b981, ascending: true, passT: 14 }),
    makeSatellite({ name: 'Sentinel-2', altKm: 786, inc: 98.62, swathKm: 290, span: 2.8, color: 0x06b6d4, ascending: false, passT: 38 }),
    makeSatellite({ name: 'Landsat-9', altKm: 705, inc: 98.2, swathKm: 185, span: 2.4, color: 0xf43f5e, ascending: false, passT: 52 })
  ];

  // ---------- HUD ----------
  const el = function (id) { return document.getElementById(id); };
  const clockEl = el('globe-clock');
  const satEls = [
    el('globe-sat-swot'),
    el('globe-sat-s1'),
    el('globe-sat-icesat2'),
    el('globe-sat-s2'),
    el('globe-sat-landsat')
  ];
  const readout = el('globe-readout');
  const label = el('globe-label');
  const chipsEl = el('globe-chips');

  function nearestRiverKm(p) {
    let best = Infinity;
    for (let i = 0; i < thalwegLL.length; i += 4) best = Math.min(best, haversineKm(p, thalwegLL[i]));
    return best;
  }
  function updateHud() {
    const now = new Date();
    const ictHours = (now.getUTCHours() + 7) % 24;
    if (clockEl) {
      clockEl.textContent = 'Solar Ephemeris · ' +
        String(ictHours).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0') + ' ICT (' +
        String(now.getUTCHours()).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0') + ' UTC)';
    }
    satellites.forEach(function (s, i) {
      if (!satEls[i]) return;
      const d = nearestRiverKm(s.subPoint());
      satEls[i].textContent = d < s.swathKm / 2 + 40
        ? s.name + ' · active basin pass'
        : s.name + ' · ' + fmtInt.format(Math.round(d / 10) * 10) + ' km to thalweg';
      satEls[i].parentElement.classList.toggle('is-scanning', d < s.swathKm / 2 + 40);
    });
  }

  // ---------- camera flights ----------
  let flight = null, mode = 'basin', activeStation = null, lastInteraction = -1e9;
  const easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  function flyTo(pos, target, dur) {
    const from = camera.position.clone(), d0 = from.length(), d1 = pos.length();
    const q = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), pos.clone().normalize());
    const angle = from.angleTo(pos);
    flight = { from: from, d0: d0, d1: d1, q: q, lift: Math.min(90, angle * 70), t0: performance.now(), dur: reduceMotion ? 1 : dur,
      tg0: controls.target.clone(), tg1: target.clone() };
  }
  function stepFlight(now) {
    if (!flight) return;
    const k = Math.min(1, (now - flight.t0) / flight.dur), e = easeInOut(k);
    const qk = new THREE.Quaternion().slerp(flight.q, e);
    const dist = flight.d0 + (flight.d1 - flight.d0) * e + flight.lift * Math.sin(Math.PI * e);
    camera.position.copy(flight.from).normalize().applyQuaternion(qk).multiplyScalar(dist);
    controls.target.lerpVectors(flight.tg0, flight.tg1, e);
    if (k >= 1) flight = null;
  }

  function focusStation(s) {
    mode = 'station';
    activeStation = s;
    const n = s.surface.clone().normalize();
    const south = ll(s.lat - 1, s.lon, R).sub(s.surface).normalize();
    const pos = s.surface.clone().add(n.multiplyScalar(46)).add(south.multiplyScalar(40));
    flyTo(pos, s.surface, 1700);
    pulse.position.copy(ll(s.lat, s.lon, R + 0.12));
    pulse.lookAt(0, 0, 0);
    pulse.visible = true;
    if (readout) {
      readout.querySelector('[data-f=name]').textContent = s.name;
      readout.querySelector('[data-f=region]').textContent = s.region;
      readout.querySelector('[data-f=km]').textContent = s.kmStr || (fmtInt.format(s.km) + ' km');
      readout.querySelector('[data-f=z]').textContent = s.zStr || (fmt2.format(s.z) + ' m');
      readout.querySelector('[data-f=q]').textContent = s.qStr || (fmtInt.format(s.q) + ' m³/s');
      readout.querySelector('[data-f=sat]').textContent = s.sat;
      readout.hidden = false;
    }
    if (label) label.textContent = s.short;
    setActiveChip(s.id);
  }
  function focusBasin() {
    mode = 'basin';
    activeStation = null;
    pulse.visible = false;
    if (readout) readout.hidden = true;
    if (label) label.style.opacity = '0';
    flyTo(ll(BASIN_VIEW.lat, BASIN_VIEW.lon, BASIN_VIEW.dist), new THREE.Vector3(), 1500);
    setActiveChip('basin');
  }
  function zoom(factor) {
    const dir = camera.position.clone().sub(controls.target);
    const minLen = controls.target.length() < 1 ? 122 : 24;   // never push the camera through the crust
    const len = THREE.MathUtils.clamp(dir.length() * factor, minLen, 470 - controls.target.length());
    flyTo(controls.target.clone().add(dir.setLength(len)), controls.target.clone(), 450);
  }

  function setActiveChip(id) {
    if (!chipsEl) return;
    chipsEl.querySelectorAll('button').forEach(function (b) {
      const on = b.dataset.id === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  if (chipsEl) {
    [{ id: 'basin', short: 'Full Basin' }].concat(STATIONS).forEach(function (s) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'globe-chip';
      b.dataset.id = s.id;
      b.textContent = s.short;
      b.addEventListener('click', function () {
        lastInteraction = performance.now();
        if (s.id === 'basin') focusBasin(); else focusStation(s);
      });
      chipsEl.appendChild(b);
    });
    setActiveChip('basin');
  }
  const zin = el('globe-zoom-in'), zout = el('globe-zoom-out');
  if (zin) zin.addEventListener('click', function () { lastInteraction = performance.now(); zoom(0.78); });
  if (zout) zout.addEventListener('click', function () { lastInteraction = performance.now(); zoom(1.28); });

  // Collapsible Satellite Status Card toggle
  const statusCard = el('globe-status-card');
  const statusToggle = el('globe-status-toggle');
  if (statusToggle && statusCard) {
    statusToggle.addEventListener('click', function () {
      const isCollapsed = statusCard.classList.toggle('is-collapsed');
      statusToggle.setAttribute('aria-expanded', !isCollapsed);
    });
  }
  controls.addEventListener('start', function () { flight = null; lastInteraction = performance.now(); });
  controls.addEventListener('end', function () { lastInteraction = performance.now(); });

  // Direct click / tap on globe landmarks (stations & technical dams)
  mount.addEventListener('pointerup', function (e) {
    if (flight) return;
    const rect = mount.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const allTargets = STATIONS.concat(TECHNICAL_DAMS);
    let best = null, bestDist = 26;
    allTargets.forEach(function (t) {
      if (!t.surface) return;
      const p = t.surface.clone().multiplyScalar((R + 0.12) / R);
      if (p.clone().normalize().dot(tmp.copy(camera.position).sub(p).normalize()) < 0.1) return;
      p.project(camera);
      const sx = (p.x * 0.5 + 0.5) * rect.width;
      const sy = (-p.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(mx - sx, my - sy);
      if (d < bestDist) { bestDist = d; best = t; }
    });
    if (best) {
      lastInteraction = performance.now();
      focusStation(best);
    }
  });

  window.MekongGlobe = {
    focus: function (id) {
      lastInteraction = performance.now();
      let targetId = id;
      if (targetId === 'yali_falls') targetId = 'yali';
      if (targetId === 'kompong_luong') targetId = 'tonle_sap';
      if (targetId === 'chaktomuk') targetId = 'phnom_penh';
      const all = STATIONS.concat(TECHNICAL_DAMS);
      const s = all.find(function (x) { return x.id === targetId || x.id === id; });
      if (s) focusStation(s); else focusBasin();
    }
  };

  // ---------- label projection ----------
  const tmp = new THREE.Vector3();
  function updateLabel() {
    if (!label || !activeStation) return;
    const p = ll(activeStation.lat, activeStation.lon, R + 0.12);
    const facing = p.clone().normalize().dot(tmp.copy(camera.position).sub(p).normalize()) > 0.05;
    p.project(camera);
    const w = mount.clientWidth, h = mount.clientHeight;
    label.style.transform = 'translate(' + ((p.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-p.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    label.style.opacity = facing && !flight ? '1' : '0';
  }

  // ---------- sizing / visibility / loop ----------
  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole basin framed on narrow (portrait) stages
    camera.fov = w / h < 0.85 ? 40 : 32;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  let visible = true, running = false, last = performance.now(), simT = 0, hudT = 0, sunT = 0, swayPrev = 0;
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) start();
  }, { threshold: 0.02 }).observe(stage);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    simT += dt * TIMELAPSE;

    stepFlight(now);
    // idle sway keeps the basin in frame instead of spinning it out of view
    const idle = mode === 'basin' && !flight && now - lastInteraction > 5000 && !reduceMotion;
    const sway = 0.32 * Math.sin(now / 1000 * 0.11);
    if (idle) camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), sway - swayPrev);
    swayPrev = sway;

    satellites.forEach(function (s) { s.update(simT); });
    if (!reduceMotion) updateFlow(dt);
    if (pulse.visible) {
      const k = (now / 1400) % 1;
      pulse.scale.setScalar(1 + k * 2.4);
      pulse.material.opacity = 0.9 * (1 - k);
    }
    // Semantic LOD: Smooth transition for technical dam beacons and high-res satellite inset
    const camDist = camera.position.length();
    const lodT = THREE.MathUtils.clamp((240 - camDist) / (240 - 150), 0, 1);
    if (typeof damMat !== 'undefined' && damMat.uniforms.uOpacity) {
      damMat.uniforms.uOpacity.value = lodT;
    }
    if (typeof insetMat !== 'undefined') {
      insetMat.uniforms.sunDir.value.copy(sunDir);
      insetMat.uniforms.camPos.value.copy(camera.position);
      insetMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.95, 1.0, lodT);
      insetMat.uniforms.uLod.value = lodT;
    }
    const lodRow = el('globe-lod-row');
    if (lodRow) lodRow.style.display = lodT > 0.35 ? 'flex' : 'none';
    hudT += dt;
    sunT += dt;
    if (hudT > 0.25) { hudT = 0; updateHud(); }
    if (sunT > 30) { sunT = 0; sunDir.copy(sunDirection(new Date())); }
    controls.update();
    updateLabel();
    renderer.render(scene, camera);
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  updateFlow(0);
  updateHud();
  start();
})();
