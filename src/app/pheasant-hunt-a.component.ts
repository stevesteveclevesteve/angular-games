import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Pheasant {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hit: boolean;
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

@Component({
  selector: 'app-pheasant-hunt-a',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pheasant-hunt-a.component.html',
  styleUrl: './pheasant-hunt-a.component.css'
})
export class PheasantHuntAComponent implements OnInit, OnDestroy {
  // Game state
  gameActive = false;
  currentRound = 0;
  totalRounds = 6;
  score = 0;
  highScore = 0;
  shotsRemaining = 3;

  // Pheasants
  pheasants: Pheasant[] = [];

  // Visual feedback
  shots: Shot[] = [];
  hitMarkers: {x: number, y: number, points: number, timestamp: number}[] = [];

  // Animation
  private animationFrameId: number | null = null;
  private roundTimer: any = null;

  // Constants
  readonly MAX_POINTS = 100;
  readonly MIN_POINTS = 50;
  readonly MISS_PENALTY = -10;
  readonly ESCAPE_PENALTY = -25;
  readonly WAVE_DURATION = 3000; // 3 seconds
  readonly PHEASANT_SIZE = 60;

  // Store high score in a static property to persist across navigation
  private static storedHighScore = 0;

  ngOnInit() {
    // Restore high score if returning to component
    this.highScore = PheasantHuntAComponent.storedHighScore;
  }

  ngOnDestroy() {
    // Save high score when leaving component
    PheasantHuntAComponent.storedHighScore = this.highScore;
    this.cleanup();
  }

  startGame() {
    this.gameActive = true;
    this.score = 0;
    this.currentRound = 1;
    this.startRound();
  }

  startRound() {
    this.shotsRemaining = 3;
    this.pheasants = [];
    this.shots = [];

    // Release two pheasants with slight delay
    setTimeout(() => this.releasePheasant(), 100);
    setTimeout(() => this.releasePheasant(), 600);

    // Start animation loop
    this.animate();

    // Set timer for end of wave
    this.roundTimer = setTimeout(() => {
      this.endRound();
    }, this.WAVE_DURATION);
  }

  releasePheasant() {
    const pathTypes: Array<'sine' | 'zigzag' | 'arc' | 'erratic'> = ['sine', 'zigzag', 'arc', 'erratic'];
    const pathType = pathTypes[Math.floor(Math.random() * pathTypes.length)];

    const pheasant: Pheasant = {
      id: Date.now() + Math.random(),
      x: Math.random() < 0.5 ? -50 : window.innerWidth + 50, // Start from either side
      y: window.innerHeight - 100 - Math.random() * 100, // Start near bottom
      vx: (Math.random() < 0.5 ? 1 : -1) * (150 + Math.random() * 100), // pixels per second
      vy: -(200 + Math.random() * 100), // upward velocity
      hit: false,
      escaped: false,
      points: this.MAX_POINTS,
      startTime: Date.now(),
      pathType: pathType,
      baseY: 0,
      amplitude: 50 + Math.random() * 50,
      frequency: 0.002 + Math.random() * 0.003
    };

    // Adjust horizontal velocity based on starting position
    if (pheasant.x < 0) {
      pheasant.vx = Math.abs(pheasant.vx);
    } else {
      pheasant.vx = -Math.abs(pheasant.vx);
    }

    pheasant.baseY = pheasant.y;
    this.pheasants.push(pheasant);
  }

  private animate() {
    if (!this.gameActive) return;

    const now = Date.now();
    const deltaTime = 0.016; // Assume 60 FPS

    // Update pheasants
    this.pheasants.forEach(pheasant => {
      if (!pheasant.hit && !pheasant.escaped) {
        // Calculate time-based points
        const elapsed = now - pheasant.startTime;
        const pointsRatio = 1 - (elapsed / this.WAVE_DURATION) * 0.5;
        pheasant.points = Math.round(this.MAX_POINTS * Math.max(pointsRatio, 0.5));

        // Update position based on path type
        pheasant.x += pheasant.vx * deltaTime;

        switch(pheasant.pathType) {
          case 'sine':
            pheasant.y = pheasant.baseY + pheasant.vy * deltaTime * (now - pheasant.startTime) / 16
                        + Math.sin((now - pheasant.startTime) * pheasant.frequency) * pheasant.amplitude;
            break;
          case 'zigzag':
            const zigzagPhase = Math.floor((now - pheasant.startTime) / 300) % 2;
            pheasant.y += pheasant.vy * deltaTime + (zigzagPhase === 0 ? -2 : 2);
            break;
          case 'arc':
            const t = (now - pheasant.startTime) / 1000;
            pheasant.y = pheasant.baseY - (pheasant.vy * t) + (50 * t * t);
            break;
          case 'erratic':
            pheasant.vx += (Math.random() - 0.5) * 500 * deltaTime;
            pheasant.vy += (Math.random() - 0.5) * 300 * deltaTime;
            pheasant.x += pheasant.vx * deltaTime;
            pheasant.y += pheasant.vy * deltaTime;
            break;
        }

        // Check if pheasant has escaped
        if (pheasant.x < -100 || pheasant.x > window.innerWidth + 100 ||
            pheasant.y < -100) {
          pheasant.escaped = true;
          this.score += this.ESCAPE_PENALTY;
        }
      }
    });

    // Clean up old shot markers and hit markers
    this.shots = this.shots.filter(shot => now - shot.timestamp < 200);
    this.hitMarkers = this.hitMarkers.filter(marker => now - marker.timestamp < 1000);

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  onFieldClick(event: MouseEvent) {
    if (!this.gameActive || this.shotsRemaining <= 0) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.shotsRemaining--;
    this.shots.push({ x, y, timestamp: Date.now() });

    // Check for hits
    let hitAny = false;
    this.pheasants.forEach(pheasant => {
      if (!pheasant.hit && !pheasant.escaped) {
        const distance = Math.sqrt(
          Math.pow(x - pheasant.x, 2) +
          Math.pow(y - pheasant.y, 2)
        );

        if (distance < this.PHEASANT_SIZE / 2) {
          pheasant.hit = true;
          hitAny = true;
          this.score += pheasant.points;
          this.hitMarkers.push({
            x: pheasant.x,
            y: pheasant.y,
            points: pheasant.points,
            timestamp: Date.now()
          });
        }
      }
    });

    if (!hitAny) {
      this.score += this.MISS_PENALTY;
    }
  }

  private endRound() {
    // Cancel animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Check for escaped pheasants
    this.pheasants.forEach(pheasant => {
      if (!pheasant.hit && !pheasant.escaped) {
        this.score += this.ESCAPE_PENALTY;
      }
    });

    if (this.currentRound < this.totalRounds) {
      this.currentRound++;
      setTimeout(() => this.startRound(), 2000);
    } else {
      this.endGame();
    }
  }

  private endGame() {
    this.gameActive = false;
    this.cleanup();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      PheasantHuntAComponent.storedHighScore = this.highScore;
    }
  }

  private cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  resetGame() {
    this.cleanup();
    this.gameActive = false;
    this.currentRound = 0;
    this.score = 0;
    this.pheasants = [];
    this.shots = [];
    this.hitMarkers = [];
  }
}
