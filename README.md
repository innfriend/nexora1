# Nexora Street Racer

**Nexora Street Racer** is an independent browser-based 3D arcade street racing game built under **Nexora Games** (*"Own the Road"*).

## Features Implemented

- **3D Arcade Vehicle & Physics**: Composite 12-part aerodynamic GT sports car with steering front wheels, rotating alloy rims, pitch/roll suspension lean, speed-sensitive steering, handbrake drifting, reverse gear, tire smoke particles, and barrier/vehicle collision response.
- **Closed-Loop Metropolitan Circuit**: 1.30 km figure-8 city track featuring a wide start/finish straightaway, sweeping corners, an elevated overpass bridge, an illuminated underpass tunnel, concrete barriers, streetlights, and instanced skyscrapers.
- **Race Loop & Game Modes**:
  - **Circuit Race**: 3 laps against 3 AI opponents across `Easy`, `Normal`, and `Hard` difficulty tiers with live race positions.
  - **Time Trial**: 3-lap solo run with lap splits and local personal best record persistence.
  - **Free Drive**: Open practice around the closed-loop circuit.
  - Ordered 6-checkpoint validation prevents reverse-crossing exploits, paired with `3 · 2 · 1 · GO` countdown, lap timers, pause/resume, and post-race results.
- **Desktop & Mobile Controls**:
  - Desktop: `W / Up` Accelerate, `S / Down` Brake & Reverse, `A D / Left Right` Steer, `Space` Handbrake Drift, `Esc` Pause.
  - Mobile / Tablet: Multi-touch pointer controls with zero-scroll protection (`touch-action: none`) and portrait/landscape camera adaptation.
- **Procedural Graphics & Web Audio**: Procedural PBR textures, `RoomEnvironment` reflections, software-WebGL fallback pacing, and synthesized Web Audio engine RPM, tire skid, collision, countdown, and chime effects.

## Local Setup & Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server** (runs on port `3000`):
   ```bash
   npm run dev
   ```

3. **Type-check & build for production**:
   ```bash
   npm run lint
   npm run build
   ```

4. **Preview the production bundle**:
   ```bash
   npm run preview
   ```

## Testing Desktop & Mobile Controls

- **Desktop**: Open the app, click **PLAY NOW** or **START RACE**, wait for the `3 · 2 · 1` countdown, and drive with `WASD` or Arrow keys. Press `Space` in turns to drift and `Esc` to pause.
- **Mobile / Touch**: Open on a touch device or toggle **Settings -> On-Screen Touch Controls -> Always On** to test multi-touch steering, gas, brake/reverse, and drift pads.

## Architecture Notes

- `src/game/`: Pure Three.js 3D engine (`engine.ts`), closed-loop circuit & city generator (`track.ts`), vehicle physics & AI (`physics.ts`), 3D car builder (`carModel.ts`), procedural textures (`textures.ts`), Web Audio synthesizer (`audio.ts`), local record persistence (`storage.ts`), and disabled-by-default modular monetization stubs (`monetization.ts`).
- `src/components/`: Decoupled React UI layer (`LandingOverlay.tsx`, `RaceHud.tsx`, `MobileControls.tsx`, `PauseModal.tsx`, `ResultsModal.tsx`, `SettingsModal.tsx`, `InfoModals.tsx`).

## Deployment

The project builds to a static production bundle in `dist/` via `npm run build` and can be deployed directly to Vercel, Cloudflare Pages, Netlify, or any static CDN host.
