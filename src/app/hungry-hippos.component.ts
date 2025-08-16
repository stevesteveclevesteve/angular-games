import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';

interface Sphere {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bonus: boolean;
  eaten: boolean;
  eatenBy?: number;
  lastMovementCheck?: number;
}

interface PowerUp extends Sphere {
  type: 'speed' | 'range' | 'stun';
  collected: boolean;
  spawnTime: number;
}

type Direction = 'N' | 'E' | 'S' | 'W';
type AIPersonality = 'sniper' | 'masher' | 'rando' | 'rhythm' | 'player';
type GameState = 'countdown' | 'playing' | 'gameover';

interface Hippo {
  id: number;
  x: number;
  y: number;
  angle: number;
  direction: Direction;
  headX: number;
  headY: number;
  baseHeadX: number;
  baseHeadY: number;
  isEating: boolean;
  animationProgress: number;
  score: number;
  color: string;
  personality: AIPersonality;
  lastActionTime?: number;
  nextActionTime?: number;
  rhythmPhase?: number;
  // Power-up effects
  powerUpActive?: boolean;
  powerUpEndTime?: number;
  powerUpType?: 'speed' | 'range' | 'stun';
}

interface HitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-hungry-hippos',
  templateUrl: './hungry-hippos.component.html',
  styleUrls: ['./hungry-hippos.component.css']
})
export class HungryHipposComponent implements OnInit {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;

  // Game constants
  private readonly BOARD_SIZE = 600;
  private readonly SPHERE_DIAMETER = this.BOARD_SIZE / 20;
  private readonly SPHERE_RADIUS = this.SPHERE_DIAMETER / 2;
  private readonly CENTER_X = this.BOARD_SIZE / 2;
  private readonly CENTER_Y = this.BOARD_SIZE / 2;
  private readonly HIPPO_SIZE = this.BOARD_SIZE / 3.5;
  private readonly HIPPO_HEAD_SIZE = this.BOARD_SIZE / 7;
  private readonly ANIMATION_DURATION = 300;
  private readonly HIPPO_OFFSET = this.HIPPO_SIZE / 3;
  private readonly COUNTDOWN_DURATION = 3000; // 3 seconds
  private readonly STUCK_CHECK_INTERVAL = 2000; // Check every 2 seconds
  private readonly STUCK_VELOCITY_THRESHOLD = 0.2; // Very slow movement
  private readonly STUCK_TIME_LIMIT = 8000; // 8 seconds of being stuck

  // Physics constants
  private readonly ATTRACTION_FORCE = 0.05;
  private readonly DAMPING = 0.98;
  private readonly REPULSION_FORCE = 5;

  // AI constants
  private readonly AI_PERSONALITIES: AIPersonality[] = ['sniper', 'masher', 'rando', 'rhythm'];
  private readonly SNIPER_DETECTION_RANGE = this.HIPPO_HEAD_SIZE * 1.8;
  private readonly MASHER_INTERVAL = 400;
  private readonly RANDO_MIN_INTERVAL = 500;
  private readonly RANDO_MAX_INTERVAL = 2000;
  private readonly RHYTHM_PATTERN = [600, 400, 400, 1200];

  // Game state
  gameState: GameState = 'countdown';
  spheres: Sphere[] = [];
  hippos: Hippo[] = [];
  powerUps: PowerUp[] = [];
  private animationId?: number;
  private lastTime = 0;
  private gameTime = 0;
  private countdownStartTime = 0;
  private lastStuckCheck = 0;
  private stuckStartTime?: number;


  ngOnInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.width = this.BOARD_SIZE;
    this.canvas.height = this.BOARD_SIZE;

    this.initializeHippos();
    this.initializeSpheres();
    this.startCountdown();
    this.startGameLoop();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private startCountdown(): void {
    this.gameState = 'countdown';
    this.countdownStartTime = performance.now();
  }

