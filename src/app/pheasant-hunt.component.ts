import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Pheasant {
  id: number;
  isMale: boolean;
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
  templateUrl: './pheasant-hunt.component.html',
  styleUrl: './pheasant-hunt.component.css'
})
export class PheasantHuntComponent implements OnInit, OnDestroy {
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
  private roundTimer?: number;

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
  readonly PHEASANT_SIZE = 80;
  private readonly PHEASANT_BUSH_HEIGHT = 60;
  private readonly LOCATION_ABOVE_SCREEN = -5; // 5% above the screen height

  // Store high score in a static property to persist across navigation
  private static storedHighScore = 0;

  ngOnInit() {
    // Restore high score if returning to component
    this.gameState.highScore = PheasantHuntComponent.storedHighScore;
  }

  ngOnDestroy() {
    PheasantHuntComponent.storedHighScore = this.gameState.highScore;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
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

    // Release two pheasants with slight delay
    setTimeout(() => this.releasePheasant(), 100);
    setTimeout(() => this.releasePheasant(), 600);

    this.roundStartTime = Date.now();
    this.animate();

    // Store timer ID and end round after duration
    this.roundTimer = setTimeout(() => this.endRound(), this.ROUND_DURATION);
  }

  private animate() {
    if (!(this.gameState.gameStatus == "active")) return;

    const now = Date.now();

    // Update pheasants
    this.gameState.pheasants.forEach(pheasant => {
      if (!pheasant.isHit && !pheasant.escaped) {
        const elapsed = now - pheasant.startTime;
        const pointsRatio = 1 - (elapsed / this.ROUND_DURATION) * 0.5;
        pheasant.points = Math.round(this.MAX_HIT_POINTS * Math.max(pointsRatio, 0.5));

        const progress = Math.min(elapsed / this.ROUND_DURATION, 1);

        // Store initial positions if not already stored
        if (!pheasant.hasOwnProperty('initialX')) {
          (pheasant as any).initialX = pheasant.x;
          (pheasant as any).initialY = pheasant.y;
        }

        const initialX = (pheasant as any).initialX;
        const initialY = (pheasant as any).initialY;

        // Calculate straight line path
        const straightLineX = initialX + (pheasant.xf - initialX) * progress;
        const straightLineY = initialY + (pheasant.yf - initialY) * progress;

        // Calculate deviations
        const pathDistanceX = Math.abs(pheasant.xf - initialX);
        const pathDistanceY = Math.abs(pheasant.yf - initialY);
        const maxDeviationX = Math.min(pathDistanceX * 0.2, 10);
        const maxDeviationY = Math.min(pathDistanceY * 0.2, 10);

        let deviationX = 0;
        let deviationY = 0;

        switch(pheasant.pathType) {
          case 'sine':
            deviationX = Math.sin(elapsed * pheasant.frequency) * maxDeviationX;
            deviationY = Math.sin(elapsed * pheasant.frequency * 1.5) * maxDeviationY;
            break;
          case 'zigzag':
            // Create a smooth triangular wave for zigzag motion
            const zigzagPeriod = 800; // milliseconds per zigzag
            const zigzagProgress = (elapsed % zigzagPeriod) / zigzagPeriod;
            // Create triangular wave: 0->1->0->-1->0
            let triangularWave;
            if (zigzagProgress < 0.25) {
              triangularWave = zigzagProgress * 4;
            } else if (zigzagProgress < 0.75) {
              triangularWave = 2 - (zigzagProgress * 4);
            } else {
              triangularWave = (zigzagProgress * 4) - 4;
            }
            deviationX = triangularWave * maxDeviationX;
            // Add slight vertical wobble
            deviationY = Math.sin(elapsed * 0.003) * maxDeviationY * 0.3;
            break;
          case 'arc':
            const arcProgress = Math.sin(progress * Math.PI);
            deviationX = arcProgress * maxDeviationX;
            deviationY = -arcProgress * maxDeviationY * 0.5;
            break;
          case 'erratic':
            // Use multiple sine waves for more organic movement
            deviationX = (Math.sin(elapsed * 0.003) + Math.sin(elapsed * 0.007)) * maxDeviationX * 0.3;
            deviationY = (Math.cos(elapsed * 0.004) + Math.sin(elapsed * 0.006)) * maxDeviationY * 0.3;
            break;
        }

        // Update position
        pheasant.x = straightLineX + deviationX;
        pheasant.y = straightLineY + deviationY;

        // Check if pheasant has escaped
        if (progress >= 1 || pheasant.y < this.LOCATION_ABOVE_SCREEN) {
          pheasant.escaped = true;
          this.gameState.score += this.ESCAPE_PENALTY;
        }
      }
    });

    this.gameState.shots = this.gameState.shots.filter(shot => Date.now() - shot.timestamp < 200);
    this.hitMarkers = this.hitMarkers.filter(marker => Date.now() - marker.timestamp < 1000);

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  releasePheasant() {
    const pathTypes: Array<'sine' | 'zigzag' | 'arc' | 'erratic'> = ['sine', 'zigzag', 'arc', 'erratic'];
    const pathType = pathTypes[Math.floor(Math.random() * pathTypes.length)];

    const startX = Math.random() * 100;
    const endX = Math.random() * 100;

    const pheasant: Pheasant = {
      id: Date.now() + Math.random(),
      x: startX,
      y: this.PHEASANT_BUSH_HEIGHT,
      xf: endX,
      yf: this.LOCATION_ABOVE_SCREEN,
      vx: 0,
      vy: 0,
      isHit: false,
      escaped: false,
      points: this.MAX_HIT_POINTS,
      startTime: Date.now(),
      pathType: pathType,
      baseY: this.PHEASANT_BUSH_HEIGHT,
      amplitude: 5 + Math.random() * 5,
      frequency: 0.002 + Math.random() * 0.003,
      isMale: Math.random() > 0.5  // 50% chance of male pheasant
    };

    this.gameState.pheasants.push(pheasant);
  }

  onFieldClick(event: MouseEvent) {
    if (this.gameState.gameStatus !== 'active' || this.gameState.shotsRemaining <= 0) {
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = ((event.clientX - rect.left) / rect.width) * 100;
    const clickY = ((event.clientY - rect.top) / rect.height) * 100;

    this.gameState.shotsRemaining--;

    this.gameState.shots.push({
      x: clickX,
      y: clickY,
      timestamp: Date.now()
    });

    let hitPheasant = false;

    this.gameState.pheasants.forEach(pheasant => {
      if (!pheasant.isHit && !pheasant.escaped) {
        // Updated dimensions for larger pheasants
        const pheasantWidthPercent = (80 / rect.width) * 100;
        const pheasantHeightPercent = (40 / rect.height) * 100;

        const pheasantLeft = pheasant.x - pheasantWidthPercent / 2;
        const pheasantRight = pheasant.x + pheasantWidthPercent / 2;
        const pheasantTop = pheasant.y - pheasantHeightPercent / 2;
        const pheasantBottom = pheasant.y + pheasantHeightPercent / 2;

        if (clickX >= pheasantLeft && clickX <= pheasantRight &&
            clickY >= pheasantTop && clickY <= pheasantBottom) {
          pheasant.isHit = true;
          pheasant.hitTime = Date.now();
          hitPheasant = true;

          // Bonus points for male pheasants
          const points = pheasant.isMale ? pheasant.points + 10 : pheasant.points;
          this.gameState.score += points;

          this.hitMarkers.push({
            x: pheasant.x,
            y: pheasant.y,
            points: points,
            timestamp: Date.now()
          });
        }
      }
    });

    if (!hitPheasant) {
      this.gameState.score += this.MISS_PENALTY;
      this.hitMarkers.push({
        x: clickX,
        y: clickY,
        points: this.MISS_PENALTY,
        timestamp: Date.now()
      });
    }

    if (this.gameState.shotsRemaining === 0) {
      const activePheasants = this.gameState.pheasants.filter(p => !p.isHit && !p.escaped);
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
    // Guard against multiple calls
    if (this.gameState.gameStatus !== 'active') {
      return;
    }

    // Clear the round timer if it exists
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    // Count escaped pheasants
    const escapedPheasants = this.gameState.pheasants.filter(
      p => p.escaped
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
        PheasantHuntComponent.HIGH_SCORE_KEY,
        this.gameState.highScore.toString()
      );
      this.gameState.message = `Game Over! New High Score: ${this.gameState.score}!`;
    } else {
      this.gameState.message = `Game Over! Score: ${this.gameState.score}`;
    }
  }

  getPheasantPosition(pheasant: Pheasant): { x: number, y: number } {
    if (pheasant.isHit) {
      const fallTime = (Date.now() - pheasant.hitTime!) / 1000;
      // Accelerate downward from current position
      const fallY = pheasant.y + (fallTime * fallTime * 100);
      return { x: pheasant.x, y: fallY };
    }
    return { x: pheasant.x, y: pheasant.y };
  }

  getPheasantRotation(pheasant: Pheasant): string {
    if (pheasant.isHit) {
      const fallTime = (Date.now() - pheasant.hitTime!) / 1000;
      // Rotate continuously while falling
      return `rotate(${fallTime * 720}deg)`; // 2 rotations per second
    }
    return '';
  }

  isPheasantVisible(pheasant: Pheasant): boolean {
    if (pheasant.isHit) {
      const currentPos = this.getPheasantPosition(pheasant);
      // Hide when it reaches bush height
      return currentPos.y < this.PHEASANT_BUSH_HEIGHT;
    }
    return !pheasant.escaped;
  }
}
