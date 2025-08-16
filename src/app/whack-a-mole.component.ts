import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgStyle } from '@angular/common';

interface Mole {
  id: number;
  isVisible: boolean;
  isHit: boolean;
  isEntering: boolean;
  isExiting: boolean;
  showTime: number;
  timeoutId?: number;
}

interface Hole {
  id: number;
  mole?: Mole;
}

type GameState = 'waiting' | 'playing' | 'finished';

@Component({
  selector: 'app-whack-a-mole',
  imports: [],
  templateUrl: './whack-a-mole.component.html',
  styleUrls: ['./whack-a-mole.component.css']
})
export class WhackAMoleComponent implements OnInit, OnDestroy {
  gameState: GameState = 'waiting';
  currentScore = 0;
  highScore = 0;
  timeRemaining = 30;

  holes: Hole[] = [];

  private gameTimer?: number;
  private countdownTimer?: number;
  private moleSpawnTimer?: number;
  private activeMoles = 0;
  private readonly MAX_ACTIVE_MOLES = 3;
  private readonly ROUND_DURATION = 30000; // 30 seconds
  private readonly MIN_MOLE_TIME = 500; // 0.5 seconds
  private readonly MAX_MOLE_TIME = 1250; // 1.25 seconds
  private readonly MIN_SPAWN_INTERVAL = 800; // minimum time between spawns
  private readonly MAX_SPAWN_INTERVAL = 2500; // maximum time between spawns

  constructor() {
    this.initializeHoles();
    this.loadHighScore();
  }

  ngOnInit(): void {
    // Component initialization complete
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initializeHoles(): void {
    this.holes = [];
    for (let i = 0; i < 7; i++) {
      this.holes.push({ id: i });
    }
  }

  private loadHighScore(): void {
    const saved = localStorage.getItem('whack-a-mole-high-score');
    if (saved) {
      this.highScore = parseInt(saved, 10);
    }
  }

  private saveHighScore(): void {
    if (this.currentScore > this.highScore) {
      this.highScore = this.currentScore;
      localStorage.setItem('whack-a-mole-high-score', this.highScore.toString());
    }
  }

  getGridArea(index: number): string {
    // Map holes to grid positions based on the pattern:
    // --O--O--
    // O--O--O
    // --O--O--
    const gridPositions = [
      '1 / 1 / 2 / 4', // hole 0: row 1, col 2
      '1 / 4 / 2 / 7', // hole 1: row 1, col 4
      '2 / 1 / 3 / 3', // hole 2: row 2, col 1
      '2 / 3 / 3 / 5', // hole 3: row 2, col 2
      '2 / 5 / 3 / 7', // hole 4: row 2, col 4
      '3 / 1 / 4 / 4', // hole 5: row 3, col 2
      '3 / 4 / 4 / 7'  // hole 6: row 3, col 4
    ];
    return gridPositions[index] || '1 / 1 / 2 / 2';
  }

  getGridTextAlign(index: number): string {
    const textAlignments = [
      'right', 'left', 'right', 'center', 'left', 'right', 'left'
    ];
    return textAlignments[index] || 'center';
  }

  getScoreDigit(position: number): string {
    const scoreString = this.currentScore.toString().padStart(2, '0');
    return scoreString[position] || '0';
  }

  getTimeRemainingDigit(position: number): string {
    const scoreString = this.timeRemaining.toString().padStart(2, '0');
    return scoreString[position] || '0';
  }

  getHighScoreDigit(position: number): string {
    const scoreString = this.highScore.toString().padStart(2, '0');
    return scoreString[position] || '0';
  }

  startGame(): void {
    this.gameState = 'playing';
    this.currentScore = 0;
    this.timeRemaining = 30;
    this.activeMoles = 0;
    this.cleanup();

    // Start countdown timer
    this.countdownTimer = window.setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.endGame();
      }
    }, 1000);

    // Start mole spawning
    this.scheduleMoleSpawn();
  }

  private scheduleMoleSpawn(): void {
    if (this.gameState !== 'playing') return;

    const spawnDelay = Math.random() * (this.MAX_SPAWN_INTERVAL - this.MIN_SPAWN_INTERVAL) + this.MIN_SPAWN_INTERVAL;

    this.moleSpawnTimer = window.setTimeout(() => {
      this.spawnMole();
      this.scheduleMoleSpawn(); // Schedule the next spawn
    }, spawnDelay);
  }

  private spawnMole(): void {
    if (this.gameState !== 'playing' || this.activeMoles >= this.MAX_ACTIVE_MOLES) {
      return;
    }

    // Find available holes
    const availableHoles = this.holes.filter(hole => !hole.mole?.isVisible);
    if (availableHoles.length === 0) return;

    // Randomly select a hole
    const selectedHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];

    // Create mole
    const showTime = Math.random() * (this.MAX_MOLE_TIME - this.MIN_MOLE_TIME) + this.MIN_MOLE_TIME;
    const mole: Mole = {
      id: Date.now() + selectedHole.id,
      isVisible: false,
      isHit: false,
      isEntering: true,
      isExiting: false,
      showTime: showTime
    };

    selectedHole.mole = mole;
    this.activeMoles++;

    // Start entrance animation
    setTimeout(() => {
      if (mole && !mole.isHit) {
        mole.isEntering = false;
        mole.isVisible = true;
      }
    }, 50);

    // Schedule mole to hide
    mole.timeoutId = window.setTimeout(() => {
      this.hideMole(selectedHole);
    }, showTime);
  }

  private hideMole(hole: Hole): void {
    if (!hole.mole || hole.mole.isHit) return;

    hole.mole.isVisible = false;
    hole.mole.isExiting = true;

    setTimeout(() => {
      if (hole.mole) {
        this.activeMoles--;
        hole.mole = undefined;
      }
    }, 150); // Wait for exit animation
  }

  whackMole(holeId: number): void {
    if (this.gameState !== 'playing') return;

    const hole = this.holes.find(h => h.id === holeId);
    if (!hole || !hole.mole || !hole.mole.isVisible || hole.mole.isHit) return;

    // Mole hit!
    hole.mole.isHit = true;
    hole.mole.isVisible = false;
    this.currentScore++;
    this.activeMoles--;

    // Clear the timeout
    if (hole.mole.timeoutId) {
      clearTimeout(hole.mole.timeoutId);
    }

    // Remove mole after hit animation
    setTimeout(() => {
      if (hole.mole) {
        hole.mole = undefined;
      }
    }, 200);
  }

  private endGame(): void {
    this.gameState = 'finished';
    this.cleanup();
    this.saveHighScore();

    // Hide all moles
    this.holes.forEach(hole => {
      if (hole.mole) {
        this.hideMole(hole);
      }
    });
  }

  resetGame(): void {
    this.gameState = 'waiting';
    this.currentScore = 0;
    this.timeRemaining = 30;
    this.cleanup();

    // Clear all moles
    this.holes.forEach(hole => {
      if (hole.mole?.timeoutId) {
        clearTimeout(hole.mole.timeoutId);
      }
      hole.mole = undefined;
    });

    this.activeMoles = 0;
  }

  private cleanup(): void {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = undefined;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }

    if (this.moleSpawnTimer) {
      clearTimeout(this.moleSpawnTimer);
      this.moleSpawnTimer = undefined;
    }

    // Clear all mole timeouts
    this.holes.forEach(hole => {
      if (hole.mole?.timeoutId) {
        clearTimeout(hole.mole.timeoutId);
      }
    });
  }
}
