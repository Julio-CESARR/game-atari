/**
 * RETRO-MUNCHER CONSOLIDATED ENGINE
 * All-in-one script for local file:// compatibility
 */

// --- MAZE DATA ---
const MAP_DIMENSIONS = { cols: 20, rows: 24, tileSize: 8 };
const MAZE_TEMPLATE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,1,2,2,2,2,2,2,1,2,2,2,2,2,1],
    [1,3,1,1,2,2,1,2,1,1,1,1,2,1,2,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,1,2,2,1,1,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,1,2,2,2,2,1,2,2,2,2,2,2,1],
    [1,1,1,1,2,1,2,1,2,1,1,2,1,2,1,2,1,1,1,1],
    [0,0,0,1,2,1,2,2,2,2,2,2,2,2,1,2,1,0,0,0],
    [1,1,1,1,2,1,2,1,1,4,4,1,1,2,1,2,1,1,1,1],
    [0,0,0,0,2,2,2,1,0,0,0,0,1,2,2,2,0,0,0,0],
    [1,1,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,1,1],
    [1,2,2,2,2,1,2,2,2,2,2,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,1,2,2,2,2,1,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,3,1,2,2,2,2,2,2,2,2,1,3,2,2,2,1],
    [1,1,2,1,1,1,2,1,1,2,2,1,1,2,1,1,1,2,1,1],
    [1,2,2,2,2,2,2,2,1,2,2,1,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,2,2,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const isWall = (col, row, maze) => {
    if (row < 0 || row >= maze.length || col < 0 || col >= maze[0].length) return true;
    return maze[row][col] === 1;
};

// --- AUDIO SYNTH ---
const audio = {
    ctx: null, masterGain: null,
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.1;
    },
    playWaka() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    },
    playDeath() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 1.5);
    },
    playFrightened() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.05);
    }
};

// --- ENTITIES ---
const DIRECTIONS = {
    UP: { x: 0, y: -1, angle: Math.PI * 1.5 },
    DOWN: { x: 0, y: 1, angle: Math.PI * 0.5 },
    LEFT: { x: -1, y: 0, angle: Math.PI },
    RIGHT: { x: 1, y: 0, angle: 0 }
};

class Entity {
    constructor(x, y, speed) {
        this.x = x * 8; this.y = y * 8;
        this.speed = speed;
        this.dir = DIRECTIONS.RIGHT;
        this.nextDir = null;
        this.radius = 3.5;
    }
    getTilePos() {
        return { col: Math.floor((this.x + 4) / 8), row: Math.floor((this.y + 4) / 8) };
    }
    updatePos(maze) {
        const tile = this.getTilePos();
        if (this.x < -4) this.x = 164;
        if (this.x > 164) this.x = -4;

        const centerX = tile.col * 8;
        const centerY = tile.row * 8;
        const dx = Math.abs(this.x - centerX);
        const dy = Math.abs(this.y - centerY);

        if (this.nextDir && dx < this.speed && dy < this.speed) {
            if (!isWall(tile.col + this.nextDir.x, tile.row + this.nextDir.y, maze)) {
                this.x = centerX; this.y = centerY;
                this.dir = this.nextDir; this.nextDir = null;
            }
        }

        if (!isWall(tile.col + this.dir.x, tile.row + this.dir.y, maze) || dx > 2 || dy > 2) {
            this.x += this.dir.x * this.speed;
            this.y += this.dir.y * this.speed;
        } else {
            this.x = centerX; this.y = centerY;
        }
    }
}

class Muncher extends Entity {
    constructor(x, y) {
        super(x, y, 0.8);
        this.mouth = 0; this.mouthSpeed = 0.15;
    }
    update(maze) {
        this.updatePos(maze);
        this.mouth += this.mouthSpeed;
        if (this.mouth > 1 || this.mouth < 0) this.mouthSpeed *= -1;
    }
    draw(ctx) {
        ctx.fillStyle = "#ffff00"; ctx.beginPath();
        const start = this.dir.angle + (0.2 * this.mouth * Math.PI);
        const end = this.dir.angle + (1.8 * (1 - (0.1 * this.mouth)) * Math.PI);
        ctx.moveTo(this.x + 4, this.y + 4);
        ctx.arc(this.x + 4, this.y + 4, this.radius, start, end);
        ctx.fill();
    }
}

