import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import heroFallbackImg from './assets/images/nexora_circuit_hero_1794683666595.jpg';
import { GarageModal } from './components/GarageModal';
import { AboutModal, HowToPlayModal } from './components/InfoModals';
import { LandingOverlay } from './components/LandingOverlay';
import { PauseModal } from './components/PauseModal';
import { RaceHud } from './components/RaceHud';
import { ReplayOverlay } from './components/ReplayOverlay';
import { ResultsModal } from './components/ResultsModal';
import { SettingsModal } from './components/SettingsModal';
import { RaceAudioEngine } from './game/audio';
import { getDailyChallengeSnapshot, getTodayDateKey } from './game/dailyChallenge';
import { NexoraRaceEngine } from './game/engine';
import { loadPlayerProfile } from './game/progression';
import { loadRecords, loadSettings, saveSettings } from './game/storage';
import {
  BestRecords,
  CameraPreset,
  DailyChallengeSnapshot,
  Difficulty,
  GameMode,
  GamePhase,
  GameSettings,
  GameTitle,
  HudTelemetry,
  InputState,
  PlayerProfile,
  RaceResult,
  ReplayCameraMode,
  ReplayStatus,
} from './game/types';

const INITIAL_TELEMETRY: HudTelemetry = {
  gameTitle: 'street-racer',
  speedKmh: 0,
  rpmRatio: 0.14,
  gear: 'N',
  lap: 1,
  totalLaps: 3,
  checkpointIndex: 1,
  totalCheckpoints: 6,
  raceTimeMs: 0,
  currentLapTimeMs: 0,
  bestLapTimeMs: null,
  position: 1,
  totalRacers: 4,
  countdownValue: 3,
  wrongWay: false,
  drifting: false,
  bannerText: null,
  markers: [],
  nitroRatio: 1,
  nitroActive: false,
  slipstreamActive: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NexoraRaceEngine | null>(null);
  const audioRef = useRef<RaceAudioEngine | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [records, setRecords] = useState<BestRecords>(() => loadRecords());
  const [profile, setProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeSnapshot>(() =>
    getDailyChallengeSnapshot(),
  );
  const [selectedGame, setSelectedGame] = useState<GameTitle>('street-racer');
  const [selectedMode, setSelectedMode] = useState<GameMode>('circuit');
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [telemetry, setTelemetry] = useState<HudTelemetry>(INITIAL_TELEMETRY);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [replayStatus, setReplayStatus] = useState<ReplayStatus | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [minimapPath, setMinimapPath] = useState<{
    points: Array<{ x: number; z: number }>;
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  }>({ points: [], bounds: { minX: -150, maxX: 170, minZ: -140, maxZ: 155 } });

  const [activeModal, setActiveModal] = useState<
    'none' | 'garage' | 'settings' | 'howto' | 'about'
  >('none');
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Track touch capability for Auto touch controls
  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(coarse || hasTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const showTouchControls = useMemo(() => {
    if (settings.touchControls === 'on') return true;
    if (settings.touchControls === 'off') return false;
    return isTouchDevice;
  }, [settings.touchControls, isTouchDevice]);

  // Initialize Three.js Race Engine once inside isolated mountRef
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new RaceAudioEngine();
    audio.setSettings(settings.soundEnabled, settings.volume);
    audioRef.current = audio;

    const engine = new NexoraRaceEngine(container, settings, audio, {
      onPhaseChange: (nextPhase) => {
        setPhase(nextPhase);
      },
      onTelemetry: (nextTelemetry) => {
        setTelemetry(nextTelemetry);
      },
      onRaceFinished: (result) => {
        setRaceResult(result);
        setRecords(loadRecords());
        setProfile(loadPlayerProfile());
        setDailyChallenge(getDailyChallengeSnapshot());
      },
      onReplayStatus: (status) => {
        setReplayStatus(status);
      },
      onWebglError: (msg) => {
        setWebglError(msg);
      },
    });

    engineRef.current = engine;
    setMinimapPath(engine.getMinimapInfo());

    return () => {
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
    // Mount WebGL canvas strictly once; settings updates flow via updateSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push settings & profile updates cleanly to engine & persistence
  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.updateSettings(next);
  }, []);

  const handleUpdateProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    engineRef.current?.syncProfile(next);
  }, []);

  // Refresh Daily Challenge automatically across local midnight while on menu
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (phase !== 'menu') return;
      const currentKey = getTodayDateKey();
      if (currentKey !== dailyChallenge.dateKey) {
        const refreshed = getDailyChallengeSnapshot();
        setDailyChallenge(refreshed);
        if (selectedMode === 'daily-challenge' && engineRef.current) {
          engineRef.current.setTrackLayout(refreshed.layoutId);
          setMinimapPath(engineRef.current.getMinimapInfo());
        }
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [phase, dailyChallenge.dateKey, selectedMode]);

  // Start / Restart / Pause / Resume handlers
  const handleStartRace = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.focus();
    audioRef.current?.playUiClick();
    setRaceResult(null);
    setActiveModal('none');
    const latestDaily = getDailyChallengeSnapshot();
    setDailyChallenge(latestDaily);
    const targetLayout =
      selectedGame === 'drift-king'
        ? 'drift-touge'
        : selectedMode === 'daily-challenge'
          ? latestDaily.layoutId
          : 'metro-loop';
    engineRef.current?.startRace(selectedMode, settings.difficulty, targetLayout, selectedGame);
    if (engineRef.current) {
      setMinimapPath(engineRef.current.getMinimapInfo());
    }
  }, [selectedGame, selectedMode, settings.difficulty]);

  const handlePause = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    audioRef.current?.playUiClick();
    engineRef.current?.pauseRace();
  }, []);

  const handleResume = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.focus();
    audioRef.current?.playUiClick();
    setActiveModal('none');
    engineRef.current?.resumeRace();
  }, []);

  const handleReturnToMenu = useCallback(() => {
    audioRef.current?.playUiClick();
    setRaceResult(null);
    setActiveModal('none');
    setRecords(loadRecords());
    const latestDaily = getDailyChallengeSnapshot();
    setDailyChallenge(latestDaily);
    const previewLayout =
      selectedGame === 'drift-king'
        ? 'drift-touge'
        : selectedMode === 'daily-challenge'
          ? latestDaily.layoutId
          : 'metro-loop';
    engineRef.current?.returnToMenu(previewLayout, selectedGame);
    if (engineRef.current) {
      setMinimapPath(engineRef.current.getMinimapInfo());
    }
  }, [selectedGame, selectedMode]);

  const handleToggleSound = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const next = { ...settings, soundEnabled: !settings.soundEnabled };
    handleUpdateSettings(next);
  }, [settings, handleUpdateSettings]);

  const handleCycleCamera = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    audioRef.current?.playUiClick();
    const order: CameraPreset[] = ['chase', 'close', 'far'];
    const nextCam = order[(order.indexOf(settings.cameraPreset) + 1) % order.length];
    handleUpdateSettings({ ...settings, cameraPreset: nextCam });
  }, [settings, handleUpdateSettings]);

  const handleWatchReplay = useCallback((returnPhase: 'finished' | 'paused') => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    audioRef.current?.playUiClick();
    audioRef.current?.unlock();
    engineRef.current?.startReplay(returnPhase);
  }, []);

  const handleToggleReplayPlay = useCallback(() => {
    if (!replayStatus) return;
    audioRef.current?.playUiClick();
    engineRef.current?.setReplayPlaying(!replayStatus.playing);
  }, [replayStatus]);

  const handleSeekReplay = useCallback((timeMs: number) => {
    engineRef.current?.seekReplay(timeMs);
  }, []);

  const handleSetReplaySpeed = useCallback((speed: number) => {
    audioRef.current?.playUiClick();
    engineRef.current?.setReplaySpeed(speed);
  }, []);

  const handleSetReplayCamera = useCallback((cam: ReplayCameraMode) => {
    audioRef.current?.playUiClick();
    engineRef.current?.setReplayCameraMode(cam);
  }, []);

  const handleExitReplay = useCallback(() => {
    audioRef.current?.playUiClick();
    engineRef.current?.exitReplay();
  }, []);

  const handleTouchInput = useCallback((patch: Partial<InputState>) => {
    audioRef.current?.unlock();
    engineRef.current?.setInput(patch);
  }, []);

  // Keyboard Controls (WASD / Arrows / Space / Escape)
  useEffect(() => {
    const keyMap = new Set<string>();

    const syncKeys = () => {
      if (!engineRef.current) return;
      engineRef.current.setInput({
        accelerate: keyMap.has('KeyW') || keyMap.has('ArrowUp'),
        brake: keyMap.has('KeyS') || keyMap.has('ArrowDown'),
        steerLeft: keyMap.has('KeyA') || keyMap.has('ArrowLeft'),
        steerRight: keyMap.has('KeyD') || keyMap.has('ArrowRight'),
        handbrake: keyMap.has('Space'),
        nitro: keyMap.has('ShiftLeft') || keyMap.has('ShiftRight') || keyMap.has('KeyN'),
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (activeModal !== 'none') {
          setActiveModal('none');
          return;
        }
        if (phase === 'racing' || phase === 'countdown') {
          engineRef.current?.pauseRace();
        } else if (phase === 'paused') {
          engineRef.current?.resumeRace();
        } else if (phase === 'replay') {
          engineRef.current?.exitReplay();
        }
        return;
      }

      if (phase === 'replay' && e.code === 'Space') {
        e.preventDefault();
        if (replayStatus) {
          engineRef.current?.setReplayPlaying(!replayStatus.playing);
        }
        return;
      }

      if (phase === 'racing' || phase === 'countdown') {
        if (
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'Space'
        ) {
          e.preventDefault();
        }
        audioRef.current?.unlock();
        keyMap.add(e.code);
        syncKeys();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keyMap.delete(e.code);
      syncKeys();
    };

    const onBlur = () => {
      keyMap.clear();
      engineRef.current?.clearInputs();
    };

    const onVisibility = () => {
      if (document.hidden && (phase === 'racing' || phase === 'countdown')) {
        keyMap.clear();
        engineRef.current?.pauseRace();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, activeModal, replayStatus]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090B10]">
      {/* Dedicated WebGL 3D Canvas Container */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Main Landing Screen */}
      {phase === 'menu' && (
        <LandingOverlay
          selectedGame={selectedGame}
          selectedMode={selectedMode}
          settings={settings}
          records={records}
          profile={profile}
          dailyChallenge={dailyChallenge}
          webglError={webglError}
          fallbackImageSrc={heroFallbackImg}
          onSelectGame={(game: GameTitle) => {
            audioRef.current?.playUiClick();
            setSelectedGame(game);
            const targetLayout =
              game === 'drift-king'
                ? 'drift-touge'
                : selectedMode === 'daily-challenge'
                  ? dailyChallenge.layoutId
                  : 'metro-loop';
            if (engineRef.current) {
              engineRef.current.setGameTitle(game, targetLayout);
              setMinimapPath(engineRef.current.getMinimapInfo());
            }
          }}
          onSelectMode={(mode) => {
            audioRef.current?.playUiClick();
            setSelectedMode(mode);
            const targetLayout =
              mode === 'daily-challenge' ? dailyChallenge.layoutId : 'metro-loop';
            if (engineRef.current) {
              engineRef.current.setTrackLayout(targetLayout);
              setMinimapPath(engineRef.current.getMinimapInfo());
            }
          }}
          onSelectDifficulty={(diff: Difficulty) => {
            audioRef.current?.playUiClick();
            handleUpdateSettings({ ...settings, difficulty: diff });
          }}
          onSelectLivery={(liveryId: string) => {
            audioRef.current?.playUiClick();
            handleUpdateSettings({ ...settings, liveryId });
          }}
          onStartRace={handleStartRace}
          onOpenGarage={() => {
            audioRef.current?.playUiClick();
            setActiveModal('garage');
          }}
          onOpenHowToPlay={() => {
            audioRef.current?.playUiClick();
            setActiveModal('howto');
          }}
          onOpenSettings={() => {
            audioRef.current?.playUiClick();
            setActiveModal('settings');
          }}
          onOpenAbout={() => {
            audioRef.current?.playUiClick();
            setActiveModal('about');
          }}
        />
      )}

      {/* Active Gameplay HUD */}
      {phase !== 'menu' && phase !== 'replay' && (
        <RaceHud
          phase={phase}
          mode={selectedMode}
          telemetry={telemetry}
          minimapPath={minimapPath}
          showTouchControls={showTouchControls}
          soundEnabled={settings.soundEnabled}
          cameraPreset={settings.cameraPreset}
          onPause={handlePause}
          onToggleSound={handleToggleSound}
          onCycleCamera={handleCycleCamera}
          onTouchInput={handleTouchInput}
        />
      )}

      {/* Replay Playback Overlay */}
      {phase === 'replay' && replayStatus && (
        <ReplayOverlay
          mode={selectedMode}
          status={replayStatus}
          soundEnabled={settings.soundEnabled}
          onTogglePlay={handleToggleReplayPlay}
          onSeek={handleSeekReplay}
          onSetSpeed={handleSetReplaySpeed}
          onSetCameraMode={handleSetReplayCamera}
          onToggleSound={handleToggleSound}
          onExitReplay={handleExitReplay}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && activeModal === 'none' && (
        <PauseModal
          canWatchReplay={engineRef.current?.canWatchReplay() ?? false}
          onResume={handleResume}
          onWatchReplay={() => handleWatchReplay('paused')}
          onRestart={handleStartRace}
          onOpenSettings={() => {
            audioRef.current?.playUiClick();
            setActiveModal('settings');
          }}
          onMainMenu={handleReturnToMenu}
        />
      )}

      {/* Post-Race Results Modal */}
      {phase === 'finished' && raceResult && activeModal === 'none' && (
        <ResultsModal
          result={raceResult}
          onWatchReplay={() => handleWatchReplay('finished')}
          onOpenGarage={() => {
            audioRef.current?.playUiClick();
            setActiveModal('garage');
          }}
          onRestart={handleStartRace}
          onMainMenu={handleReturnToMenu}
        />
      )}

      {/* Garage & Tuning Modal */}
      {activeModal === 'garage' && (
        <GarageModal
          profile={profile}
          liveryId={settings.liveryId}
          onUpdateProfile={handleUpdateProfile}
          onSelectLivery={(liveryId) => handleUpdateSettings({ ...settings, liveryId })}
          onPlayClickSound={() => audioRef.current?.playUiClick()}
          onClose={() => {
            audioRef.current?.playUiClick();
            setActiveModal('none');
          }}
        />
      )}

      {/* Settings / Info Modals */}
      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          unlockedLiveries={profile.unlockedLiveries}
          onUpdate={handleUpdateSettings}
          onClose={() => {
            audioRef.current?.playUiClick();
            setActiveModal('none');
          }}
        />
      )}

      {activeModal === 'howto' && (
        <HowToPlayModal
          onClose={() => {
            audioRef.current?.playUiClick();
            setActiveModal('none');
          }}
        />
      )}

      {activeModal === 'about' && (
        <AboutModal
          onClose={() => {
            audioRef.current?.playUiClick();
            setActiveModal('none');
          }}
        />
      )}
    </div>
  );
}
