import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RaceAudioEngine } from './audio';
import { createSportsCarMesh, SportsCarMeshHandles } from './carModel';
import {
  getDailyChallengeSnapshot,
  recordDailyAttemptStart,
  recordDailyProgress,
} from './dailyChallenge';
import {
  computeAiInput,
  createVehicleOnGrid,
  resolveVehicleCollisions,
  stepVehiclePhysics,
  VehicleState,
} from './physics';
import {
  ReplayRecorder,
  ReplayRecording,
  ReplayVehicleSnapshot,
  sampleReplayAtTime,
} from './replay';
import { recordDriftKingRun, recordHighwayRushRun, recordRaceCompletion } from './storage';
import { DriftKingSession, DriftStepOutput } from './driftKing';
import { HighwayRushWorld, HighwayStepResult } from './highwayRush';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { CityCircuit, createCityCircuit } from './track';
import {
  CAR_LIVERIES,
  DailyChallengeResultSummary,
  DailyTaskStatus,
  Difficulty,
  GameMode,
  GamePhase,
  GameSettings,
  GameTitle,
  HudTelemetry,
  InputState,
  RaceResult,
  RaceStanding,
  ReplayCameraMode,
  ReplayStatus,
  TrackLayoutId,
} from './types';

interface CarActor {
  state: VehicleState;
  mesh: SportsCarMeshHandles;
}

interface SmokeParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface SkidMark {
  mesh: THREE.Mesh;
}

interface SpeedStreak {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  speed: number;
}

export interface EngineCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onTelemetry: (telemetry: HudTelemetry) => void;
  onRaceFinished: (result: RaceResult) => void;
  onReplayStatus: (status: ReplayStatus) => void;
  onWebglError: (message: string) => void;
}

const TOTAL_RACE_LAPS = 3;