class Ghost extends Entity {
    constructor(x, y, color, type) {
        super(x, y, 0.7);
        this.color = color; this.type = type;
        this.state = 'CHASE'; this.home = { col: x, row: y };
    }
    update(muncher, maze) {
        this.speed = (this.state === 'FRIGHTENED') ? 0.4 : 0.7;
        this.updatePos(maze);
        
        const tile = this.getTilePos();
        const dx = Math.abs(this.x - (tile.col * 8));
        const dy = Math.abs(this.y - (tile.row * 8));

        if (dx < this.speed && dy < this.speed) {
            let target = muncher.getTilePos();
            if (this.state === 'FRIGHTENED') {
                const moves = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
                this.nextDir = moves[Math.floor(Math.random() * 4)];
            } else {
                if (this.type === 'ambusher') target = { col: target.col + muncher.dir.x * 4, row: target.row + muncher.dir.y * 4 };
                if (this.type === 'timid') {
                    const dist = Math.sqrt((tile.col - target.col)**2 + (tile.row - target.row)**2);
                    if (dist < 8) target = { col: 1, row: 1 };
                }
                let moves = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT]
                    .filter(d => d.x !== -this.dir.x || d.y !== -this.dir.y)
                    .filter(d => !isWall(tile.col + d.x, tile.row + d.y, maze));
                
                if (moves.length === 0) {
                    // Dead end: Allow reversal
                    moves = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT]
                        .filter(d => !isWall(tile.col + d.x, tile.row + d.y, maze));
                }

                if (moves.length > 0) {
                    moves.sort((a, b) => {
                        const distA = (tile.col + a.x - target.col)**2 + (tile.row + a.y - target.row)**2;
                        const distB = (tile.col + b.x - target.col)**2 + (tile.row + b.y - target.row)**2;
                        return distA - distB;
                    });
                    this.nextDir = moves[0];
                }
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = (this.state === 'FRIGHTENED') ? "#2222ff" : this.color;
        ctx.beginPath(); ctx.arc(this.x + 4, this.y + 3, 3.5, Math.PI, 0);
        ctx.lineTo(this.x + 7.5, this.y + 7.5); ctx.lineTo(this.x + 0.5, this.y + 7.5); ctx.fill();
        ctx.fillStyle = "white"; ctx.fillRect(this.x + 2, this.y + 2, 1.5, 1.5); ctx.fillRect(this.x + 4.5, this.y + 2, 1.5, 1.5);
    }
}

