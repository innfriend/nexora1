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

  // 6. Three skyscraper illuminated window facade styles
  const buildings: THREE.CanvasTexture[] = [0, 1, 2].map((variant) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const baseColors = ['#101624', '#141C2C', '#121621'];
    ctx.fillStyle = baseColors[variant];
    ctx.fillRect(0, 0, 256, 512);

    const cols = variant === 1 ? 8 : 6;
    const rows = variant === 2 ? 22 : 16;
    const padX = 8;
    const padY = 8;
    const cellW = 256 / cols;
    const cellH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const rowLitBias = Math.random() * 0.48 + 0.24;
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() < rowLitBias;
        if (lit) {
          const warm = Math.random() < 0.64;
          ctx.fillStyle = warm
            ? `rgba(253, 224, 155, ${0.48 + Math.random() * 0.44})`
            : `rgba(147, 197, 253, ${0.38 + Math.random() * 0.4})`;
        } else {
          ctx.fillStyle = '#1E293B';
        }
        ctx.fillRect(
          c * cellW + padX * 0.5,
          r * cellH + padY * 0.5,
          cellW - padX,
          cellH - padY,
        );
      }
    }
    return configureColorTexture(new THREE.CanvasTexture(canvas), anisotropy);
  });

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
      contactShadow.dispose();
      smokePuff.dispose();
      headlightBeam.dispose();
      glowHalo.dispose();
      sky.dispose();
    },
  };
}