const AI_ROSTER = [
  { id: 'ai-1', name: 'K. Sato', color: '#2563EB', accent: '#0F172A', number: '12', lane: -3.2, skill: 1.0 },
  { id: 'ai-2', name: 'M. Vance', color: '#10B981', accent: '#0F172A', number: '24', lane: 3.2, skill: 0.96 },
  { id: 'ai-3', name: 'L. Moreau', color: '#94A3B8', accent: '#1E293B', number: '88', lane: 0.0, skill: 0.92 },
];

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class NexoraRaceEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private audio: RaceAudioEngine;
  private settings: GameSettings;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private dirLight!: THREE.DirectionalLight;
  private textures!: ProceduralTextureSet;
  private circuit!: CityCircuit;
  private highwayWorld!: HighwayRushWorld;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  private isSoftwareGl = false;
  private disposed = false;
  private frameId = 0;
  private lastTimestamp = 0;

  private actors: CarActor[] = [];
  private smokePool: SmokeParticle[] = [];
  private smokeCursor = 0;
  private smokeGeo!: THREE.PlaneGeometry;

  private sparkPool: SparkParticle[] = [];
  private sparkCursor = 0;
  private sparkGeo!: THREE.BoxGeometry;
  private sparkMat!: THREE.MeshBasicMaterial;

  private skidPool: SkidMark[] = [];
  private skidCursor = 0;
  private skidGeo!: THREE.PlaneGeometry;
  private skidMat!: THREE.MeshBasicMaterial;

  private speedStreaksGroup!: THREE.Group;
  private speedStreaks: SpeedStreak[] = [];
  private streakGeo!: THREE.BoxGeometry;
  private streakMat!: THREE.MeshBasicMaterial;

  private activeGameTitle: GameTitle = 'street-racer';
  private phase: GamePhase = 'menu';
  private mode: GameMode = 'circuit';
  private difficulty: Difficulty = 'normal';
  private currentLayoutId: TrackLayoutId = 'metro-loop';

  private driftSession = new DriftKingSession();
  private lastHighwayResult: HighwayStepResult | null = null;
  private lastDriftResult: DriftStepOutput | null = null;
  private highwayPlayerProxy: VehicleState = {
    id: 'player',
    name: 'You (Nexora GT3)',
    isPlayer: true,
    color: '#E84A1B',
    x: 1.8,
    y: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    steerVisual: 0,
    wheelSpinAngle: 0,
    chassisPitch: 0,
    chassisRoll: 0,
    roadPitch: 0,
    drifting: false,
    braking: false,
    trackSampleIndex: 0,
    trackDistance: 0,
    lateralOffset: 0,
    lap: 1,
    nextCheckpointIndex: 1,
    lapStartTimeMs: 0,
    bestLapMs: null,
    lapTimesMs: [],
    totalProgress: 0,
    finished: false,
    finishTimeMs: null,
    aiLaneOffset: 0,
    aiSpeedSkill: 1,
  };

  private dailyDateKey = '';
  private dailyTasks: DailyTaskStatus[] = [];
  private dailySessionNewlyCleared = new Set<string>();

  private countdownRemaining = 0;
  private lastCountdownInt = -1;
  private raceElapsedMs = 0;
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private hudEmitAccum = 0;

  private input: InputState = {
    accelerate: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    handbrake: false,
  };

  // Pre-allocated camera vectors (zero GC in render loop)
  private camPos = new THREE.Vector3(-135, 6, -42);
  private camTarget = new THREE.Vector3(-135, 1, -20);
  private desiredCamPos = new THREE.Vector3();
  private desiredCamTarget = new THREE.Vector3();
  private attractAngle = 0;

  // Replay recording & playback state
  private replayRecorder = new ReplayRecorder();
  private activeReplay: ReplayRecording | null = null;
  private replayPlaying = true;
  private replayTimeMs = 0;
  private replaySpeed = 1;
  private replayCameraMode: ReplayCameraMode = 'chase';
  private replayOrbitAngle = 0.6;
  private replayReturnPhase: 'finished' | 'paused' = 'finished';
  private broadcastStationPos = new THREE.Vector3();
  private broadcastStationDist = -999;
  private broadcastSampleHint: number | undefined = undefined;

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    audio: RaceAudioEngine,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.settings = { ...settings };
    this.audio = audio;
    this.callbacks = callbacks;

    this.initScene();
  }

  private initScene(): void {
    this.isSoftwareGl = detectSoftwareWebGL();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl && this.settings.quality !== 'low',
        powerPreference: 'high-performance',
      });
    } catch {
      this.callbacks.onWebglError('WebGL is unavailable on this browser or device.');
      return;
    }

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.applyQualitySettings();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1120);
    this.scene.fog = new THREE.FogExp2(0x131928, 0.0024);

    // Studio/Twilight PBR environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    pmrem.dispose();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.3, 950);

    // Warm Sunset Key + Cool Sky Fill Lighting Rig
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.72);
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    this.dirLight.position.set(80, 110, 60);
    this.dirLight.castShadow = !this.isSoftwareGl && this.settings.quality !== 'low';
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 260;
    const d = 55;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.025;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Procedural Textures, Closed-Loop City Circuit & Endless Highway World
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.circuit = createCityCircuit(this.textures, this.currentLayoutId);
    this.scene.add(this.circuit.group);

    this.highwayWorld = new HighwayRushWorld(this.textures);
    this.highwayWorld.group.visible = false;
    this.scene.add(this.highwayWorld.group);

    // Soft Feathered Billboard Tire Smoke Pool (Zero-GC)
    this.smokeGeo = new THREE.PlaneGeometry(1.15, 1.15);
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures.smokePuff,
        color: 0xdbeafe,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new THREE.Mesh(this.smokeGeo, mat);
      m.visible = false;
      this.scene.add(m);
      this.smokePool.push({ mesh: m, mat, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.55 });
    }

    // Persistent Asphalt Skid Mark Pool
    this.skidGeo = new THREE.PlaneGeometry(0.32, 1.25);
    this.skidGeo.rotateX(-Math.PI / 2);
    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x090b0f,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(this.skidGeo, this.skidMat);
      m.visible = false;
      this.scene.add(m);
      this.skidPool.push({ mesh: m });
    }

    // Collision Metallic Spark Burst Pool
    this.sparkGeo = new THREE.BoxGeometry(0.055, 0.055, 0.42);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 32; i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      m.visible = false;
      this.scene.add(m);
      this.sparkPool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.35 });
    }

    // High-Speed Peripheral Wind Streaks attached to Camera
    this.speedStreaksGroup = new THREE.Group();
    this.camera.add(this.speedStreaksGroup);
    this.scene.add(this.camera);

    this.streakGeo = new THREE.BoxGeometry(0.025, 0.025, 2.2);
    this.streakMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const radius = 3.2 + Math.random() * 2.4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.68;
      const z = -4 - Math.random() * 14;
      const m = new THREE.Mesh(this.streakGeo, this.streakMat);
      m.position.set(x, y, z);
      this.speedStreaksGroup.add(m);
      this.speedStreaks.push({ mesh: m, x, y, z, speed: 28 + Math.random() * 16 });
    }

    // Spawn attract-mode cars on grid
    this.spawnCars('circuit', 'normal');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.lastTimestamp = performance.now();
    this.scheduleNextTick();
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
  };

  private handleContextRestored = (): void => {
    this.lastTimestamp = performance.now();
    this.scheduleNextTick();
  };

  private applyQualitySettings(): void {
    if (!this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const maxRatio =
      this.isSoftwareGl || this.settings.quality === 'low'
        ? 1
        : this.settings.quality === 'medium'
          ? Math.min(window.devicePixelRatio, 1.4)
          : Math.min(window.devicePixelRatio, 2);

    this.renderer.setPixelRatio(maxRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (this.dirLight) {
      this.dirLight.castShadow = this.renderer.shadowMap.enabled;
    }
  }

  public updateSettings(next: GameSettings): void {
    const liveryChanged = next.liveryId !== this.settings.liveryId;
    this.settings = { ...next };
    this.applyQualitySettings();
    this.audio.setSettings(next.soundEnabled, next.volume);

    if (liveryChanged) {
      const livery = CAR_LIVERIES.find((l) => l.id === next.liveryId) ?? CAR_LIVERIES[0];
      const player = this.actors.find((a) => a.state.isPlayer);
      if (player) {
        player.state.color = livery.bodyHex;
        player.mesh.paintMat.color.set(livery.bodyHex);
      }
    }
  }

  public setInput(next: Partial<InputState>): void {
    Object.assign(this.input, next);
  }

  public clearInputs(): void {
    this.input.accelerate = false;
    this.input.brake = false;
    this.input.steerLeft = false;
    this.input.steerRight = false;
    this.input.handbrake = false;
  }

  public getMinimapInfo() {
    return this.circuit ? this.circuit.getMinimapPath() : { points: [], bounds: { minX: -150, maxX: 170, minZ: -140, maxZ: 155 } };
  }

  private clearActors(): void {
    this.actors.forEach((a) => {
      this.scene.remove(a.mesh.root);
      a.mesh.dispose();
    });
    this.actors = [];
  }

  private spawnCars(mode: GameMode, difficulty: Difficulty): void {
    this.clearActors();

    const livery = CAR_LIVERIES.find((l) => l.id === this.settings.liveryId) ?? CAR_LIVERIES[0];
    const hasAi = mode === 'circuit';
    const playerSlot = hasAi ? 3 : 0;

    if (hasAi) {
      AI_ROSTER.forEach((ai, idx) => {
        const state = createVehicleOnGrid(
          ai.id,
          ai.name,
          false,
          ai.color,
          this.circuit,
          idx,
          ai.lane,
          ai.skill,
        );
        const mesh = createSportsCarMesh({
          bodyColor: ai.color,
          accentColor: ai.accent,
          rimColor: '#CBD5E1',
          carNumber: ai.number,
          contactShadowTexture: this.textures.contactShadow,
          carbonTexture: this.textures.carbonFiber,
          tireTexture: this.textures.tireTread,
          brakeRotorTexture: this.textures.brakeRotor,
          grilleTexture: this.textures.grilleMesh,
          headlightBeamTexture: this.textures.headlightBeam,
          glowHaloTexture: this.textures.glowHalo,
          showHeadlightBeams: true,
        });
        this.syncCarTransform(state, mesh);
        this.scene.add(mesh.root);
        this.actors.push({ state, mesh });
      });
    }

    const playerState = createVehicleOnGrid(
      'player',
      'You (Nexora GT3)',
      true,
      livery.bodyHex,
      this.circuit,
      playerSlot,
      0,
      1,
    );
    const playerMesh = createSportsCarMesh({
      bodyColor: livery.bodyHex,
      accentColor: livery.accentHex,
      rimColor: livery.rimHex,
      carNumber: '07',
      contactShadowTexture: this.textures.contactShadow,
      carbonTexture: this.textures.carbonFiber,
      tireTexture: this.textures.tireTread,
      brakeRotorTexture: this.textures.brakeRotor,
      grilleTexture: this.textures.grilleMesh,
      headlightBeamTexture: this.textures.headlightBeam,
      glowHaloTexture: this.textures.glowHalo,
      showHeadlightBeams: true,
    });
    this.syncCarTransform(playerState, playerMesh);
    this.scene.add(playerMesh.root);
    this.actors.push({ state: playerState, mesh: playerMesh });

    // Snap camera immediately behind player so there's zero launch jump
    const fwdX = Math.sin(playerState.heading);
    const fwdZ = Math.cos(playerState.heading);
    this.camPos.set(
      playerState.x - fwdX * 10.5,
      playerState.y + 4.0,
      playerState.z - fwdZ * 10.5,
    );
    this.camTarget.set(playerState.x + fwdX * 6, playerState.y + 1.2, playerState.z + fwdZ * 6);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.difficulty = difficulty;
  }

  private syncHighwayProxy(): void {
    const h = this.highwayWorld;
    const p = this.highwayPlayerProxy;
    p.x = h.playerX;
    p.y = 0;
    p.z = h.playerZ;
    p.heading = h.playerHeading;
    p.vx = h.playerVx;
    p.vz = h.playerSpeed;
    p.speed = h.playerSpeed;
    p.steerVisual = h.steerVisual;
    p.wheelSpinAngle = h.wheelSpinAngle;
    p.chassisPitch = h.chassisPitch;
    p.chassisRoll = h.chassisRoll;
    p.roadPitch = 0;
    p.drifting = h.drifting;
    p.braking = h.braking;
  }

  private spawnHighwayPlayerCar(): void {
    this.clearActors();
    const livery = CAR_LIVERIES.find((l) => l.id === this.settings.liveryId) ?? CAR_LIVERIES[0];
    this.highwayPlayerProxy.color = livery.bodyHex;
    this.syncHighwayProxy();

    const playerMesh = createSportsCarMesh({
      bodyColor: livery.bodyHex,
      accentColor: livery.accentHex,
      rimColor: livery.rimHex,
      carNumber: '07',
      contactShadowTexture: this.textures.contactShadow,
      carbonTexture: this.textures.carbonFiber,
      tireTexture: this.textures.tireTread,
      brakeRotorTexture: this.textures.brakeRotor,
      grilleTexture: this.textures.grilleMesh,
      headlightBeamTexture: this.textures.headlightBeam,
      glowHaloTexture: this.textures.glowHalo,
      showHeadlightBeams: true,
    });
    this.syncCarTransform(this.highwayPlayerProxy, playerMesh);
    this.scene.add(playerMesh.root);
    this.actors.push({ state: this.highwayPlayerProxy, mesh: playerMesh });

    this.camPos.set(this.highwayPlayerProxy.x, 3.6, this.highwayPlayerProxy.z - 9.2);
    this.camTarget.set(this.highwayPlayerProxy.x, 1.25, this.highwayPlayerProxy.z + 8);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  public setGameTitle(title: GameTitle, layoutId?: TrackLayoutId): void {
    if (!this.scene || !this.textures) return;
    this.activeGameTitle = title;

    if (title === 'highway-rush') {
      this.circuit.group.visible = false;
      this.highwayWorld.group.visible = true;
      this.highwayWorld.reset(false);
      if (this.phase === 'menu') {
        this.spawnHighwayPlayerCar();
      }
      return;
    }

    this.highwayWorld.group.visible = false;
    this.circuit.group.visible = true;

    const targetLayout: TrackLayoutId =
      title === 'drift-king' ? 'drift-touge' : layoutId ?? 'metro-loop';

    if (targetLayout !== this.currentLayoutId) {
      this.setTrackLayout(targetLayout);
    } else if (this.phase === 'menu') {
      this.spawnCars(title === 'drift-king' ? 'time-trial' : 'circuit', this.settings.difficulty);
    }
  }

  public setTrackLayout(layoutId: TrackLayoutId): void {
    if (!this.scene || !this.textures || layoutId === this.currentLayoutId) return;
    this.currentLayoutId = layoutId;
    if (this.circuit) {
      this.scene.remove(this.circuit.group);
      this.circuit.dispose();
    }
    this.circuit = createCityCircuit(this.textures, layoutId);
    this.circuit.group.visible = this.activeGameTitle !== 'highway-rush';
    this.scene.add(this.circuit.group);
    if (this.phase === 'menu' && this.activeGameTitle !== 'highway-rush') {
      this.spawnCars(
        this.activeGameTitle === 'drift-king' ? 'time-trial' : 'circuit',
        this.settings.difficulty,
      );
    }
  }

  public startRace(
    mode: GameMode,
    difficulty: Difficulty,
    trackLayoutId?: TrackLayoutId,
    gameTitle: GameTitle = 'street-racer',
  ): void {
    this.audio.unlock();
    this.activeGameTitle = gameTitle;
    this.mode = gameTitle === 'drift-king' ? 'time-trial' : mode;
    this.difficulty = difficulty;
    this.clearInputs();
    this.raceElapsedMs = 0;
    this.bannerText = null;
    this.bannerTimer = 0;
    this.activeReplay = null;
    this.lastHighwayResult = null;
    this.lastDriftResult = null;

    // Reset transient effects pools
    this.smokePool.forEach((p) => {
      p.life = 0;
      p.mesh.visible = false;
    });
    this.sparkPool.forEach((s) => {
      s.life = 0;
      s.mesh.visible = false;
    });
    this.skidPool.forEach((k) => {
      k.mesh.visible = false;
    });
    this.hideSpeedStreaks();

    if (gameTitle === 'highway-rush') {
      this.circuit.group.visible = false;
      this.highwayWorld.group.visible = true;
      this.highwayWorld.reset(true);
      this.spawnHighwayPlayerCar();
      this.dailyDateKey = '';
      this.dailyTasks = [];
      this.dailySessionNewlyCleared.clear();
      this.lastHighwayResult = {
        score: 0,
        distanceKm: 0,
        comboMultiplier: 1,
        comboTimerRatio: 0,
        nearMissCount: 0,
        maxCombo: 1,
        wallImpact: 0,
        skidIntensity: 0,
        crashed: false,
        eventBanner: null,
      };
      this.phase = 'countdown';
      this.countdownRemaining = 3.2;
      this.lastCountdownInt = 4;
      this.callbacks.onPhaseChange('countdown');
      this.emitHud();
      return;
    }

    this.highwayWorld.group.visible = false;
    this.circuit.group.visible = true;

    if (gameTitle === 'drift-king') {
      this.setTrackLayout('drift-touge');
      this.dailyDateKey = '';
      this.dailyTasks = [];
      this.dailySessionNewlyCleared.clear();
      this.driftSession.reset();
      this.lastDriftResult = this.driftSession.step(this.highwayPlayerProxy, 0, null, 0);
      this.spawnCars('time-trial', difficulty);
      this.phase = 'countdown';
      this.countdownRemaining = 3.2;
      this.lastCountdownInt = 4;
      this.callbacks.onPhaseChange('countdown');
      this.emitHud();
      return;
    }

    if (mode === 'daily-challenge') {
      const snap = getDailyChallengeSnapshot();
      const targetLayout = trackLayoutId ?? snap.layoutId;
      this.setTrackLayout(targetLayout);
      this.dailyDateKey = snap.dateKey;
      this.dailyTasks = snap.tasks.map((t) => ({ ...t }));
      this.dailySessionNewlyCleared.clear();
      recordDailyAttemptStart(snap.dateKey);
    } else {
      this.setTrackLayout(trackLayoutId ?? 'metro-loop');
      this.dailyDateKey = '';
      this.dailyTasks = [];
      this.dailySessionNewlyCleared.clear();
    }

    this.replayRecorder.reset(mode, difficulty, mode === 'free-drive' ? 0 : TOTAL_RACE_LAPS);
    this.spawnCars(mode, difficulty);

    if (mode === 'free-drive') {
      this.phase = 'racing';
      this.countdownRemaining = 0;
      this.bannerText = 'FREE DRIVE — EXPLORE THE CIRCUIT';
      this.bannerTimer = 2.6;
      this.callbacks.onPhaseChange('racing');
    } else {
      this.phase = 'countdown';
      this.countdownRemaining = 3.2;
      this.lastCountdownInt = 4;
      this.callbacks.onPhaseChange('countdown');
    }
    this.emitHud();
  }

  private hideSpeedStreaks(): void {
    if (this.speedStreaksGroup) {
      this.speedStreaksGroup.visible = false;
    }
    if (this.streakMat) {
      this.streakMat.opacity = 0;
    }
  }

  public pauseRace(): void {
    if (this.phase === 'racing' || this.phase === 'countdown') {
      this.phase = 'paused';
      this.clearInputs();
      this.hideSpeedStreaks();
      this.audio.setDrivingState(false, 0, false, 0);
      this.callbacks.onPhaseChange('paused');
    }
  }

  public resumeRace(): void {
    if (this.phase === 'paused') {
      this.phase = this.countdownRemaining > 0.2 ? 'countdown' : 'racing';
      this.lastTimestamp = performance.now();
      this.callbacks.onPhaseChange(this.phase);
    }
  }

  public returnToMenu(layoutId?: TrackLayoutId, gameTitle?: GameTitle): void {
    this.phase = 'menu';
    if (gameTitle) {
      this.activeGameTitle = gameTitle;
    }
    this.clearInputs();
    this.hideSpeedStreaks();
    this.smokePool.forEach((p) => {
      p.life = 0;
      p.mesh.visible = false;
    });
    this.sparkPool.forEach((s) => {
      s.life = 0;
      s.mesh.visible = false;
    });
    this.skidPool.forEach((k) => {
      k.mesh.visible = false;
    });
    this.audio.setDrivingState(false, 0, false, 0);

    if (this.activeGameTitle === 'highway-rush') {
      this.setGameTitle('highway-rush');
    } else if (this.activeGameTitle === 'drift-king') {
      this.setGameTitle('drift-king', 'drift-touge');
    } else {
      this.highwayWorld.group.visible = false;
      this.circuit.group.visible = true;
      if (layoutId && layoutId !== this.currentLayoutId) {
        this.setTrackLayout(layoutId);
      } else {
        this.spawnCars('circuit', this.settings.difficulty);
      }
    }
    this.callbacks.onPhaseChange('menu');
  }

  public canWatchReplay(): boolean {
    if (this.activeGameTitle !== 'street-racer') return false;
    return this.activeReplay !== null || this.replayRecorder.getFrameCount() >= 2;
  }

  public startReplay(returnPhase: 'finished' | 'paused' = 'finished'): boolean {
    const recording = this.activeReplay ?? this.replayRecorder.buildRecording();
    if (!recording) return false;
    this.activeReplay = recording;
    this.replayReturnPhase = returnPhase;
    this.phase = 'replay';
    this.replayPlaying = true;
    this.replayTimeMs = 0;
    this.replaySpeed = 1;
    this.replayOrbitAngle = 0.65;
    this.broadcastStationDist = -999;
    this.broadcastSampleHint = undefined;
    this.clearInputs();

    this.smokePool.forEach((p) => {
      p.life = 0;
      p.mesh.visible = false;
    });
    this.hideSpeedStreaks();

    const first = sampleReplayAtTime(recording, 0);
    if (first) {
      this.applyReplaySample(first, 0.016, true);
    }
    this.callbacks.onPhaseChange('replay');
    if (first) {
      this.emitReplayStatus(first);
    }
    return true;
  }

  public setReplayPlaying(playing: boolean): void {
    if (this.phase !== 'replay' || !this.activeReplay) return;
    if (playing && this.replayTimeMs >= this.activeReplay.durationMs - 10) {
      this.replayTimeMs = 0;
    }
    this.replayPlaying = playing;
    if (!playing) {
      this.hideSpeedStreaks();
      this.audio.setDrivingState(false, 0, false, 0);
    }
    const sampled = sampleReplayAtTime(this.activeReplay, this.replayTimeMs);
    if (sampled) this.emitReplayStatus(sampled);
  }

  public seekReplay(timeMs: number): void {
    if (this.phase !== 'replay' || !this.activeReplay) return;
    this.replayTimeMs = Math.max(0, Math.min(this.activeReplay.durationMs, timeMs));
    this.broadcastStationDist = -999;
    const sampled = sampleReplayAtTime(this.activeReplay, this.replayTimeMs);
    if (sampled) {
      this.applyReplaySample(sampled, 0.016, true);
      this.emitReplayStatus(sampled);
    }
  }

  public setReplaySpeed(speed: number): void {
    this.replaySpeed = speed;
    if (this.phase === 'replay' && this.activeReplay) {
      const sampled = sampleReplayAtTime(this.activeReplay, this.replayTimeMs);
      if (sampled) this.emitReplayStatus(sampled);
    }
  }

  public setReplayCameraMode(mode: ReplayCameraMode): void {
    this.replayCameraMode = mode;
    this.broadcastStationDist = -999;
    if (mode !== 'chase') {
      this.hideSpeedStreaks();
    }
    if (this.phase === 'replay' && this.activeReplay) {
      const sampled = sampleReplayAtTime(this.activeReplay, this.replayTimeMs);
      if (sampled) {
        this.applyReplaySample(sampled, 0.016, true);
        this.emitReplayStatus(sampled);
      }
    }
  }

  public exitReplay(): void {
    if (this.phase !== 'replay') return;
    this.hideSpeedStreaks();
    this.audio.setDrivingState(false, 0, false, 0);
    this.phase = this.replayReturnPhase;
    this.callbacks.onPhaseChange(this.phase);
  }

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  private update(dt: number): void {
    if (this.phase === 'menu') {
      this.attractAngle += dt * 0.22;

      if (this.activeGameTitle === 'highway-rush') {
        const aiIn = this.highwayWorld.computeAttractInput();
        this.highwayWorld.step(aiIn, dt, false);
        this.syncHighwayProxy();
        const hero = this.actors[0];
        if (hero) {
          this.syncCarTransform(this.highwayPlayerProxy, hero.mesh);
          this.desiredCamPos.set(
            this.highwayPlayerProxy.x + Math.sin(this.attractAngle * 0.65) * 4.2,
            3.3,
            this.highwayPlayerProxy.z - 9.2,
          );
          this.desiredCamTarget.set(
            this.highwayPlayerProxy.x,
            1.15,
            this.highwayPlayerProxy.z + 10,
          );
          this.camPos.lerp(this.desiredCamPos, Math.min(1, dt * 4));
          this.camTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 6));
          this.camera.position.copy(this.camPos);
          this.camera.lookAt(this.camTarget);
          this.updateSunShadowFocus(this.highwayPlayerProxy.x, 0, this.highwayPlayerProxy.z);
        }
        return;
      }

      // Attract mode: AI gently cruises around the circuit while camera orbits hero car
      this.actors.forEach((actor) => {
        const aiIn = computeAiInput(actor.state, this.circuit, 'normal');
        stepVehiclePhysics(actor.state, aiIn, this.circuit, dt, 0, TOTAL_RACE_LAPS, false);
        this.syncCarTransform(actor.state, actor.mesh);
      });
      resolveVehicleCollisions(this.actors.map((a) => a.state));

      const focus = this.actors.find((a) => a.state.isPlayer) ?? this.actors[0];
      if (focus) {
        const orbitDist = 11.5;
        this.desiredCamPos.set(
          focus.state.x + Math.sin(this.attractAngle) * orbitDist,
          focus.state.y + 3.6,
          focus.state.z + Math.cos(this.attractAngle) * orbitDist,
        );
        this.desiredCamTarget.set(focus.state.x, focus.state.y + 0.9, focus.state.z);
        this.camPos.lerp(this.desiredCamPos, Math.min(1, dt * 4));
        this.camTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 6));
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.camTarget);
        this.updateSunShadowFocus(focus.state.x, focus.state.y, focus.state.z);
      }
      return;
    }

    if (this.phase === 'paused') {
      return;
    }

    if (this.phase === 'replay') {
      this.updateReplay(dt);
      return;
    }

    if (this.phase === 'countdown') {
      this.countdownRemaining -= dt;
      const currentInt = Math.ceil(this.countdownRemaining);
      if (currentInt < this.lastCountdownInt && currentInt >= 1 && currentInt <= 3) {
        this.lastCountdownInt = currentInt;
        this.audio.playCountdownTone(false);
      }
      if (this.countdownRemaining <= 0) {
        this.countdownRemaining = 0;
        this.phase = 'racing';
        this.audio.playCountdownTone(true);
        this.bannerText =
          this.activeGameTitle === 'highway-rush'
            ? 'DODGE TRAFFIC · NEAR MISS FOR COMBOS!'
            : this.activeGameTitle === 'drift-king'
              ? 'DRIFT THROUGH ORANGE GATES!'
              : 'GO!';
        this.bannerTimer = this.activeGameTitle === 'street-racer' ? 1.2 : 2.1;
        this.callbacks.onPhaseChange('racing');
      }
      this.emitHud();
      const player = this.actors.find((a) => a.state.isPlayer);
      if (player) {
        this.updateChaseCamera(player.state, dt);
        this.audio.setDrivingState(true, this.input.accelerate ? 0.55 : 0.14, this.input.accelerate, 0);
      }
      return;
    }

    // Highway Rush Active / Finished Loop
    if (this.activeGameTitle === 'highway-rush') {
      this.updateHighwayRushFrame(dt);
      return;
    }

    // Street Racer & Drift King Circuit Loop
    if (this.phase === 'racing') {
      this.raceElapsedMs += dt * 1000;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }

    const isDriftMode = this.activeGameTitle === 'drift-king';
    const isLapMode =
      isDriftMode ||
      this.mode === 'circuit' ||
      this.mode === 'time-trial' ||
      this.mode === 'daily-challenge';
    const targetLaps = isDriftMode ? 999 : TOTAL_RACE_LAPS;

    let playerStepResult: {
      wallImpact: number;
      skidIntensity: number;
      completedLap: boolean;
      completedRace: boolean;
      wrongWay: boolean;
      crossedCheckpointIndex: number | null;
      lastLapDurationMs: number | null;
    } = {
      wallImpact: 0,
      skidIntensity: 0,
      completedLap: false,
      completedRace: false,
      wrongWay: false,
      crossedCheckpointIndex: null,
      lastLapDurationMs: null,
    };

    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i];
      const useAi = !actor.state.isPlayer || this.phase === 'finished';
      const ctrl = useAi
        ? computeAiInput(actor.state, this.circuit, this.difficulty)
        : this.input;

      const res = stepVehiclePhysics(
        actor.state,
        ctrl,
        this.circuit,
        dt,
        this.raceElapsedMs,
        targetLaps,
        isLapMode,
      );

      this.syncCarTransform(actor.state, actor.mesh);

      if (actor.state.isPlayer && this.phase === 'racing') {
        playerStepResult = res;
        if (actor.state.drifting && Math.abs(actor.state.speed) > 10) {
          this.spawnTireSmoke(actor.state);
          this.spawnSkidMark(actor.state);
        }
      }
    }

    const carImpact = resolveVehicleCollisions(this.actors.map((a) => a.state));
    const totalImpact = Math.max(playerStepResult.wallImpact, carImpact);
    if (totalImpact > 0.12 && this.phase === 'racing') {
      this.audio.playCollision(totalImpact);
      const p = this.actors.find((a) => a.state.isPlayer);
      if (p) {
        this.spawnCollisionSparks(p.state, totalImpact);
      }
    }

    this.updateSmokeParticles(dt);
    this.updateSparkParticles(dt);

    const player = this.actors.find((a) => a.state.isPlayer);
    if (player) {
      this.updateChaseCamera(player.state, dt);
      this.updateSpeedStreaks(this.phase === 'racing' ? player.state.speed : 0, dt);
      this.updateSunShadowFocus(player.state.x, player.state.y, player.state.z);

      const speedKmh = Math.abs(player.state.speed) * 3.6;
      const gearInfo = this.computeGearAndRpm(player.state.speed);
      this.audio.setDrivingState(
        this.phase === 'racing',
        gearInfo.rpmRatio,
        this.input.accelerate,
        playerStepResult.skidIntensity,
      );

      if (isDriftMode && this.phase === 'racing') {
        const driftOut = this.driftSession.step(
          player.state,
          totalImpact,
          playerStepResult.crossedCheckpointIndex,
          dt,
        );
        this.lastDriftResult = driftOut;
        if (driftOut.bannerText) {
          this.bannerText = driftOut.bannerText;
          this.bannerTimer = 1.65;
        }
        if (driftOut.playChime) {
          this.audio.playLapChime(false);
        }
        if (driftOut.finished) {
          this.finishDriftKing(driftOut);
        }
      } else {
        if (this.phase === 'racing') {
          const sorted = [...this.actors]
            .map((a) => a.state)
            .sort((a, b) => b.totalProgress - a.totalProgress);
          const pos = sorted.findIndex((s) => s.isPlayer) + 1;
          this.replayRecorder.recordFrame(
            this.raceElapsedMs,
            this.input,
            this.actors.map((a) => a.state),
            player.state.lap,
            pos,
          );
        }

        if (this.mode === 'daily-challenge' && this.phase === 'racing') {
          this.evaluateDailyProgress(
            player.state,
            playerStepResult.crossedCheckpointIndex,
            playerStepResult.lastLapDurationMs,
            false,
          );
        }

        if (playerStepResult.completedLap && !playerStepResult.completedRace) {
          this.audio.playLapChime(false);
          if (!this.bannerText || this.bannerTimer <= 0.2) {
            this.bannerText =
              player.state.lap === TOTAL_RACE_LAPS ? 'FINAL LAP' : `LAP ${player.state.lap}`;
            this.bannerTimer = 2.0;
          }
        }

        if (playerStepResult.completedRace && this.phase === 'racing') {
          this.finishRace(player.state);
        }
      }

      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.032) {
        this.hudEmitAccum = 0;
        this.emitHud(speedKmh, gearInfo, playerStepResult.wrongWay);
      }
    }
  }

  private updateHighwayRushFrame(dt: number): void {
    if (this.phase === 'racing') {
      this.raceElapsedMs += dt * 1000;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }

    if (this.phase === 'racing') {
      const hRes = this.highwayWorld.step(this.input, dt, true);
      this.lastHighwayResult = hRes;
      this.syncHighwayProxy();

      const hero = this.actors[0];
      if (hero) {
        this.syncCarTransform(this.highwayPlayerProxy, hero.mesh);
        if (this.highwayPlayerProxy.drifting && Math.abs(this.highwayPlayerProxy.speed) > 10) {
          this.spawnTireSmoke(this.highwayPlayerProxy);
          this.spawnSkidMark(this.highwayPlayerProxy);
        }
      }

      if (hRes.wallImpact > 0.14) {
        this.audio.playCollision(hRes.wallImpact);
        this.spawnCollisionSparks(this.highwayPlayerProxy, hRes.wallImpact);
      }

      if (hRes.eventBanner) {
        this.bannerText = hRes.eventBanner;
        this.bannerTimer = 1.45;
        this.audio.playLapChime(false);
      }

      if (hRes.crashed) {
        this.finishHighwayRush(hRes);
      }
    }

    this.updateSmokeParticles(dt);
    this.updateSparkParticles(dt);
    this.updateChaseCamera(this.highwayPlayerProxy, dt);
    this.updateSpeedStreaks(this.phase === 'racing' ? this.highwayPlayerProxy.speed : 0, dt);
    this.updateSunShadowFocus(this.highwayPlayerProxy.x, 0, this.highwayPlayerProxy.z);

    const speedKmh = Math.abs(this.highwayPlayerProxy.speed) * 3.6;
    const gearInfo = this.computeGearAndRpm(this.highwayPlayerProxy.speed);
    this.audio.setDrivingState(
      this.phase === 'racing',
      gearInfo.rpmRatio,
      this.input.accelerate,
      this.lastHighwayResult?.skidIntensity ?? 0,
    );

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.032) {
      this.hudEmitAccum = 0;
      this.emitHud(speedKmh, gearInfo, false);
    }
  }

  private finishHighwayRush(res: HighwayStepResult): void {
    this.phase = 'finished';
    this.clearInputs();
    this.hideSpeedStreaks();
    this.audio.setDrivingState(false, 0, false, 0);

    const saved = recordHighwayRushRun(res.score, res.distanceKm);
    const result: RaceResult = {
      gameTitle: 'highway-rush',
      mode: 'time-trial',
      difficulty: this.difficulty,
      totalTimeMs: this.raceElapsedMs,
      lapTimesMs: [],
      bestLapMs: null,
      previousBestRaceMs: null,
      previousBestLapMs: null,
      isNewBestRace: false,
      isNewBestLap: false,
      position: 1,
      totalRacers: 1,
      standings: [],
      hasReplay: false,
      score: res.score,
      previousBestScore: saved.previousBestScore,
      isNewBestScore: saved.isNewBestScore,
      distanceKm: Number(res.distanceKm.toFixed(2)),
      nearMissCount: res.nearMissCount,
      maxCombo: res.maxCombo,
    };

    this.callbacks.onPhaseChange('finished');
    this.callbacks.onRaceFinished(result);
  }

  private finishDriftKing(driftOut: DriftStepOutput): void {
    this.phase = 'finished';
    this.clearInputs();
    this.hideSpeedStreaks();
    this.audio.playLapChime(true);
    this.audio.setDrivingState(false, 0, false, 0);

    const saved = recordDriftKingRun(driftOut.totalScore, driftOut.maxMultiplier);
    const result: RaceResult = {
      gameTitle: 'drift-king',
      mode: 'time-trial',
      difficulty: this.difficulty,
      totalTimeMs: this.raceElapsedMs,
      lapTimesMs: [],
      bestLapMs: null,
      previousBestRaceMs: null,
      previousBestLapMs: null,
      isNewBestRace: false,
      isNewBestLap: false,
      position: 1,
      totalRacers: 1,
      standings: [],
      hasReplay: false,
      score: driftOut.totalScore,
      previousBestScore: saved.previousBestScore,
      isNewBestScore: saved.isNewBestScore,
      maxCombo: driftOut.maxMultiplier,
      bestSingleDrift: driftOut.bestSingleDrift,
      driftZonesHit: driftOut.zonesHit,
      driftGrade: this.driftSession.getGrade(),
    };

    this.callbacks.onPhaseChange('finished');
    this.callbacks.onRaceFinished(result);
  }

  private evaluateDailyProgress(
    player: VehicleState,
    crossedCheckpointIndex: number | null,
    lastLapDurationMs: number | null,
    isFinish: boolean,
  ): DailyChallengeResultSummary | undefined {
    if (this.mode !== 'daily-challenge' || this.dailyTasks.length === 0) return undefined;

    const clearedNow: string[] = [];
    const totalTimeMs = player.finishTimeMs ?? this.raceElapsedMs;

    this.dailyTasks.forEach((task) => {
      let satisfied = false;
      if (task.kind === 'fast-lap' || task.kind === 'ace-lap') {
        if (lastLapDurationMs !== null && lastLapDurationMs <= task.targetMs) {
          satisfied = true;
        }
        if (player.bestLapMs !== null && player.bestLapMs <= task.targetMs) {
          satisfied = true;
        }
      } else if (task.kind === 'sector-split') {
        if (crossedCheckpointIndex === 3) {
          const sectorElapsed = this.raceElapsedMs - player.lapStartTimeMs;
          if (sectorElapsed > 1000 && sectorElapsed <= task.targetMs) {
            satisfied = true;
          }
        }
      } else if (task.kind === 'double-sub-lap') {
        const fastCount = player.lapTimesMs.filter((t) => t <= task.targetMs).length;
        if (fastCount >= 2) {
          satisfied = true;
        }
      } else if (task.kind === 'total-run' && isFinish) {
        if (totalTimeMs > 0 && totalTimeMs <= task.targetMs) {
          satisfied = true;
        }
      }

      if (satisfied) {
        if (!task.completed) {
          task.completed = true;
          this.dailySessionNewlyCleared.add(task.id);
          this.bannerText = `DAILY TASK CLEARED · ${task.title.toUpperCase()}`;
          this.bannerTimer = 2.6;
          this.audio.playLapChime(false);
        }
        clearedNow.push(task.id);
      }
    });

    const shouldPersist =
      clearedNow.length > 0 || lastLapDurationMs !== null || isFinish;

    if (shouldPersist) {
      const updated = recordDailyProgress({
        dateKey: this.dailyDateKey,
        completedTaskIds: clearedNow,
        bestLapMs: player.bestLapMs,
        totalRunMs: isFinish ? totalTimeMs : null,
      });
      // Sync completion state
      const completedMap = new Map(updated.snapshot.tasks.map((t) => [t.id, t.completed]));
      this.dailyTasks = this.dailyTasks.map((t) => ({
        ...t,
        completed: completedMap.get(t.id) ?? t.completed,
      }));

      if (isFinish) {
        return {
          dateKey: updated.snapshot.dateKey,
          layoutName: updated.snapshot.layoutName,
          tasks: updated.snapshot.tasks,
          newlyCompletedIds: Array.from(this.dailySessionNewlyCleared),
          streakDays: updated.snapshot.streakDays,
        };
      }
    }

    return undefined;
  }

  private finishRace(player: VehicleState): void {
    this.phase = 'finished';
    this.clearInputs();
    this.hideSpeedStreaks();
    this.audio.playLapChime(true);
    this.audio.setDrivingState(false, 0, false, 0);

    const sorted = [...this.actors]
      .map((a) => a.state)
      .sort((a, b) => b.totalProgress - a.totalProgress);

    const playerPosition = sorted.findIndex((s) => s.isPlayer) + 1;
    this.replayRecorder.recordFrame(
      this.raceElapsedMs,
      this.input,
      this.actors.map((a) => a.state),
      player.lap,
      playerPosition,
      true,
    );
    this.activeReplay = this.replayRecorder.buildRecording();

    const standings: RaceStanding[] = sorted.map((s, idx) => ({
      id: s.id,
      name: s.name,
      isPlayer: s.isPlayer,
      position: idx + 1,
      finishTimeMs: s.finishTimeMs,
      bestLapMs: s.bestLapMs,
      color: s.color,
    }));

    const totalTimeMs = player.finishTimeMs ?? this.raceElapsedMs;
    const saved = recordRaceCompletion(this.mode, this.difficulty, totalTimeMs, player.bestLapMs);
    const dailySummary =
      this.mode === 'daily-challenge'
        ? this.evaluateDailyProgress(player, null, null, true)
        : undefined;

    const result: RaceResult = {
      gameTitle: 'street-racer',
      mode: this.mode,
      difficulty: this.difficulty,
      totalTimeMs,
      lapTimesMs: [...player.lapTimesMs],
      bestLapMs: player.bestLapMs,
      previousBestRaceMs: saved.previousBestRaceMs,
      previousBestLapMs: saved.previousBestLapMs,
      isNewBestRace: saved.isNewBestRace,
      isNewBestLap: saved.isNewBestLap,
      position: playerPosition,
      totalRacers: sorted.length,
      standings,
      hasReplay: this.activeReplay !== null,
      dailySummary,
    };

    this.callbacks.onPhaseChange('finished');
    this.callbacks.onRaceFinished(result);
  }

  private computeGearAndRpm(speedMs: number): { gear: string; rpmRatio: number } {
    if (speedMs < -0.8) {
      return { gear: 'R', rpmRatio: Math.min(1, Math.abs(speedMs) / 20) };
    }
    const kmh = Math.abs(speedMs) * 3.6;
    if (kmh < 2) {
      return { gear: 'N', rpmRatio: 0.14 };
    }
    const thresholds = [0, 46, 86, 128, 170, 212, 260];
    let gearIdx = 1;
    for (let i = 1; i < thresholds.length; i++) {
      if (kmh >= thresholds[i - 1]) gearIdx = i;
    }
    const low = thresholds[gearIdx - 1];
    const high = thresholds[gearIdx];
    const ratio = 0.28 + 0.72 * Math.max(0, Math.min(1, (kmh - low) / (high - low)));
    return { gear: String(gearIdx), rpmRatio: ratio };
  }

  private syncCarTransform(v: VehicleState, mesh: SportsCarMeshHandles): void {
    mesh.root.position.set(v.x, v.y, v.z);
    mesh.root.rotation.set(0, v.heading, 0);
    mesh.roadAligned.rotation.set(v.roadPitch, 0, 0);
    mesh.chassis.rotation.set(v.chassisPitch, 0, v.chassisRoll);

    mesh.frontLeftSteer.rotation.y = v.steerVisual;
    mesh.frontRightSteer.rotation.y = v.steerVisual;
    mesh.wheelSpins.forEach((w) => {
      w.rotation.x = v.wheelSpinAngle;
    });

    mesh.brakeLightMat.emissiveIntensity = v.braking ? 3.5 : 0.9;
    mesh.brakeHaloMat.opacity = v.braking ? 0.78 : 0.22;

    // Subtle exhaust pulse flare during active high-speed acceleration
    const fxActive =
      this.phase === 'racing' ||
      this.phase === 'finished' ||
      (this.phase === 'replay' && this.replayPlaying);
    const showFlame = fxActive && v.speed > 18 && !v.braking && Math.random() < 0.28;
    mesh.exhaustFlameMat.opacity = showFlame ? 0.65 : 0;
    mesh.exhaustFlames.forEach((f) => {
      f.visible = showFlame;
      if (showFlame) {
        f.scale.z = 0.7 + Math.random() * 0.65;
      }
    });
  }

  private updateChaseCamera(player: VehicleState, dt: number): void {
    const aspect = this.camera.aspect || 1;
    const isPortrait = aspect < 1;

    const preset = this.settings.cameraPreset;
    const baseDist = preset === 'close' ? 6.8 : preset === 'far' ? 10.8 : 8.6;
    const baseHeight = preset === 'close' ? 2.65 : preset === 'far' ? 4.35 : 3.35;

    // Pull camera back slightly on portrait mobile so upcoming corners stay legible
    const portraitMultiplier = isPortrait ? 1.24 : 1.0;
    const speedRatio = Math.min(1, Math.abs(player.speed) / 68);
    const camDist = (baseDist + speedRatio * 1.45) * portraitMultiplier;
    const camHeight = baseHeight + speedRatio * 0.35;

    const fwdX = Math.sin(player.heading);
    const fwdZ = Math.cos(player.heading);

    this.desiredCamPos.set(
      player.x - fwdX * camDist,
      player.y + camHeight,
      player.z - fwdZ * camDist,
    );
    this.desiredCamTarget.set(
      player.x + fwdX * 7.5,
      player.y + 1.25,
      player.z + fwdZ * 7.5,
    );

    // Smooth exponential damping (never snaps or jumps)
    const posLambda = 9.5;
    const targetLambda = 13.0;
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, this.desiredCamPos.x, posLambda, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, this.desiredCamPos.y, posLambda * 0.85, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, this.desiredCamPos.z, posLambda, dt);

    this.camTarget.x = THREE.MathUtils.damp(this.camTarget.x, this.desiredCamTarget.x, targetLambda, dt);
    this.camTarget.y = THREE.MathUtils.damp(this.camTarget.y, this.desiredCamTarget.y, targetLambda, dt);
    this.camTarget.z = THREE.MathUtils.damp(this.camTarget.z, this.desiredCamTarget.z, targetLambda, dt);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // Speed-sensitive FOV widening
    const targetFov = (isPortrait ? 66 : 58) + speedRatio * 15;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateSunShadowFocus(x: number, y: number, z: number): void {
    if (!this.dirLight || !this.dirLight.castShadow) return;
    this.dirLight.position.set(x + 48, y + 75, z + 38);
    this.dirLight.target.position.set(x, y, z);
    this.dirLight.target.updateMatrixWorld();
  }

  private spawnTireSmoke(v: VehicleState): void {
    const fwdX = Math.sin(v.heading);
    const fwdZ = Math.cos(v.heading);
    const rightX = -Math.cos(v.heading);
    const rightZ = Math.sin(v.heading);

    [-0.92, 0.92].forEach((side) => {
      const p = this.smokePool[this.smokeCursor];
      this.smokeCursor = (this.smokeCursor + 1) % this.smokePool.length;
      p.life = p.maxLife;
      p.mesh.visible = true;
      p.mesh.position.set(
        v.x - fwdX * 1.42 + rightX * side,
        v.y + 0.34,
        v.z - fwdZ * 1.42 + rightZ * side,
      );
      p.mesh.scale.setScalar(0.6);
      p.mat.opacity = 0.45;
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = 0.75 + Math.random() * 0.85;
      p.vz = (Math.random() - 0.5) * 1.5;
    });
  }

  private spawnSkidMark(v: VehicleState): void {
    const fwdX = Math.sin(v.heading);
    const fwdZ = Math.cos(v.heading);
    const rightX = -Math.cos(v.heading);
    const rightZ = Math.sin(v.heading);

    [-0.95, 0.95].forEach((side) => {
      const k = this.skidPool[this.skidCursor];
      this.skidCursor = (this.skidCursor + 1) % this.skidPool.length;
      k.mesh.visible = true;
      k.mesh.position.set(
        v.x - fwdX * 1.38 + rightX * side,
        v.y + 0.045,
        v.z - fwdZ * 1.38 + rightZ * side,
      );
      k.mesh.rotation.order = 'YXZ';
      k.mesh.rotation.set(v.roadPitch, v.heading, 0);
    });
  }

  private spawnCollisionSparks(v: VehicleState, intensity: number): void {
    const count = Math.min(12, Math.max(5, Math.round(intensity * 12)));
    for (let i = 0; i < count; i++) {
      const s = this.sparkPool[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparkPool.length;
      s.life = 0.22 + Math.random() * 0.18;
      s.maxLife = s.life;
      s.mesh.visible = true;
      s.mesh.position.set(
        v.x + (Math.random() - 0.5) * 1.6,
        v.y + 0.45 + Math.random() * 0.3,
        v.z + (Math.random() - 0.5) * 2.2,
      );
      s.vx = (Math.random() - 0.5) * 14;
      s.vy = 3.0 + Math.random() * 6.5;
      s.vz = (Math.random() - 0.5) * 14;
      s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    }
  }

  private updateSmokeParticles(dt: number): void {
    for (let i = 0; i < this.smokePool.length; i++) {
      const p = this.smokePool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mat.opacity = 0;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.quaternion.copy(this.camera.quaternion);
      const age = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(0.6 + age * 2.3);
      p.mat.opacity = 0.45 * (1 - age);
    }
  }

  private updateSparkParticles(dt: number): void {
    for (let i = 0; i < this.sparkPool.length; i++) {
      const s = this.sparkPool[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      s.vy -= 18 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
    }
  }

  private updateSpeedStreaks(speedMs: number, dt: number): void {
    const kmh = Math.abs(speedMs) * 3.6;
    const targetOpacity = kmh > 125 ? Math.min(0.45, ((kmh - 125) / 120) * 0.45) : 0;
    this.streakMat.opacity += (targetOpacity - this.streakMat.opacity) * Math.min(1, dt * 8);

    if (this.streakMat.opacity < 0.01) {
      this.speedStreaksGroup.visible = false;
      return;
    }

    this.speedStreaksGroup.visible = true;
    const speedFactor = 0.8 + Math.min(1.8, kmh / 140);
    for (let i = 0; i < this.speedStreaks.length; i++) {
      const st = this.speedStreaks[i];
      st.z += st.speed * speedFactor * dt;
      if (st.z > 0.5) {
        st.z = -18 - Math.random() * 6;
      }
      st.mesh.position.set(st.x, st.y, st.z);
    }
  }

  private emitHud(
    speedKmh = 0,
    gearInfo = { gear: 'N', rpmRatio: 0.14 },
    wrongWay = false,
  ): void {
    const player = this.actors.find((a) => a.state.isPlayer);
    if (!player) return;

    if (this.activeGameTitle === 'highway-rush') {
      const hr = this.lastHighwayResult;
      this.callbacks.onTelemetry({
        gameTitle: 'highway-rush',
        speedKmh: Math.round(speedKmh),
        rpmRatio: gearInfo.rpmRatio,
        gear: gearInfo.gear,
        lap: 1,
        totalLaps: 0,
        checkpointIndex: 0,
        totalCheckpoints: 0,
        raceTimeMs: this.raceElapsedMs,
        currentLapTimeMs: this.raceElapsedMs,
        bestLapTimeMs: null,
        position: 1,
        totalRacers: 1,
        countdownValue: Math.max(0, Math.ceil(this.countdownRemaining)),
        wrongWay: false,
        drifting: this.highwayPlayerProxy.drifting,
        bannerText: this.bannerText,
        markers: [],
        score: hr?.score ?? 0,
        comboMultiplier: hr?.comboMultiplier ?? 1,
        comboTimerRatio: hr?.comboTimerRatio ?? 0,
        nearMissCount: hr?.nearMissCount ?? 0,
        distanceKm: hr?.distanceKm ?? 0,
      });
      return;
    }

    const sorted = [...this.actors]
      .map((a) => a.state)
      .sort((a, b) => b.totalProgress - a.totalProgress);
    const position = sorted.findIndex((s) => s.isPlayer) + 1;
    const dr = this.activeGameTitle === 'drift-king' ? this.lastDriftResult : null;

    this.callbacks.onTelemetry({
      gameTitle: this.activeGameTitle,
      speedKmh: Math.round(speedKmh),
      rpmRatio: gearInfo.rpmRatio,
      gear: gearInfo.gear,
      lap: player.state.lap,
      totalLaps:
        this.activeGameTitle === 'drift-king' || this.mode === 'free-drive'
          ? 0
          : TOTAL_RACE_LAPS,
      checkpointIndex: player.state.nextCheckpointIndex,
      totalCheckpoints: this.circuit.checkpointDistances.length,
      raceTimeMs: this.raceElapsedMs,
      currentLapTimeMs: Math.max(0, this.raceElapsedMs - player.state.lapStartTimeMs),
      bestLapTimeMs: player.state.bestLapMs,
      position,
      totalRacers: this.actors.length,
      countdownValue: Math.max(0, Math.ceil(this.countdownRemaining)),
      wrongWay,
      drifting: player.state.drifting,
      bannerText: this.bannerText,
      markers: this.actors.map((a) => ({
        id: a.state.id,
        x: a.state.x,
        z: a.state.z,
        heading: a.state.heading,
        isPlayer: a.state.isPlayer,
        color: a.state.color,
      })),
      dailyTasks:
        this.activeGameTitle === 'street-racer' && this.mode === 'daily-challenge'
          ? this.dailyTasks.map((t) => ({ ...t }))
          : undefined,
      dailyLayoutName:
        this.activeGameTitle === 'street-racer' && this.mode === 'daily-challenge'
          ? this.circuit.layoutName
          : undefined,
      score: dr?.totalScore,
      pendingScore: dr?.pendingScore,
      comboMultiplier: dr?.multiplier,
      comboTimerRatio: dr?.comboTimerRatio,
      timeRemainingMs: dr?.timeRemainingMs,
      driftZonesHit: dr?.zonesHit,
    });
  }

  private updateReplay(dt: number): void {
    if (!this.activeReplay) return;

    if (this.replayPlaying) {
      this.replayTimeMs += dt * 1000 * this.replaySpeed;
      if (this.replayTimeMs >= this.activeReplay.durationMs) {
        this.replayTimeMs = this.activeReplay.durationMs;
        this.replayPlaying = false;
        this.audio.setDrivingState(false, 0, false, 0);
      }
    }

    const sampled = sampleReplayAtTime(this.activeReplay, this.replayTimeMs);
    if (!sampled) return;

    this.applyReplaySample(sampled, dt, false);
    this.updateSmokeParticles(dt);
    this.updateSparkParticles(dt);

    const playerSnap = sampled.vehicles.find((v) => v.id === 'player') ?? sampled.vehicles[0];
    if (playerSnap) {
      this.updateSpeedStreaks(
        this.replayPlaying && this.replayCameraMode === 'chase' ? playerSnap.speed : 0,
        dt,
      );
      const gearInfo = this.computeGearAndRpm(playerSnap.speed);
      const skid = playerSnap.drifting && this.replayPlaying ? 0.65 : 0;
      this.audio.setDrivingState(
        this.replayPlaying,
        gearInfo.rpmRatio,
        sampled.playerInput.accelerate,
        skid,
      );
      this.updateSunShadowFocus(playerSnap.x, playerSnap.y, playerSnap.z);
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.032 || !this.replayPlaying) {
      this.hudEmitAccum = 0;
      this.emitReplayStatus(sampled);
    }
  }

  private applyReplaySample(
    sampled: NonNullable<ReturnType<typeof sampleReplayAtTime>>,
    dt: number,
    snapCamera: boolean,
  ): void {
    let playerSnap: ReplayVehicleSnapshot | null = null;

    sampled.vehicles.forEach((snap) => {
      const actor = this.actors.find((a) => a.state.id === snap.id);
      if (!actor) return;

      actor.state.x = snap.x;
      actor.state.y = snap.y;
      actor.state.z = snap.z;
      actor.state.heading = snap.heading;
      actor.state.speed = snap.speed;
      actor.state.steerVisual = snap.steerVisual;
      actor.state.wheelSpinAngle = snap.wheelSpinAngle;
      actor.state.chassisPitch = snap.chassisPitch;
      actor.state.chassisRoll = snap.chassisRoll;
      actor.state.roadPitch = snap.roadPitch;
      actor.state.braking = snap.braking;
      actor.state.drifting = snap.drifting;

      this.syncCarTransform(actor.state, actor.mesh);

      if (snap.id === 'player') {
        playerSnap = snap;
      }

      if (this.replayPlaying && snap.drifting && Math.abs(snap.speed) > 10) {
        this.spawnTireSmoke(actor.state);
        this.spawnSkidMark(actor.state);
      }
    });

    if (!playerSnap) return;
    const p: ReplayVehicleSnapshot = playerSnap;

    if (this.replayCameraMode === 'chase') {
      const playerActor = this.actors.find((a) => a.state.id === 'player');
      if (playerActor) {
        if (snapCamera) {
          const fwdX = Math.sin(p.heading);
          const fwdZ = Math.cos(p.heading);
          this.camPos.set(p.x - fwdX * 8.8, p.y + 3.4, p.z - fwdZ * 8.8);
          this.camTarget.set(p.x + fwdX * 7.5, p.y + 1.25, p.z + fwdZ * 7.5);
          this.camera.position.copy(this.camPos);
          this.camera.lookAt(this.camTarget);
        } else {
          this.updateChaseCamera(playerActor.state, dt);
        }
      }
      return;
    }

    if (this.replayCameraMode === 'orbit') {
      if (this.replayPlaying) {
        this.replayOrbitAngle += dt * 0.45;
      }
      const dist = 9.5;
      this.desiredCamPos.set(
        p.x + Math.sin(p.heading + this.replayOrbitAngle) * dist,
        p.y + 3.2,
        p.z + Math.cos(p.heading + this.replayOrbitAngle) * dist,
      );
      this.desiredCamTarget.set(p.x, p.y + 1.0, p.z);
      if (snapCamera) {
        this.camPos.copy(this.desiredCamPos);
        this.camTarget.copy(this.desiredCamTarget);
      } else {
        this.camPos.lerp(this.desiredCamPos, Math.min(1, dt * 8));
        this.camTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 10));
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camTarget);
      if (Math.abs(this.camera.fov - 56) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 56, 6, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    // TV Broadcast Camera: elevated trackside stations panning dynamically with the player
    const proj = this.circuit.getClosestSample(p.x, p.y, p.z, this.broadcastSampleHint);
    this.broadcastSampleHint = proj.sample.index;
    const carDist = proj.sample.distance;

    const wrappedDelta =
      ((carDist - this.broadcastStationDist + this.circuit.totalLength * 1.5) %
        this.circuit.totalLength) -
      this.circuit.totalLength * 0.5;

    if (this.broadcastStationDist < 0 || Math.abs(wrappedDelta) > 62) {
      const stationSample = this.circuit.getSampleAtDistance(carDist + 42);
      const side = Math.floor(stationSample.distance / 80) % 2 === 0 ? 1 : -1;
      this.broadcastStationPos
        .copy(stationSample.position)
        .addScaledVector(stationSample.right, side * 13.5)
        .add(new THREE.Vector3(0, 6.2, 0));
      this.broadcastStationDist = stationSample.distance;
    }

    this.camera.position.copy(this.broadcastStationPos);
    this.desiredCamTarget.set(p.x, p.y + 0.9, p.z);
    if (snapCamera) {
      this.camTarget.copy(this.desiredCamTarget);
    } else {
      this.camTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 14));
    }
    this.camera.lookAt(this.camTarget);

    const distToCar = this.camera.position.distanceTo(this.camTarget);
    const zoomFov = Math.max(36, Math.min(62, 66 - distToCar * 0.36));
    if (Math.abs(this.camera.fov - zoomFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, zoomFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitReplayStatus(sampled: NonNullable<ReturnType<typeof sampleReplayAtTime>>): void {
    if (!this.activeReplay) return;
    const playerSnap = sampled.vehicles.find((v) => v.id === 'player') ?? sampled.vehicles[0];
    const speedKmh = playerSnap ? Math.round(Math.abs(playerSnap.speed) * 3.6) : 0;
    const gearInfo = playerSnap
      ? this.computeGearAndRpm(playerSnap.speed)
      : { gear: 'N', rpmRatio: 0.14 };

    this.callbacks.onReplayStatus({
      playing: this.replayPlaying,
      currentTimeMs: sampled.timeMs,
      durationMs: this.activeReplay.durationMs,
      playbackSpeed: this.replaySpeed,
      cameraMode: this.replayCameraMode,
      recordedInput: sampled.playerInput,
      speedKmh,
      gear: gearInfo.gear,
      rpmRatio: gearInfo.rpmRatio,
      lap: sampled.playerLap,
      totalLaps: this.activeReplay.totalLaps,
      position: sampled.playerPosition,
      totalRacers: this.actors.length,
      markers: sampled.vehicles.map((v) => {
        const actor = this.actors.find((a) => a.state.id === v.id);
        return {
          id: v.id,
          x: v.x,
          z: v.z,
          heading: v.heading,
          isPlayer: v.id === 'player',
          color: actor?.state.color ?? '#94A3B8',
        };
      }),
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      if (canvas.parentElement === this.container) {
        this.container.removeChild(canvas);
      }
      this.renderer.dispose();
    }

    this.clearActors();
    this.circuit?.dispose();
    this.highwayWorld?.dispose();
    this.textures?.dispose();
    this.smokeGeo?.dispose();
    this.smokePool.forEach((p) => p.mat.dispose());
    this.skidGeo?.dispose();
    this.skidMat?.dispose();
    this.sparkGeo?.dispose();
    this.sparkMat?.dispose();
    this.streakGeo?.dispose();
    this.streakMat?.dispose();
    this.envRenderTarget?.dispose();
  }
}