// --- GAME CORE ---
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 160; this.canvas.height = 192;
        this.score = 0; this.lives = 3; this.state = 'INIT';
        this.highScore = parseInt(localStorage.getItem('retroMuncherHighScore')) || 0;
        this.init();
    }
    init() {
        this.maze = JSON.parse(JSON.stringify(MAZE_TEMPLATE));
        this.muncher = new Muncher(10, 15);
        this.ghosts = [
            new Ghost(9, 9, "#ff0000", 'chaser'), new Ghost(10, 9, "#ffb8de", 'ambusher'),
            new Ghost(9, 10, "#00ffff", 'random'), new Ghost(10, 10, "#ffb847", 'timid')
        ];
        document.getElementById('high-score').innerText = this.highScore.toString().padStart(6, '0');
        this.updateLivesUI();
        this.bindEvents();
        this.loop();
    }
    updateLivesUI() {
        const container = document.getElementById('lives-counter');
        container.innerHTML = '';
        for (let i = 0; i < this.lives - 1; i++) {
            const div = document.createElement('div');
            div.className = 'mini-muncher';
            container.appendChild(div);
        }
    }
    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.state === 'INIT' || this.state === 'GAMEOVER') {
                if (e.key === 'Enter') this.start();
            } else {
                if (['ArrowUp', 'w'].includes(e.key)) this.muncher.nextDir = DIRECTIONS.UP;
                if (['ArrowDown', 's'].includes(e.key)) this.muncher.nextDir = DIRECTIONS.DOWN;
                if (['ArrowLeft', 'a'].includes(e.key)) this.muncher.nextDir = DIRECTIONS.LEFT;
                if (['ArrowRight', 'd'].includes(e.key)) this.muncher.nextDir = DIRECTIONS.RIGHT;
            }
        });
        document.getElementById('overlay-screen').addEventListener('click', () => {
            if (this.state === 'INIT' || this.state === 'GAMEOVER') this.start();
        });
    }
    start() {
        audio.init(); this.state = 'PLAYING';
        document.getElementById('overlay-screen').style.display = 'none';
    }
    update() {
        if (this.state !== 'PLAYING' && this.state !== 'FRIGHTENED') return;
        this.muncher.update(this.maze);
        const t = this.muncher.getTilePos();
        if (this.maze[t.row] && this.maze[t.row][t.col]) {
            const v = this.maze[t.row][t.col];
            if (v === 2 || v === 3) {
                this.maze[t.row][t.col] = 0; this.score += (v === 3 ? 50 : 10);
                if (v === 3) this.setFrightened();
                audio.playWaka();
                document.getElementById('score').innerText = this.score.toString().padStart(6, '0');
            }
        }
        this.ghosts.forEach(g => {
            g.update(this.muncher, this.maze);
            const d = Math.sqrt((this.muncher.x - g.x)**2 + (this.muncher.y - g.y)**2);
            if (d < 6) {
                if (g.state === 'FRIGHTENED') {
                    this.score += 200; g.x = g.home.col * 8; g.y = g.home.row * 8; g.state = 'CHASE';
                } else this.die();
            }
        });
    }
    setFrightened() {
        this.state = 'FRIGHTENED'; this.ghosts.forEach(g => g.state = 'FRIGHTENED');
        clearTimeout(this.ft);
        this.ft = setTimeout(() => { this.state = 'PLAYING'; this.ghosts.forEach(g => g.state = 'CHASE'); }, 7000);
    }
    die() {
        this.lives--; 
        this.updateLivesUI();
        this.state = 'DEATH'; audio.playDeath();
        if (this.lives <= 0) this.gameOver();
        else {
            setTimeout(() => { 
                this.muncher.x = 80; 
                this.muncher.y = 120;
                this.ghosts.forEach(g => {
                    g.x = g.home.col * 8;
                    g.y = g.home.row * 8;
                    g.dir = DIRECTIONS.RIGHT;
                    g.nextDir = null;
                });
                this.state = 'PLAYING'; 
            }, 2000);
        }
    }
    gameOver() {
        this.state = 'GAMEOVER';
        if (this.score > this.highScore) localStorage.setItem('retroMuncherHighScore', this.score);
        document.getElementById('overlay-screen').style.display = 'flex';
        document.getElementById('status-message').innerText = 'GAME OVER';
        setTimeout(() => { location.reload(); }, 3000);
    }
    draw() {
        this.ctx.fillStyle = "black"; this.ctx.fillRect(0, 0, 160, 192);
        for (let r = 0; r < this.maze.length; r++) {
            for (let c = 0; c < this.maze[r].length; c++) {
                const v = this.maze[r][c];
                if (v === 1) { this.ctx.fillStyle = "#4444ff"; this.ctx.fillRect(c*8, r*8, 8, 8); }
                else if (v === 2) { this.ctx.fillStyle = "#ffb8ae"; this.ctx.fillRect(c*8+3, r*8+3, 2, 2); }
                else if (v === 3) { this.ctx.fillStyle = "#ffb8ae"; this.ctx.beginPath(); this.ctx.arc(c*8+4, r*8+4, 3, 0, 7); this.ctx.fill(); }
            }
        }
        this.muncher.draw(this.ctx); this.ghosts.forEach(g => g.draw(this.ctx));
        if (this.state === 'FRIGHTENED') audio.playFrightened();
    }
    loop() { this.update(); this.draw(); requestAnimationFrame(() => this.loop()); }
}

window.onload = () => { new Game(); };
