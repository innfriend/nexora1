import { VehicleState } from './physics';

export const DRIFT_KING_DURATION_MS = 90_000;

export interface DriftStepOutput {
  totalScore: number;
  pendingScore: number;
  multiplier: number;
  comboTimerRatio: number;
  timeRemainingMs: number;
  zonesHit: number;
  bestSingleDrift: number;
  maxMultiplier: number;
  bannerText: string | null;
  playChime: boolean;
  finished: boolean;
}

export class DriftKingSession {
  public bankedScore = 0;
  public pendingPoints = 0;
  public multiplier = 1;
  public chainGraceTimer = 0;
  public readonly chainGraceDuration = 1.65;
  public timeRemainingMs = DRIFT_KING_DURATION_MS;
  public zonesHit = 0;
  public bestSingleDrift = 0;
  public maxMultiplier = 1;
  private lastClippedCheckpoint: number | null = null;
  private finished = false;

  public reset(): void {
    this.bankedScore = 0;
    this.pendingPoints = 0;
    this.multiplier = 1;
    this.chainGraceTimer = 0;
    this.timeRemainingMs = DRIFT_KING_DURATION_MS;
    this.zonesHit = 0;
    this.bestSingleDrift = 0;
    this.maxMultiplier = 1;
    this.lastClippedCheckpoint = null;
    this.finished = false;
  }

  public step(
    player: VehicleState,
    wallImpact: number,
    crossedCheckpointIndex: number | null,
    dt: number,
  ): DriftStepOutput {
    let bannerText: string | null = null;
    let playChime = false;

    if (this.finished) {
      return this.buildSnapshot(bannerText, playChime);
    }

    this.timeRemainingMs = Math.max(0, this.timeRemainingMs - dt * 1000);

    // 1. Wall Hit wipes unbanked pending drift points!
    if (wallImpact > 0.14 && this.pendingPoints > 40) {
      this.pendingPoints = 0;
      this.multiplier = 1;
      this.chainGraceTimer = 0;
      bannerText = 'WALL HIT — DRIFT LOST!';
    } else {
      // 2. Check active sideways drift accumulation
      const speedAbs = Math.abs(player.speed);
      const fwdX = Math.sin(player.heading);
      const fwdZ = Math.cos(player.heading);
      const rightX = -Math.cos(player.heading);
      const rightZ = Math.sin(player.heading);
      const lateralSpeed = Math.abs(player.vx * rightX + player.vz * rightZ);
      const forwardSpeed = Math.abs(player.vx * fwdX + player.vz * fwdZ);

      const activeSlide =
        (player.drifting || lateralSpeed > 3.6) && speedAbs > 9.5 && forwardSpeed > 4.0;

      if (activeSlide) {
        const rate = (speedAbs * 11.5 + lateralSpeed * 28) * dt;
        this.pendingPoints += rate;
        this.chainGraceTimer = this.chainGraceDuration;

        // Escalate multiplier smoothly as single-chain points climb
        const autoMult =
          this.pendingPoints > 2800
            ? 4
            : this.pendingPoints > 1500
              ? 3
              : this.pendingPoints > 600
                ? 2
                : 1;
        if (autoMult > this.multiplier) {
          this.multiplier = autoMult;
          if (this.multiplier > this.maxMultiplier) {
            this.maxMultiplier = this.multiplier;
          }
        }

        // Apex Clipping Zone Bonus when drifting past a glowing track gate
        if (
          crossedCheckpointIndex !== null &&
          crossedCheckpointIndex !== this.lastClippedCheckpoint
        ) {
          this.lastClippedCheckpoint = crossedCheckpointIndex;
          this.zonesHit += 1;
          this.multiplier = Math.min(5, this.multiplier + 1);
          if (this.multiplier > this.maxMultiplier) {
            this.maxMultiplier = this.multiplier;
          }
          this.pendingPoints += 450;
          bannerText = `APEX CLIPPED! ${this.multiplier}x MULTIPLIER`;
          playChime = true;
        }
      } else if (this.pendingPoints > 0) {
        if (crossedCheckpointIndex !== null) {
          this.lastClippedCheckpoint = null;
        }
        this.chainGraceTimer -= dt;
        if (this.chainGraceTimer <= 0) {
          const banked = Math.round(this.pendingPoints * this.multiplier);
          this.bankedScore += banked;
          if (banked > this.bestSingleDrift) {
            this.bestSingleDrift = banked;
          }
          if (banked >= 250) {
            bannerText = `BANKED +${banked.toLocaleString()} PTS`;
            playChime = true;
          }
          this.pendingPoints = 0;
          this.multiplier = 1;
          this.chainGraceTimer = 0;
        }
      }
    }

    // 3. Time Expired — cleanly bank any active drift!
    if (this.timeRemainingMs <= 0) {
      if (this.pendingPoints > 0) {
        const finalBank = Math.round(this.pendingPoints * this.multiplier);
        this.bankedScore += finalBank;
        if (finalBank > this.bestSingleDrift) {
          this.bestSingleDrift = finalBank;
        }
        this.pendingPoints = 0;
      }
      this.finished = true;
    }

    return this.buildSnapshot(bannerText, playChime);
  }

  public getGrade(): 'S' | 'A' | 'B' | 'C' {
    if (this.bankedScore >= 25000) return 'S';
    if (this.bankedScore >= 15000) return 'A';
    if (this.bankedScore >= 7500) return 'B';
    return 'C';
  }

  private buildSnapshot(bannerText: string | null, playChime: boolean): DriftStepOutput {
    return {
      totalScore: Math.round(this.bankedScore),
      pendingScore: Math.round(this.pendingPoints),
      multiplier: this.multiplier,
      comboTimerRatio:
        this.pendingPoints > 0 && this.chainGraceDuration > 0
          ? Math.max(0, this.chainGraceTimer / this.chainGraceDuration)
          : 0,
      timeRemainingMs: this.timeRemainingMs,
      zonesHit: this.zonesHit,
      bestSingleDrift: this.bestSingleDrift,
      maxMultiplier: this.maxMultiplier,
      bannerText,
      playChime,
      finished: this.finished,
    };
  }
}