  private initializeHippos(): void {
    this.hippos = [];

    const hippoConfigs = [
      {
        direction: 'N' as Direction, x: this.CENTER_X, y: this.BOARD_SIZE - this.HIPPO_OFFSET,
        angle: -Math.PI / 2, color: '#8B4513', isPlayer: true
      },
      {
        direction: 'E' as Direction, x: this.HIPPO_OFFSET, y: this.CENTER_Y,
        angle: 0, color: '#9370DB', isPlayer: false
      },
      {
        direction: 'S' as Direction, x: this.CENTER_X, y: this.HIPPO_OFFSET,
        angle: Math.PI / 2, color: '#FF6347', isPlayer: false
      },
      {
        direction: 'W' as Direction, x: this.BOARD_SIZE - this.HIPPO_OFFSET, y: this.CENTER_Y,
        angle: Math.PI, color: '#4169E1', isPlayer: false
      }
    ];

    hippoConfigs.forEach((config, index) => {
      const baseHeadX = config.x + Math.cos(config.angle) * this.HIPPO_HEAD_SIZE;
      const baseHeadY = config.y + Math.sin(config.angle) * this.HIPPO_HEAD_SIZE;

      let personality: AIPersonality = 'player';
      if (!config.isPlayer) {
        personality = this.AI_PERSONALITIES[Math.floor(Math.random() * this.AI_PERSONALITIES.length)];
      }

      this.hippos.push({
        id: index, x: config.x, y: config.y, angle: config.angle, direction: config.direction,
        headX: baseHeadX, headY: baseHeadY, baseHeadX: baseHeadX, baseHeadY: baseHeadY,
        isEating: false, animationProgress: 0, score: 0, color: config.color,
        personality: personality, lastActionTime: 0, nextActionTime: 0, rhythmPhase: 0
      });
    });
  }

  private initializeSpheres(): void {
    const numSpheres = 45; // Increased for more action
    this.spheres = [];

    for (let i = 0; i < numSpheres; i++) {
      let x, y;
      let attempts = 0;

      do {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (this.BOARD_SIZE / 3) + this.BOARD_SIZE / 6;
        x = this.CENTER_X + Math.cos(angle) * distance;
        y = this.CENTER_Y + Math.sin(angle) * distance;
        attempts++;
      } while (this.checkSphereOverlap(x, y) && attempts < 100);

      this.spheres.push({
        id: i, x, y,
        vx: (Math.random() - 0.5) * 3, // Slightly faster initial movement
        vy: (Math.random() - 0.5) * 3,
        radius: this.SPHERE_RADIUS,
        bonus: Math.random() > 0.85, // 15% chance for bonus
        eaten: false,
        lastMovementCheck: performance.now()
      });
    }

    // Initialize power-ups
    this.powerUps = [];
  }

