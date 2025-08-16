/*
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PheasantZ {
  id: number;
  x: number;
  y: number;
  path: { x: number; y: number; time: number }[];
  startTime: number;
  isHit: boolean;
  isActive: boolean;
  hitTime?: number;
}

interface Pheasant {
  id: number;
  x: number;
  y: number;
  xf: number;
  yf: number;
  vx: number;
  vy: number;
  isHit: boolean;
  hitTime?: number;
  escaped: boolean;
  points: number;
  startTime: number;
  pathType: 'sine' | 'zigzag' | 'arc' | 'erratic';
  baseY: number;
  amplitude: number;
  frequency: number;
}

interface Shot {
  x: number;
  y: number;
  timestamp: number;
}

interface GameState {
  score: number;
  highScore: number;
  round: number;
  shotsRemaining: number;
  pheasants: Pheasant[];
  shots: Shot[];
  gameStatus: 'waiting' | 'active' | 'between-rounds' | 'game-over';
  message: string;
}

@Component({
  selector: 'app-pheasant-hunt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pheasant-hunt-b.component.html',
  styleUrl: './pheasant-hunt-b.component.css'
})
export class PheasantHuntBComponent implements OnInit, OnDestroy {
  private static HIGH_SCORE_KEY = 'pheasantHuntHighScore';

  gameState: GameState = {
    score: 0,
    highScore: 0,
    round: 1,
    shotsRemaining: 3,
    pheasants: [],
    shots: [],
    gameStatus: 'waiting',
    message: 'Click Start Game to begin!'
  };

  private animationFrameId?: number;
  private roundStartTime: number = 0;

  // Visual feedback
  hitMarkers: {x: number, y: number, points: number, timestamp: number}[] = [];

  // Game constants
  private readonly MAX_ROUNDS = 6;
  private readonly SHOTS_PER_ROUND = 3;
  private readonly ROUND_DURATION = 3600; // 3 seconds
  private readonly MAX_HIT_POINTS = 100;
  private readonly MIN_HIT_POINTS = 50;
  private readonly MISS_PENALTY = -25;
  private readonly ESCAPE_PENALTY = -50;
  readonly PHEASANT_SIZE = 60;
  private readonly PHEASANT_BUSH_HEIGHT = 0.6 * window.innerHeight;
  private readonly LOCATION_ABOVE_SCREEN = -0.05 * window.innerHeight; // 5% above the screen height

  // Store high score in a static property to persist across navigation
  private static storedHighScore = 0;

  ngOnInit() {
    // Restore high score if returning to component
    this.gameState.highScore = PheasantHuntBComponent.storedHighScore;
  }

  ngOnDestroy() {
    // Clean up animation frame
    PheasantHuntBComponent.storedHighScore = this.gameState.highScore;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  startGame() {
    this.gameState = {
      ...this.gameState,
      score: 0,
      round: 1,
      gameStatus: 'active',
      message: ''
    };
    this.startRound();
  }

  private startRound() {
    this.gameState.shotsRemaining = this.SHOTS_PER_ROUND;
    this.gameState.pheasants = [];
    this.gameState.message = `Round ${this.gameState.round}`;
    this.gameState.shots = [];

    // Create two pheasants with random paths
    // Release two pheasants with slight delay
    setTimeout(() => this.releasePheasant(), 100);
    setTimeout(() => this.releasePheasant(), 600);

    this.roundStartTime = Date.now();
    this.animate();

    // End round after duration
    setTimeout(() => this.endRound(), this.ROUND_DURATION);
  }

  private createPheasantZ(id: number): PheasantZ {
    // Random starting position at bottom of screen
    const startX = Math.random() * 80 + 10; // 10% to 90% of width
    const startY = 90; // Start near bottom

    // Generate random bezier curve path
    const path: { x: number; y: number; time: number }[] = [];
    const points = 50; // Number of points in path

    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const time = t * this.ROUND_DURATION;

      // Random bezier curve control points
      const cp1x = startX + (Math.random() - 0.5) * 60;
      const cp1y = 70 + Math.random() * 20;
      const cp2x = startX + (Math.random() - 0.5) * 80;
      const cp2y = 30 + Math.random() * 20;
      const endX = Math.random() * 100;
      const endY = -10; // Fly off top of screen

      // Cubic bezier curve
      const x = Math.pow(1 - t, 3) * startX +
                3 * Math.pow(1 - t, 2) * t * cp1x +
                3 * (1 - t) * Math.pow(t, 2) * cp2x +
                Math.pow(t, 3) * endX;

      const y = Math.pow(1 - t, 3) * startY +
                3 * Math.pow(1 - t, 2) * t * cp1y +
                3 * (1 - t) * Math.pow(t, 2) * cp2y +
                Math.pow(t, 3) * endY;

      path.push({ x, y, time });
    }

    return {
      id,
      x: startX,
      y: startY,
      path,
      startTime: Date.now(),
      isHit: false,
      isActive: true
    };
  }

  releasePheasant() {
    const pathTypes: Array<'sine' | 'zigzag' | 'arc' | 'erratic'> = ['sine', 'zigzag', 'arc', 'erratic'];
    const pathType = pathTypes[Math.floor(Math.random() * pathTypes.length)];

    const pheasant: Pheasant = {
      id: Date.now() + Math.random(),
      x: Math.random() * window.innerWidth, // Start any point along x axis
      y: this.PHEASANT_BUSH_HEIGHT, // Start from top of bushes
      xf: Math.random() * window.innerWidth, // End any point along x axis
      yf: this.LOCATION_ABOVE_SCREEN, // End above the visible area
      vx: 0,
      vy: (this.LOCATION_ABOVE_SCREEN - this.PHEASANT_BUSH_HEIGHT) / this.ROUND_DURATION * (1 + 0.1*(Math.random() - 0.5)), // upward velocity
      isHit: false,
      escaped: false,
      points: this.MAX_HIT_POINTS,
      startTime: Date.now(),
      pathType: pathType,
      baseY: 0,
      amplitude: 50 + Math.random() * 50,
      frequency: 0.002 + Math.random() * 0.003
    };

    // Calculate horizontal velocity based on starting position
    pheasant.vx = (pheasant.xf - pheasant.x) / this.ROUND_DURATION * (1 + 0.1*(Math.random() - 0.5));

    pheasant.baseY = pheasant.y;
    this.gameState.pheasants.push(pheasant);
  }

  private animateZ() {
    const now = Date.now();
    const elapsed = now - this.roundStartTime;

    // Update pheasant positions
    this.gameState.pheasants.forEach(pheasant => {
      if (!pheasant.isHit && pheasant.isActive) {
        const pheasantElapsed = now - pheasant.startTime;

        // Find current position on path
        for (let i = 0; i < pheasant.path.length - 1; i++) {
          if (pheasantElapsed >= pheasant.path[i].time &&
              pheasantElapsed <= pheasant.path[i + 1].time) {
            // Interpolate between points
            const t = (pheasantElapsed - pheasant.path[i].time) /
                     (pheasant.path[i + 1].time - pheasant.path[i].time);

            pheasant.x = pheasant.path[i].x +
                        (pheasant.path[i + 1].x - pheasant.path[i].x) * t;
            pheasant.y = pheasant.path[i].y +
                        (pheasant.path[i + 1].y - pheasant.path[i].y) * t;
            break;
          }
        }

        // Check if pheasant has flown off screen
        if (pheasant.y < -5) {
          pheasant.isActive = false;
        }
      }
    });

    if (elapsed < this.ROUND_DURATION && this.gameState.gameStatus === 'active') {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }

  onFieldClick(event: MouseEvent) {
    if (this.gameState.gameStatus !== 'active' || this.gameState.shotsRemaining <= 0) {
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    this.gameState.shotsRemaining--;

    // Check if shot hit any pheasant
    let hitPheasant = false;

    this.gameState.pheasants.forEach(pheasant => {
      if (!pheasant.isHit && pheasant.isActive) {
        // Hit detection (pheasant is roughly 5% x 5% of field)
        const distance = Math.sqrt(
          Math.pow(x - pheasant.x, 2) +
          Math.pow(y - pheasant.y, 2)
        );

        if (distance < 5) {
          pheasant.isHit = true;
          pheasant.hitTime = Date.now();
          hitPheasant = true;

          // Calculate points based on time
          const timeElapsed = Date.now() - this.roundStartTime;
          const timeRatio = 1 - (timeElapsed / this.ROUND_DURATION);
          const points = Math.round(
            this.MIN_HIT_POINTS +
            (this.MAX_HIT_POINTS - this.MIN_HIT_POINTS) * timeRatio
          );

          this.gameState.score += points;
          this.showFloatingScore(x, y, `+${points}`);
        }
      }
    });

    if (!hitPheasant) {
      // Missed shot penalty
      this.gameState.score += this.MISS_PENALTY;
      this.showFloatingScore(x, y, `${this.MISS_PENALTY}`);
    }

    // Check if round should end early (no shots left and all pheasants gone/hit)
    if (this.gameState.shotsRemaining === 0) {
      const activePheasants = this.gameState.pheasants.filter(
        p => !p.isHit && p.isActive
      );
      if (activePheasants.length === 0) {
        this.endRound();
      }
    }
  }

  private showFloatingScore(x: number, y: number, text: string) {
    // This would be better with a proper animation system
    // For now, just update the message briefly
    const oldMessage = this.gameState.message;
    this.gameState.message = text;
    setTimeout(() => {
      if (this.gameState.message === text) {
        this.gameState.message = oldMessage;
      }
    }, 1000);
  }

  private endRound() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    // Count escaped pheasants
    const escapedPheasants = this.gameState.pheasants.filter(
      p => !p.isHit && p.isActive
    );

    if (escapedPheasants.length > 0) {
      const penalty = escapedPheasants.length * this.ESCAPE_PENALTY;
      this.gameState.score += penalty;
      this.gameState.message = `${escapedPheasants.length} pheasants escaped! ${penalty} points`;
    }

    // Check if game is over
    if (this.gameState.round >= this.MAX_ROUNDS) {
      this.endGame();
    } else {
      this.gameState.gameStatus = 'between-rounds';
      this.gameState.round++;
      setTimeout(() => {
        if (this.gameState.gameStatus === 'between-rounds') {
          this.gameState.gameStatus = 'active';
          this.startRound();
        }
      }, 2000);
    }
  }

  private endGame() {
    this.gameState.gameStatus = 'game-over';

    if (this.gameState.score > this.gameState.highScore) {
      this.gameState.highScore = this.gameState.score;
      sessionStorage.setItem(
        PheasantHuntBComponent.HIGH_SCORE_KEY,
        this.gameState.highScore.toString()
      );
      this.gameState.message = `Game Over! New High Score: ${this.gameState.score}!`;
    } else {
      this.gameState.message = `Game Over! Score: ${this.gameState.score}`;
    }
  }

  getPheasantTransform(pheasant: Pheasant): string {
    if (pheasant.isHit) {
      // Fall down when hit
      const fallTime = (Date.now() - pheasant.hitTime!) / 1000;
      const fallY = pheasant.y + (fallTime * fallTime * 50); // Gravity effect
      return `translate(${pheasant.x}%, ${fallY}%) rotate(${fallTime * 180}deg)`;
    }
    return `translate(${pheasant.x}%, ${pheasant.y}%)`;
  }
}

*/
