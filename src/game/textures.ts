import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphalt: THREE.CanvasTexture;
  asphaltRoughness: THREE.CanvasTexture;
  carbonFiber: THREE.CanvasTexture;
  tireTread: THREE.CanvasTexture;
  brakeRotor: THREE.CanvasTexture;
  grilleMesh: THREE.CanvasTexture;
  curb: THREE.CanvasTexture;
  barrier: THREE.CanvasTexture;
  startFinish: THREE.CanvasTexture;
  buildings: THREE.CanvasTexture[];
  buildingEmissives: THREE.CanvasTexture[];
  buildingPodium: THREE.CanvasTexture;
  urbanGround: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  smokePuff: THREE.CanvasTexture;
  headlightBeam: THREE.CanvasTexture;
  glowHalo: THREE.CanvasTexture;
  sky: THREE.CanvasTexture;
  dispose: () => void;
}

function configureColorTexture(
  tex: THREE.CanvasTexture,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isLinear = false,
): THREE.CanvasTexture {
  tex.colorSpace = isLinear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const anisotropy = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. High-Definition Asphalt Road Albedo + Linear Roughness Map
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#1E222B';
  actx.fillRect(0, 0, 512, 512);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#8C8C8C';
  rctx.fillRect(0, 0, 512, 512);

  // Fine asphalt mineral aggregate speckles
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 22 + Math.floor(Math.random() * 26);
    actx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 8})`;
    actx.fillRect(x, y, 2, 2);

    const rShade = 95 + Math.floor(Math.random() * 90);
    rctx.fillStyle = `rgb(${rShade}, ${rShade}, ${rShade})`;
    rctx.fillRect(x, y, 2, 2);
  }

  // Polished darker racing-line tire grooves (slightly glossier specular)
  [153, 359].forEach((cx) => {
    const laneGrad = actx.createLinearGradient(cx - 58, 0, cx + 58, 0);
    laneGrad.addColorStop(0, 'rgba(10, 12, 16, 0)');
    laneGrad.addColorStop(0.5, 'rgba(10, 12, 16, 0.38)');
    laneGrad.addColorStop(1, 'rgba(10, 12, 16, 0)');
    actx.fillStyle = laneGrad;
    actx.fillRect(cx - 58, 0, 116, 512);

    const rLaneGrad = rctx.createLinearGradient(cx - 58, 0, cx + 58, 0);
    rLaneGrad.addColorStop(0, 'rgba(70, 70, 70, 0)');
    rLaneGrad.addColorStop(0.5, 'rgba(55, 55, 55, 0.65)');
    rLaneGrad.addColorStop(1, 'rgba(70, 70, 70, 0)');
    rctx.fillStyle = rLaneGrad;
    rctx.fillRect(cx - 58, 0, 116, 512);
  });

  // Crisp edge lane lines & orange/amber center dashed divider
  actx.fillStyle = '#E2E8F0';
  actx.fillRect(18, 0, 10, 512);
  actx.fillRect(484, 0, 10, 512);

  actx.fillStyle = '#F59E0B';
  for (let y = 16; y < 512; y += 128) {
    actx.fillRect(251, y, 10, 68);
  }

  const asphalt = configureColorTexture(new THREE.CanvasTexture(asphaltCanvas), anisotropy, 1, 1);
  const asphaltRoughness = configureColorTexture(
    new THREE.CanvasTexture(roughCanvas),
    anisotropy,
    1,
    1,
    true,
  );

  // 2. Woven Carbon Fiber Texture for Aero Splitters, Diffuser & GT Wing
  const cfCanvas = document.createElement('canvas');
  cfCanvas.width = 64;
  cfCanvas.height = 64;
  const cfCtx = cfCanvas.getContext('2d')!;
  cfCtx.fillStyle = '#12151C';
  cfCtx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const diag = ((x + y) / 8) % 2 === 0;
      cfCtx.fillStyle = diag ? '#1F2430' : '#0D1016';
      cfCtx.fillRect(x, y, 4, 8);
      cfCtx.fillStyle = diag ? '#2A3040' : '#161A22';
      cfCtx.fillRect(x + 4, y, 4, 8);
    }
  }
  const carbonFiber = configureColorTexture(new THREE.CanvasTexture(cfCanvas), anisotropy, 6, 6);

  // 3. Red-and-white racing curb texture
  const curbCanvas = document.createElement('canvas');
  curbCanvas.width = 128;
  curbCanvas.height = 256;
  const cctx = curbCanvas.getContext('2d')!;
  cctx.fillStyle = '#DC2626';
  cctx.fillRect(0, 0, 128, 128);
  cctx.fillStyle = '#F1F5F9';
  cctx.fillRect(0, 128, 128, 128);
  cctx.fillStyle = 'rgba(0,0,0,0.22)';
  cctx.fillRect(0, 0, 20, 256);
  const curb = configureColorTexture(new THREE.CanvasTexture(curbCanvas), anisotropy);

  // 4. Concrete barrier texture with hazard band
  const barrierCanvas = document.createElement('canvas');
  barrierCanvas.width = 256;
  barrierCanvas.height = 128;
  const bctx = barrierCanvas.getContext('2d')!;
  bctx.fillStyle = '#334155';
  bctx.fillRect(0, 0, 256, 128);
  bctx.fillStyle = '#1E293B';
  bctx.fillRect(0, 88, 256, 40);
  bctx.fillStyle = '#EA580C';
  bctx.fillRect(0, 14, 128, 16);
  bctx.fillStyle = '#E2E8F0';
  bctx.fillRect(128, 14, 128, 16);
  const barrier = configureColorTexture(new THREE.CanvasTexture(barrierCanvas), anisotropy);

  // 5. Start / Finish Checkered Strip
  const sfCanvas = document.createElement('canvas');
  sfCanvas.width = 512;
  sfCanvas.height = 128;
  const sfctx = sfCanvas.getContext('2d')!;
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const even = ((x / sq) + (y / sq)) % 2 === 0;
      sfctx.fillStyle = even ? '#F8FAFC' : '#0F172A';
      sfctx.fillRect(x, y, sq, sq);
    }
  }
  sfctx.fillStyle = '#F97316';
  sfctx.fillRect(0, 0, 512, 10);
  sfctx.fillRect(0, 118, 512, 10);
  const startFinish = configureColorTexture(new THREE.CanvasTexture(sfCanvas), anisotropy);

  // 6. Four Architectural Skyscraper Facade Styles (Albedo + Crisp Window-Only Emissive Maps)
  const buildings: THREE.CanvasTexture[] = [];
  const buildingEmissives: THREE.CanvasTexture[] = [];

  for (let variant = 0; variant < 4; variant++) {
    const w = 512;
    const h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const eCanvas = document.createElement('canvas');
    eCanvas.width = w;
    eCanvas.height = h;
    const eCtx = eCanvas.getContext('2d')!;
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, w, h);

    // Base structural cladding / curtain wall tone
    const baseCladding = ['#161F30', '#1C2029', '#131B26', '#211F24'][variant];
    ctx.fillStyle = baseCladding;
    ctx.fillRect(0, 0, w, h);

    // Architectural grid proportions per facade archetype
    const cols = [10, 8, 12, 8][variant];
    const rows = [28, 22, 32, 24][variant];
    const cellW = w / cols;
    const cellH = h / rows;

    // Subtle vertical cladding seam / structural pilaster background
    for (let c = 0; c < cols; c++) {
      const shade = c % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.14)';
      ctx.fillStyle = shade;
      ctx.fillRect(c * cellW, 0, cellW, h);
    }

    for (let r = 0; r < rows; r++) {
      const isMechFloor =
        (variant === 0 && (r === 9 || r === 19)) ||
        (variant === 2 && (r === 10 || r === 21));
      const isSkyLobby = variant === 0 && r === 14;

      if (isMechFloor) {
        // Louvered mechanical equipment floor (dark vents + subtle warning band)
        ctx.fillStyle = '#0B0F17';
        ctx.fillRect(0, r * cellH, w, cellH);
        ctx.fillStyle = '#1E293B';
        for (let lx = 6; lx < w; lx += 14) {
          ctx.fillRect(lx, r * cellH + 5, 7, cellH - 10);
        }
        continue;
      }

      // Horizontal floor spandrel beam & metallic sill highlight
      const spandrelH = variant === 1 ? 12 : 8;
      ctx.fillStyle = variant === 1 ? '#29303D' : '#0E1522';
      ctx.fillRect(0, r * cellH, w, spandrelH);
      ctx.fillStyle = variant === 1 ? 'rgba(226, 200, 150, 0.16)' : 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(0, r * cellH + spandrelH, w, 2);

      // Coherent floor occupancy (clusters of lit offices / apartments)
      const floorOccupancy = isSkyLobby ? 0.88 : 0.22 + ((r * 37 + variant * 13) % 10) * 0.055;
      const roomRun = 2 + ((r * 7 + variant) % 3);
      let suiteLit = false;
      let suiteWarm = true;
      let suiteAlpha = 0.7;

      for (let c = 0; c < cols; c++) {
        if (c % roomRun === 0) {
          suiteLit = Math.random() < floorOccupancy;
          suiteWarm = variant === 3 ? Math.random() < 0.82 : Math.random() < 0.56;
          suiteAlpha = 0.45 + Math.random() * 0.48;
        }

        const winPadX = variant === 1 ? 7 : 4;
        const winX = c * cellW + winPadX;
        const winY = r * cellH + spandrelH + 3;
        const winW = cellW - winPadX * 2;
        const winH = cellH - spandrelH - 5;

        if (suiteLit) {
          // Warm tungsten office / cool daylight LED / cyan tech glow
          const tint =
            variant === 2 && !suiteWarm
              ? `rgba(103, 232, 249, ${suiteAlpha})`
              : suiteWarm
                ? `rgba(253, 224, 155, ${suiteAlpha})`
                : `rgba(186, 230, 253, ${suiteAlpha})`;
          ctx.fillStyle = tint;
          ctx.fillRect(winX, winY, winW, winH);

          // Subtle interior ceiling fixture bar & blinds shadow at top 25%
          ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
          ctx.fillRect(winX, winY + winH * 0.68, winW, winH * 0.32);

          eCtx.fillStyle = tint;
          eCtx.fillRect(winX, winY, winW, winH * 0.88);
        } else {
          // Dark tinted architectural glass with subtle sky reflection gradient
          const glassGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
          glassGrad.addColorStop(0, variant === 0 ? '#24354F' : '#1E293B');
          glassGrad.addColorStop(1, '#0D131F');
          ctx.fillStyle = glassGrad;
          ctx.fillRect(winX, winY, winW, winH);
        }

        // Fine inner window mullion divider
        if (variant !== 1 && winW > 22) {
          ctx.fillStyle = 'rgba(12, 16, 24, 0.68)';
          ctx.fillRect(winX + winW * 0.5 - 1, winY, 2, winH);
          eCtx.fillStyle = '#000000';
          eCtx.fillRect(winX + winW * 0.5 - 1, winY, 2, winH);
        }

        // Residential balcony guardrail bar on variant 3
        if (variant === 3 && c % 2 === 1) {
          ctx.fillStyle = '#0B0E14';
          ctx.fillRect(c * cellW + 2, winY + winH - 7, cellW - 4, 4);
          eCtx.fillStyle = '#000000';
          eCtx.fillRect(c * cellW + 2, winY + winH - 7, cellW - 4, 4);
        }
      }

      // Vertical corner mullions / concrete piers
      if (variant === 1 || variant === 2) {
        ctx.fillStyle = variant === 1 ? '#2E3440' : '#0F172A';
        ctx.fillRect(0, r * cellH, 10, cellH);
        ctx.fillRect(w - 10, r * cellH, 10, cellH);
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(0, r * cellH, 10, cellH);
        eCtx.fillRect(w - 10, r * cellH, 10, cellH);
      }
    }

    // Subtle structural accent LED vertical rib on tech tower variant 2
    if (variant === 2) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(14, 0, 3, h);
      ctx.fillRect(w - 17, 0, 3, h);
      eCtx.fillStyle = '#38BDF8';
      eCtx.fillRect(14, 0, 3, h);
      eCtx.fillRect(w - 17, 0, 3, h);
    }

    buildings.push(configureColorTexture(new THREE.CanvasTexture(canvas), anisotropy));
    buildingEmissives.push(configureColorTexture(new THREE.CanvasTexture(eCanvas), anisotropy));
  }

  // 6b. Street-Level Retail & Grand Lobby Podium Facade
  const podCanvas = document.createElement('canvas');
  podCanvas.width = 512;
  podCanvas.height = 256;
  const pCtx = podCanvas.getContext('2d')!;
  pCtx.fillStyle = '#141923';
  pCtx.fillRect(0, 0, 512, 256);

  // Granite mezzanine frieze & warm cornice bar
  pCtx.fillStyle = '#262E3D';
  pCtx.fillRect(0, 0, 512, 34);
  pCtx.fillStyle = '#F59E0B';
  pCtx.fillRect(0, 34, 512, 5);

  // Ground-floor double-height glass arcade bays separated by stone columns
  const podCols = 6;
  const podBayW = 512 / podCols;
  for (let i = 0; i < podCols; i++) {
    const bx = i * podBayW;
    // Stone column pier
    pCtx.fillStyle = '#222938';
    pCtx.fillRect(bx, 39, 14, 217);
    // Warm lit storefront / lobby glass
    const storeGrad = pCtx.createLinearGradient(0, 52, 0, 240);
    storeGrad.addColorStop(0, i % 2 === 0 ? 'rgba(253, 224, 155, 0.85)' : 'rgba(186, 230, 253, 0.72)');
    storeGrad.addColorStop(0.55, 'rgba(30, 41, 59, 0.92)');
    storeGrad.addColorStop(1, '#0F172A');
    pCtx.fillStyle = storeGrad;
    pCtx.fillRect(bx + 16, 48, podBayW - 20, 192);
    // Transom mullion
    pCtx.fillStyle = '#0B0F17';
    pCtx.fillRect(bx + 16, 128, podBayW - 20, 6);
  }
  // Granite base plinth
  pCtx.fillStyle = '#0B0E14';
  pCtx.fillRect(0, 236, 512, 20);
  const buildingPodium = configureColorTexture(new THREE.CanvasTexture(podCanvas), anisotropy, 2, 1);

  // 6c. Urban City Block & Plaza Sidewalk Ground Grid
  const ugCanvas = document.createElement('canvas');
  ugCanvas.width = 512;
  ugCanvas.height = 512;
  const uCtx = ugCanvas.getContext('2d')!;
  uCtx.fillStyle = '#0F141D';
  uCtx.fillRect(0, 0, 512, 512);
  // Subtle cross-street dark avenues
  uCtx.fillStyle = '#090C12';
  uCtx.fillRect(0, 0, 512, 36);
  uCtx.fillRect(0, 246, 512, 24);
  uCtx.fillRect(0, 0, 36, 512);
  uCtx.fillRect(246, 0, 24, 512);
  // Concrete sidewalk curbs around city blocks
  uCtx.strokeStyle = '#252E3E';
  uCtx.lineWidth = 4;
  uCtx.strokeRect(40, 40, 202, 202);
  uCtx.strokeRect(274, 40, 234, 202);
  uCtx.strokeRect(40, 274, 202, 234);
  uCtx.strokeRect(274, 274, 234, 234);
  // Faint plaza tile grid
  uCtx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  uCtx.lineWidth = 1;
  for (let p = 64; p < 512; p += 32) {
    uCtx.beginPath();
    uCtx.moveTo(p, 0);
    uCtx.lineTo(p, 512);
    uCtx.stroke();
    uCtx.beginPath();
    uCtx.moveTo(0, p);
    uCtx.lineTo(512, p);
    uCtx.stroke();
  }
  const urbanGround = configureColorTexture(new THREE.CanvasTexture(ugCanvas), anisotropy, 16, 16);

  // 7. Soft Radial Contact Shadow under cars
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(128, 128, 22, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.48)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  // 8. Soft Feathered Smoke Puff Sprite Texture
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const smCtx = smokeCanvas.getContext('2d')!;
  const smGrad = smCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  smGrad.addColorStop(0, 'rgba(226, 232, 240, 0.72)');
  smGrad.addColorStop(0.45, 'rgba(203, 213, 225, 0.34)');
  smGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');
  smCtx.fillStyle = smGrad;
  smCtx.fillRect(0, 0, 128, 128);
  const smokePuff = new THREE.CanvasTexture(smokeCanvas);
  smokePuff.colorSpace = THREE.SRGBColorSpace;
  smokePuff.needsUpdate = true;

  // 9. Headlight Asphalt Projection Cone Texture
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 256;
  beamCanvas.height = 256;
  const bmCtx = beamCanvas.getContext('2d')!;
  bmCtx.clearRect(0, 0, 256, 256);
  const bmGrad = bmCtx.createLinearGradient(0, 256, 0, 0);
  bmGrad.addColorStop(0, 'rgba(224, 242, 254, 0.48)');
  bmGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.16)');
  bmGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
  bmCtx.fillStyle = bmGrad;
  bmCtx.beginPath();
  bmCtx.moveTo(96, 256);
  bmCtx.lineTo(160, 256);
  bmCtx.lineTo(248, 0);
  bmCtx.lineTo(8, 0);
  bmCtx.closePath();
  bmCtx.fill();
  const headlightBeam = new THREE.CanvasTexture(beamCanvas);
  headlightBeam.colorSpace = THREE.SRGBColorSpace;
  headlightBeam.needsUpdate = true;

  // 10. Soft Additive Glow Halo (for headlights, tailglow, streetlights)
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hCtx = haloCanvas.getContext('2d')!;
  const hGrad = hCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  hGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  hGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.35)');
  hGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  hCtx.fillStyle = hGrad;
  hCtx.fillRect(0, 0, 128, 128);
  const glowHalo = new THREE.CanvasTexture(haloCanvas);
  glowHalo.colorSpace = THREE.SRGBColorSpace;
  glowHalo.needsUpdate = true;

  // 11. Twilight Metropolitan Sky Gradient
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 32;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0.0, '#060911');
  skyGrad.addColorStop(0.45, '#10182B');
  skyGrad.addColorStop(0.75, '#24213A');
  skyGrad.addColorStop(0.91, '#582E35');
  skyGrad.addColorStop(1.0, '#141821');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 32, 256);
  const sky = new THREE.CanvasTexture(skyCanvas);
  sky.colorSpace = THREE.SRGBColorSpace;
  sky.needsUpdate = true;

  // 12. Semi-Slick Racing Tire Tread + Sidewall Motorsport Stripe
  const tireCanvas = document.createElement('canvas');
  tireCanvas.width = 256;
  tireCanvas.height = 256;
  const tCtx = tireCanvas.getContext('2d')!;
  tCtx.fillStyle = '#15181F';
  tCtx.fillRect(0, 0, 256, 256);
  // Subtle rubber grain
  for (let i = 0; i < 1800; i++) {
    const shade = 18 + Math.floor(Math.random() * 14);
    tCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 6})`;
    tCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Circumferential racing tread grooves (Lathe U wraps around, V runs across profile)
  tCtx.fillStyle = '#0B0D11';
  tCtx.fillRect(0, 88, 256, 7);
  tCtx.fillRect(0, 125, 256, 6);
  tCtx.fillRect(0, 161, 256, 7);
  // Diagonal shoulder sipes for clear rotational feedback
  tCtx.strokeStyle = '#0C0E13';
  tCtx.lineWidth = 4;
  for (let x = 0; x < 256; x += 16) {
    tCtx.beginPath();
    tCtx.moveTo(x, 60);
    tCtx.lineTo(x + 8, 86);
    tCtx.stroke();
    tCtx.beginPath();
    tCtx.moveTo(x + 8, 170);
    tCtx.lineTo(x, 196);
    tCtx.stroke();
  }
  // Motorsport sidewall arc dashes (makes high-speed wheel spin visually legible)
  tCtx.fillStyle = '#F97316';
  for (let x = 12; x < 256; x += 64) {
    tCtx.fillRect(x, 22, 34, 6);
    tCtx.fillRect(x, 228, 34, 6);
  }
  const tireTread = configureColorTexture(new THREE.CanvasTexture(tireCanvas), anisotropy, 1, 1);

  // 13. Cross-Drilled Carbon-Ceramic Brake Rotor
  const rotorCanvas = document.createElement('canvas');
  rotorCanvas.width = 256;
  rotorCanvas.height = 256;
  const roCtx = rotorCanvas.getContext('2d')!;
  roCtx.fillStyle = '#64748B';
  roCtx.fillRect(0, 0, 256, 256);
  for (let r = 40; r < 124; r += 4) {
    roCtx.strokeStyle = r % 8 === 0 ? '#94A3B8' : '#475569';
    roCtx.lineWidth = 1.5;
    roCtx.beginPath();
    roCtx.arc(128, 128, r, 0, Math.PI * 2);
    roCtx.stroke();
  }
  roCtx.fillStyle = '#1E293B';
  for (let a = 0; a < 12; a++) {
    const baseAngle = (a / 12) * Math.PI * 2;
    for (let k = 0; k < 4; k++) {
      const rr = 66 + k * 14;
      const ang = baseAngle + k * 0.08;
      roCtx.beginPath();
      roCtx.arc(128 + Math.cos(ang) * rr, 128 + Math.sin(ang) * rr, 3.2, 0, Math.PI * 2);
      roCtx.fill();
    }
  }
  const brakeRotor = new THREE.CanvasTexture(rotorCanvas);
  brakeRotor.colorSpace = THREE.SRGBColorSpace;
  brakeRotor.needsUpdate = true;

  // 14. Honeycomb Intake Grille Mesh
  const gCanvas = document.createElement('canvas');
  gCanvas.width = 64;
  gCanvas.height = 64;
  const gCtx = gCanvas.getContext('2d')!;
  gCtx.fillStyle = '#06080C';
  gCtx.fillRect(0, 0, 64, 64);
  gCtx.strokeStyle = '#1E2532';
  gCtx.lineWidth = 2;
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      gCtx.strokeRect(x + ((y / 8) % 2) * 4, y, 6, 6);
    }
  }
  const grilleMesh = configureColorTexture(new THREE.CanvasTexture(gCanvas), anisotropy, 8, 2);

  return {
    asphalt,
    asphaltRoughness,
    carbonFiber,
    tireTread,
    brakeRotor,
    grilleMesh,
    curb,
    barrier,
    startFinish,
    buildings,
    buildingEmissives,
    buildingPodium,
    urbanGround,
    contactShadow,
    smokePuff,
    headlightBeam,
    glowHalo,
    sky,
    dispose: () => {
      asphalt.dispose();
      asphaltRoughness.dispose();
      carbonFiber.dispose();
      tireTread.dispose();
      brakeRotor.dispose();
      grilleMesh.dispose();
      curb.dispose();
      barrier.dispose();
      startFinish.dispose();
      buildings.forEach((b) => b.dispose());
      buildingEmissives.forEach((e) => e.dispose());
      buildingPodium.dispose();
      urbanGround.dispose();
      contactShadow.dispose();
      smokePuff.dispose();
      headlightBeam.dispose();
      glowHalo.dispose();
      sky.dispose();
    },
  };
}
