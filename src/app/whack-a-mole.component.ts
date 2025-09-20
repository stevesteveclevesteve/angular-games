import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';

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
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

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

  // Mobile touch handling properties
  private touchStartTime = 0;
  private touchStartData = new Map<number, { x: number; y: number; timestamp: number; holeId: number }>();
  private readonly MAX_TOUCH_DURATION = 300; // ms
  private readonly MAX_TOUCH_MOVEMENT = 15; // pixels
  private isProcessingTouch = false;

  constructor() {
    this.initializeHoles();
    this.loadHighScore();
    this.setupMobileViewport();
  }

  ngOnInit(): void {
    this.adjustGameSize();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private setupMobileViewport(): void {
    // Ensure proper viewport settings for mobile
    let viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no'
    );
  }

  private adjustGameSize(): void {
    if (!this.gameContainer?.nativeElement) return;
    
    const container = this.gameContainer.nativeElement;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // Ensure game doesn't exceed viewport with some padding
    const maxWidth = Math.min(500, viewport.width * 0.95);
    const maxHeight = Math.min(700, viewport.height * 0.9);
    
    container.style.maxWidth = `${maxWidth}px`;
    container.style.maxHeight = `${maxHeight}px`;
  }

  // Handle viewport changes (orientation, keyboard, etc.)
  @HostListener('window:resize')
  @HostListener('window:orientationchange')
  onViewportChange() {
    setTimeout(() => {
      this.adjustGameSize();
    }, 100);
  }

  // Prevent context menu on long press
  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event) {
    event.preventDefault();
    return false;
  }

  // Prevent unwanted touch behaviors
  @HostListener('touchend', ['$event'])
  onGlobalTouchEnd(event: TouchEvent) {
    // Prevent double-tap zoom
    event.preventDefault();
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

  // NEW: Mobile-optimized touch handlers
  onTouchStart(event: TouchEvent, holeId: number): void {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Touch start on hole:', holeId); // DEBUG
    
    if (this.isProcessingTouch || this.gameState !== 'playing') return;
    
    if (event.touches.length !== 1) return; // Only handle single touches

    const touch = event.touches[0];
    const touchId = touch.identifier;

    this.touchStartData.set(touchId, {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
      holeId: holeId
    });
  }

  onTouchEnd(event: TouchEvent, holeId: number): void {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Touch end on hole:', holeId); // DEBUG
    
    if (this.isProcessingTouch || this.gameState !== 'playing') return;
    
    if (event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const touchId = touch.identifier;
    const startData = this.touchStartData.get(touchId);

    if (!startData || startData.holeId !== holeId) {
      this.touchStartData.delete(touchId);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - startData.timestamp;

    // Clean up
    this.touchStartData.delete(touchId);

    console.log('Touch validation - Duration:', duration, 'HoleId:', holeId); // DEBUG

    // Validate the touch
    if (this.isValidTouch(touch, startData, duration)) {
      console.log('Valid touch detected, whacking mole:', holeId); // DEBUG
      this.isProcessingTouch = true;
      this.whackMole(holeId);
      
      // Reset processing flag after short delay
      setTimeout(() => {
        this.isProcessingTouch = false;
      }, 100);
    }
  }

  private isValidTouch(
    endTouch: Touch, 
    startData: { x: number; y: number; timestamp: number; holeId: number }, 
    duration: number
  ): boolean {
    // Check duration (not too long, not too short)
    if (duration > this.MAX_TOUCH_DURATION || duration < 50) {
      return false;
    }

    // Check movement (finger shouldn't move too much)
    const deltaX = Math.abs(endTouch.clientX - startData.x);
    const deltaY = Math.abs(endTouch.clientY - startData.y);
    const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (movement > this.MAX_TOUCH_MOVEMENT) {
      return false;
    }

    return true;
  }

  // NEW: Mouse handlers for desktop (only when not touch device)
  onMouseDown(event: MouseEvent, holeId: number): void {
    // Only handle mouse events if not on touch device
    if ('ontouchstart' in window) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Mouse down on hole:', holeId); // DEBUG
    
    if (this.gameState !== 'playing') return;
    
    this.touchStartTime = Date.now();
  }

  onMouseUp(event: MouseEvent, holeId: number): void {
    // Only handle mouse events if not on touch device
    if ('ontouchstart' in window) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Mouse up on hole:', holeId); // DEBUG
    
    if (this.gameState !== 'playing') return;
    
    const duration = Date.now() - this.touchStartTime;
    console.log('Mouse click duration:', duration, 'HoleId:', holeId); // DEBUG
    
    if (duration <= this.MAX_TOUCH_DURATION) {
      console.log('Valid mouse click detected, whacking mole:', holeId); // DEBUG
      this.whackMole(holeId);
    }
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
    console.log('whackMole called with holeId:', holeId, 'gameState:', this.gameState); // DEBUG
    
    if (this.gameState !== 'playing') return;

    const hole = this.holes.find(h => h.id === holeId);
    console.log('Found hole:', hole, 'Has mole:', !!hole?.mole, 'Mole visible:', hole?.mole?.isVisible); // DEBUG
    
    if (!hole || !hole.mole || !hole.mole.isVisible || hole.mole.isHit) return;

    // Mole hit!
    console.log('Mole hit! Score:', this.currentScore + 1); // DEBUG
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

    // Clear touch data
    this.touchStartData.clear();
    this.isProcessingTouch = false;
  }
}