  private checkSphereOverlap(x: number, y: number): boolean {
    for (const sphere of this.spheres) {
      const dx = sphere.x - x;
      const dy = sphere.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < this.SPHERE_DIAMETER) {
        return true;
      }
    }
    return false;
  }

  @HostListener('click', ['$event'])
  onCanvasClick(event: MouseEvent): void {
    if (this.gameState !== 'playing') return;

    const playerHippo = this.hippos.find(h => h.personality === 'player');
    if (playerHippo && !playerHippo.isEating) {
      this.activateHippo(playerHippo);
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.gameState !== 'playing') return;

    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      const playerHippo = this.hippos.find(h => h.personality === 'player');
      if (playerHippo && !playerHippo.isEating) {
        this.activateHippo(playerHippo);
      }
    }
  }

  private activateHippo(hippo: Hippo): void {
    hippo.isEating = true;
    hippo.animationProgress = 0;
  }

  private startGameLoop(): void {
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      if (this.gameState === 'countdown') {
        const elapsed = currentTime - this.countdownStartTime;
        if (elapsed >= this.COUNTDOWN_DURATION) {
          this.gameState = 'playing';
          this.gameTime = 0;
        }
      } else if (this.gameState === 'playing') {
        this.gameTime += deltaTime;
        this.update(deltaTime);
      }

      this.render();

      if (this.gameState !== 'gameover') {
        this.animationId = requestAnimationFrame(gameLoop);
      }
    };

    requestAnimationFrame(gameLoop);
  }

  private update(deltaTime: number): void {

    // Spawn power-ups occasionally
    if (Math.random() < 0.0005 && this.powerUps.length < 2) {
      this.spawnPowerUp();
    }

    // Update AI hippos
    this.updateAI();

    // Update all hippos
    this.hippos.forEach(hippo => {
      // Update power-ups
      if (hippo.powerUpActive && this.gameTime > (hippo.powerUpEndTime || 0)) {
        hippo.powerUpActive = false;
        hippo.powerUpType = undefined;
      }

      if (hippo.isEating) {
        const duration = hippo.powerUpType === 'speed' ? this.ANIMATION_DURATION * 0.7 : this.ANIMATION_DURATION;
        hippo.animationProgress += deltaTime / duration;

        if (hippo.animationProgress >= 1) {
          hippo.isEating = false;
          hippo.animationProgress = 0;
          hippo.headX = hippo.baseHeadX;
          hippo.headY = hippo.baseHeadY;
        } else {
          const range = hippo.powerUpType === 'range' ? 1.5 : 1.1;
          const extension = Math.sin(hippo.animationProgress * Math.PI) * this.HIPPO_HEAD_SIZE * range;
          hippo.headX = hippo.x + Math.cos(hippo.angle) * (this.HIPPO_HEAD_SIZE + extension);
          hippo.headY = hippo.y + Math.sin(hippo.angle) * (this.HIPPO_HEAD_SIZE + extension);

          if (hippo.animationProgress > 0.4 && hippo.animationProgress < 0.6) {
            this.checkEating(hippo);
            this.checkPowerUpCollection(hippo);
          }
        }
      }
    });

    // Update spheres
    for (const sphere of this.spheres) {
      if (sphere.eaten) continue;

      // Apply center attraction
      const dx = this.CENTER_X - sphere.x;
      const dy = this.CENTER_Y - sphere.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const fx = (dx / distance) * this.ATTRACTION_FORCE;
        const fy = (dy / distance) * this.ATTRACTION_FORCE;
        sphere.vx += fx;
        sphere.vy += fy;
      }

      sphere.vx *= this.DAMPING;
      sphere.vy *= this.DAMPING;
      sphere.x += sphere.vx;
      sphere.y += sphere.vy;

      // Boundary collision with more bounce
      if (sphere.x - sphere.radius < 0 || sphere.x + sphere.radius > this.BOARD_SIZE) {
        sphere.vx = -sphere.vx * 0.9;
        sphere.x = Math.max(sphere.radius, Math.min(this.BOARD_SIZE - sphere.radius, sphere.x));
      }
      if (sphere.y - sphere.radius < 0 || sphere.y + sphere.radius > this.BOARD_SIZE) {
        sphere.vy = -sphere.vy * 0.9;
        sphere.y = Math.max(sphere.radius, Math.min(this.BOARD_SIZE - sphere.radius, sphere.y));
      }

      // Sphere collision logic (same as before)
      for (const other of this.spheres) {
        if (other.id !== sphere.id && !other.eaten) {
          const dx = other.x - sphere.x;
          const dy = other.y - sphere.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < this.SPHERE_DIAMETER) {
            const overlap = this.SPHERE_DIAMETER - distance;
            const separationX = (dx / distance) * overlap * 0.5;
            const separationY = (dy / distance) * overlap * 0.5;

            sphere.x -= separationX;
            sphere.y -= separationY;
            other.x += separationX;
            other.y += separationY;

            const tempVx = sphere.vx;
            const tempVy = sphere.vy;
            sphere.vx = other.vx * 0.8;
            sphere.vy = other.vy * 0.8;
            other.vx = tempVx * 0.8;
            other.vy = tempVy * 0.8;
          }
        }
      }
    }

    // Check for stuck balls
    this.checkStuckBalls();

    // Check game over
    if (this.spheres.every(s => s.eaten)) {
      this.gameState = 'gameover';
    }
  }

  private checkStuckBalls(): void {
    if (this.gameTime - this.lastStuckCheck < this.STUCK_CHECK_INTERVAL) return;

    this.lastStuckCheck = this.gameTime;
    const activeSpheres = this.spheres.filter(s => !s.eaten);

    if (activeSpheres.length === 0) return;

    const allStuck = activeSpheres.every(sphere => {
      const velocity = Math.sqrt(sphere.vx * sphere.vx + sphere.vy * sphere.vy);
      return velocity < this.STUCK_VELOCITY_THRESHOLD;
    });

    if (allStuck) {
      if (!this.stuckStartTime) {
        this.stuckStartTime = this.gameTime;
      } else if (this.gameTime - this.stuckStartTime > this.STUCK_TIME_LIMIT) {
        // Apply a "shake" to unstuck the balls
        this.unstuckBalls();
        this.stuckStartTime = undefined;
      }
    } else {
      this.stuckStartTime = undefined;
    }
  }

  private unstuckBalls(): void {
    this.spheres.forEach(sphere => {
      if (!sphere.eaten) {
        // Add random velocity to unstuck balls
        const angle = Math.random() * Math.PI * 2;
        const force = 2 + Math.random() * 3;
        sphere.vx += Math.cos(angle) * force;
        sphere.vy += Math.sin(angle) * force;
      }
    });
  }

  private spawnPowerUp(): void {
    const types: Array<'speed' | 'range' | 'stun'> = ['speed', 'range', 'stun'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Spawn away from center
    const angle = Math.random() * Math.PI * 2;
    const distance = this.BOARD_SIZE / 4 + Math.random() * this.BOARD_SIZE / 6;

    this.powerUps.push({
      id: Date.now(),
      x: this.CENTER_X + Math.cos(angle) * distance,
      y: this.CENTER_Y + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      radius: 15,
      bonus: false,
      eaten: false,
      type: type,
      collected: false,
      spawnTime: this.gameTime
    });

    this.spheres.push(this.powerUps[this.powerUps.length - 1]);

  }

  private checkPowerUpCollection(hippo: Hippo): void {
    const hitBox = {
      x: hippo.headX - this.HIPPO_HEAD_SIZE / 2,
      y: hippo.headY - this.HIPPO_HEAD_SIZE / 2,
      width: this.HIPPO_HEAD_SIZE,
      height: this.HIPPO_HEAD_SIZE
    };

    for (const powerUp of this.powerUps) {
      if (powerUp.collected) continue;

      if (powerUp.x >= hitBox.x && powerUp.x <= hitBox.x + hitBox.width &&
          powerUp.y >= hitBox.y && powerUp.y <= hitBox.y + hitBox.height) {
        powerUp.collected = true;
        hippo.powerUpActive = true;
        hippo.powerUpType = powerUp.type;
        hippo.powerUpEndTime = this.gameTime + 5000; // 5 second duration

        // Apply stun effect to other hippos
        if (powerUp.type === 'stun') {
          this.hippos.forEach(h => {
            if (h.id !== hippo.id && h.isEating) {
              h.isEating = false;
              h.animationProgress = 0;
              h.headX = h.baseHeadX;
              h.headY = h.baseHeadY;
              h.lastActionTime = this.gameTime + 1000; // Delay next action
            }
          });
        }
      }
    }
  }

  // Previous AI and eating logic remains the same...
  private updateAI(): void {
    this.hippos.forEach(hippo => {
      if (hippo.personality === 'player' || hippo.isEating) return;

      switch (hippo.personality) {
        case 'sniper':
          this.updateSniperAI(hippo);
          break;
        case 'masher':
          this.updateMasherAI(hippo);
          break;
        case 'rando':
          this.updateRandoAI(hippo);
          break;
        case 'rhythm':
          this.updateRhythmAI(hippo);
          break;
      }
    });
  }

  private updateSniperAI(hippo: Hippo): void {
    const strikeRange = this.SNIPER_DETECTION_RANGE;
    const futureHeadX = hippo.x + Math.cos(hippo.angle) * (this.HIPPO_HEAD_SIZE + strikeRange);
    const futureHeadY = hippo.y + Math.sin(hippo.angle) * (this.HIPPO_HEAD_SIZE + strikeRange);

    for (const sphere of this.spheres) {
      if (sphere.eaten) continue;

      const dx = sphere.x - futureHeadX;
      const dy = sphere.y - futureHeadY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocityTowardsHippo = -(sphere.vx * Math.cos(hippo.angle) + sphere.vy * Math.sin(hippo.angle));

      if (distance < this.HIPPO_HEAD_SIZE / 2 && velocityTowardsHippo > -0.5) {
        if (this.gameTime - (hippo.lastActionTime || 0) > 500) {
          this.activateHippo(hippo);
          hippo.lastActionTime = this.gameTime;
        }
        break;
      }
    }
  }

  private updateMasherAI(hippo: Hippo): void {
    const interval = hippo.powerUpType === 'speed' ? this.MASHER_INTERVAL * 0.7 : this.MASHER_INTERVAL;
    if (this.gameTime - (hippo.lastActionTime || 0) > interval) {
      this.activateHippo(hippo);
      hippo.lastActionTime = this.gameTime;
    }
  }

  private updateRandoAI(hippo: Hippo): void {
    if (this.gameTime > (hippo.nextActionTime || 0)) {
      this.activateHippo(hippo);
      hippo.nextActionTime = this.gameTime +
        this.RANDO_MIN_INTERVAL + Math.random() * (this.RANDO_MAX_INTERVAL - this.RANDO_MIN_INTERVAL);
    }
  }

  private updateRhythmAI(hippo: Hippo): void {
    const pattern = this.RHYTHM_PATTERN;
    const currentPhase = hippo.rhythmPhase || 0;

    if (this.gameTime - (hippo.lastActionTime || 0) > pattern[currentPhase]) {
      this.activateHippo(hippo);
      hippo.lastActionTime = this.gameTime;
      hippo.rhythmPhase = (currentPhase + 1) % pattern.length;
    }
  }

  private checkEating(hippo: Hippo): void {
    const baseSize = this.HIPPO_HEAD_SIZE;
    const size = hippo.powerUpType === 'range' ? baseSize * 1.3 : baseSize;

    const hitBox: HitBox = {
      x: hippo.headX - size / 2,
      y: hippo.headY - size / 2,
      width: size,
      height: size
    };

    for (const sphere of this.spheres) {
      if (sphere.eaten) continue;

      const centerInHitBox =
        sphere.x >= hitBox.x &&
        sphere.x <= hitBox.x + hitBox.width &&
        sphere.y >= hitBox.y &&
        sphere.y <= hitBox.y + hitBox.height;

      if (centerInHitBox) {
        sphere.eaten = true;
        sphere.eatenBy = hippo.id;
        if (sphere.bonus) {
          hippo.score += 3;
        } else {
          hippo.score += 1;
        }
      } else {
        const closestX = Math.max(hitBox.x, Math.min(sphere.x, hitBox.x + hitBox.width));
        const closestY = Math.max(hitBox.y, Math.min(sphere.y, hitBox.y + hitBox.height));
        const dx = sphere.x - closestX;
        const dy = sphere.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < sphere.radius) {
          const repulsionAngle = Math.atan2(dy, dx);
          sphere.vx += Math.cos(repulsionAngle) * this.REPULSION_FORCE;
          sphere.vy += Math.sin(repulsionAngle) * this.REPULSION_FORCE;
        }
      }
    }
  }

  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(0, 0, this.BOARD_SIZE, this.BOARD_SIZE);

    // Draw board
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(0, 0, this.BOARD_SIZE, this.BOARD_SIZE);

    // Draw center
    this.ctx.fillStyle = '#666';
    this.ctx.beginPath();
    this.ctx.arc(this.CENTER_X, this.CENTER_Y, 20, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw spheres
    for (const sphere of this.spheres) {
      if (!sphere.eaten) {
        this.ctx.fillStyle = sphere.bonus ? '#DDDD11' : '#DDDDDD';
        this.ctx.beginPath();
        this.ctx.arc(sphere.x, sphere.y, sphere.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    }

    // Draw power-ups
    for (const powerUp of this.powerUps) {
      if (powerUp.collected) continue;

      this.ctx.fillStyle = powerUp.type === 'speed' ? '#00FF00' :
                          powerUp.type === 'range' ? '#FF00FF' : '#FF0000';
      this.ctx.beginPath();
      this.ctx.arc(powerUp.x, powerUp.y, 15, 0, Math.PI * 2);
      this.ctx.fill();

      // Pulsing effect
      const pulse = Math.sin((this.gameTime - powerUp.spawnTime) / 200) * 0.3 + 0.7;
      this.ctx.strokeStyle = powerUp.type === 'speed' ? '#00AA00' :
                            powerUp.type === 'range' ? '#AA00AA' : '#AA0000';
      this.ctx.lineWidth = 3 * pulse;
      this.ctx.stroke();
    }

    // Draw hippos
    this.hippos.forEach(hippo => this.drawHippo(hippo));

    // Draw scores
    if (this.gameState !== 'countdown') {
      this.drawScores();
    }

    // Draw countdown
    if (this.gameState === 'countdown') {
      const elapsed = performance.now() - this.countdownStartTime;
      const remaining = Math.ceil((this.COUNTDOWN_DURATION - elapsed) / 1000);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.BOARD_SIZE, this.BOARD_SIZE);

      this.ctx.fillStyle = '#fff';
      this.ctx.font = '72px Arial';
      this.ctx.textAlign = 'center';

      if (remaining > 0) {
        this.ctx.fillText(remaining.toString(), this.CENTER_X, this.CENTER_Y);
      } else {
        this.ctx.fillText('GO!', this.CENTER_X, this.CENTER_Y);
      }

      this.ctx.font = '24px Arial';
      this.ctx.fillText('Get ready!', this.CENTER_X, this.CENTER_Y - 100);
    }

    // Draw game over
    if (this.gameState === 'gameover') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.BOARD_SIZE, this.BOARD_SIZE);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Game Over!', this.CENTER_X, this.CENTER_Y - 60);

      const winner = this.hippos.reduce((prev, curr) => prev.score > curr.score ? prev : curr);
      const winnerName = winner.personality === 'player' ? 'You' :
        `${winner.personality.charAt(0).toUpperCase() + winner.personality.slice(1)} (${winner.direction})`;
      this.ctx.font = '32px Arial';
      this.ctx.fillText(`Winner: ${winnerName}`, this.CENTER_X, this.CENTER_Y);
      this.ctx.fillText(`Score: ${winner.score}`, this.CENTER_X, this.CENTER_Y + 40);
    }

    // Show stuck warning
    if (this.stuckStartTime && this.gameTime - this.stuckStartTime > 5000) {
      this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Balls stuck! Shaking in 3 seconds...', this.CENTER_X, 50);
    }
  }

  private drawHippo(hippo: Hippo): void {
    this.ctx.save();

    // Power-up glow effect
    if (hippo.powerUpActive) {
      this.ctx.shadowColor = hippo.powerUpType === 'speed' ? '#00FF00' :
                            hippo.powerUpType === 'range' ? '#FF00FF' : '#FF0000';
      this.ctx.shadowBlur = 20;
    }

    // Draw body
    this.ctx.fillStyle = hippo.color;
    this.ctx.beginPath();

    const bodyWidth = this.HIPPO_SIZE / 2;
    const bodyHeight = this.HIPPO_SIZE * 2 / 3;

    this.ctx.translate(hippo.x, hippo.y);
    this.ctx.rotate(hippo.angle + Math.PI / 2);
    this.ctx.ellipse(0, bodyHeight / 3, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // Draw head
    const headColor = this.adjustColor(hippo.color, 20);
    this.ctx.fillStyle = headColor;
    this.ctx.save();

    if (hippo.powerUpActive) {
      this.ctx.shadowColor = hippo.powerUpType === 'speed' ? '#00FF00' :
                            hippo.powerUpType === 'range' ? '#FF00FF' : '#FF0000';
      this.ctx.shadowBlur = 15;
    }

    this.ctx.translate(hippo.headX, hippo.headY);
    this.ctx.rotate(hippo.angle);
    this.ctx.fillRect(-this.HIPPO_HEAD_SIZE * 3 / 4, -this.HIPPO_HEAD_SIZE / 2,
                     this.HIPPO_HEAD_SIZE * 3 / 2, this.HIPPO_HEAD_SIZE );
    this.ctx.restore();

    // Draw mouth
    if (hippo.isEating && hippo.animationProgress > 0.3 && hippo.animationProgress < 0.7) {
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 2;
      this.ctx.save();
      this.ctx.translate(hippo.headX, hippo.headY);
      this.ctx.rotate(hippo.angle);
      const size = hippo.powerUpType === 'range' ? this.HIPPO_HEAD_SIZE * 1.3 : this.HIPPO_HEAD_SIZE;
      this.ctx.strokeRect(-size / 2, -size / 2, size, size);
      this.ctx.restore();
    }

    // Draw personality label
    if (hippo.personality !== 'player') {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      const labelX = hippo.x - Math.cos(hippo.angle) * 40;
      const labelY = hippo.y - Math.sin(hippo.angle) * 40;
      this.ctx.fillText(hippo.personality.toUpperCase(), labelX, labelY);
    }

    // Power-up indicator
    if (hippo.powerUpActive && hippo.powerUpType) {
      this.ctx.fillStyle = hippo.powerUpType === 'speed' ? '#00FF00' :
                          hippo.powerUpType === 'range' ? '#FF00FF' : '#FF0000';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.textAlign = 'center';
      const iconX = hippo.x + Math.cos(hippo.angle + Math.PI/2) * 30;
      const iconY = hippo.y + Math.sin(hippo.angle + Math.PI/2) * 30;
      const icon = hippo.powerUpType === 'speed' ? '⚡' :
                   hippo.powerUpType === 'range' ? '↔' : '💥';
      this.ctx.fillText(icon, iconX, iconY);
    }
  }

  private adjustColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  private drawScores(): void {
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'left';

    const positions = [
      { x: 10, y: this.BOARD_SIZE - 10, align: 'left' },
      { x: 10, y: 30, align: 'left' },
      { x: this.BOARD_SIZE - 10, y: 30, align: 'right' },
      { x: this.BOARD_SIZE - 10, y: this.BOARD_SIZE - 10, align: 'right' }
    ];

    this.hippos.forEach((hippo, index) => {
      const pos = positions[index];
      this.ctx.textAlign = pos.align as CanvasTextAlign;
      this.ctx.fillStyle = hippo.color;
      const label = hippo.personality === 'player' ? 'You' : hippo.direction;
      this.ctx.fillText(`${label}: ${hippo.score}`, pos.x, pos.y);
    });
  }

  restart(): void {
    this.gameState = 'countdown';
    this.gameTime = 0;
    this.stuckStartTime = undefined;
    this.countdownStartTime = performance.now();
    this.powerUps = [];

    this.hippos.forEach(hippo => {
      hippo.score = 0;
      hippo.isEating = false;
      hippo.animationProgress = 0;
      hippo.headX = hippo.baseHeadX;
      hippo.headY = hippo.baseHeadY;
      hippo.lastActionTime = 0;
      hippo.nextActionTime = 0;
      hippo.rhythmPhase = 0;
      hippo.powerUpActive = false;
      hippo.powerUpType = undefined;

      if (hippo.personality !== 'player') {
        hippo.personality = this.AI_PERSONALITIES[Math.floor(Math.random() * this.AI_PERSONALITIES.length)];
      }
    });
    this.initializeSpheres();
    this.startGameLoop();
  }

  getPlayerScore(): number {
    const player = this.hippos.find(h => h.personality === 'player');
    return player ? player.score : 0;
  }

  getWinner(): string {
    if (this.gameState !== 'gameover') return '';
    const winner = this.hippos.reduce((prev, curr) => prev.score > curr.score ? prev : curr);
    return winner.personality === 'player' ? 'You' :
      `${winner.personality.charAt(0).toUpperCase() + winner.personality.slice(1)} (${winner.direction})`;
  }

  isGameActive(): boolean {
    return this.gameState === 'playing';
  }
}
