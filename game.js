import { MAZE, MAP_DIMENSIONS, getTile } from './maze.js';
import { Muncher, Ghost, DIRECTIONS } from './entities.js';
import { audio } from './audio.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 160;
        this.canvas.height = 192;
        
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('retroMuncherHighScore')) || 0;
        this.lives = 3;
        this.state = 'INIT'; // INIT, PLAYING, FRIGHTENED, DEATH, GAMEOVER
        this.levelPellets = 0;
        
        this.muncher = new Muncher(10, 15);
        this.ghosts = [
            new Ghost(9, 9, "#ff0000", 'chaser'),
            new Ghost(10, 9, "#ffb8de", 'ambusher'),
            new Ghost(9, 10, "#00ffff", 'random'),
            new Ghost(10, 10, "#ffb847", 'timid')
        ];

        this.maze = JSON.parse(JSON.stringify(MAZE)); // Mutable copy for pellets
        this.initUI();
        this.bindEvents();
        this.loop();
    }

    initUI() {
        document.getElementById('high-score').innerText = this.highScore.toString().padStart(6, '0');
        this.countPellets();
    }

    countPellets() {
        this.levelPellets = 0;
        for (let r = 0; r < this.maze.length; r++) {
            for (let c = 0; c < this.maze[r].length; c++) {
                if (this.maze[r][c] === 2 || this.maze[r][c] === 3) this.levelPellets++;
            }
        }
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.state === 'INIT' || this.state === 'GAMEOVER') {
                if (e.key === 'Enter' || e.code === 'Enter') {
                    console.log("Game Start Triggered");
                    this.start();
                }
                return;
            }

            switch(e.key.toLowerCase()) {
                case 'arrowup': case 'w': this.muncher.nextDir = DIRECTIONS.UP; break;
                case 'arrowdown': case 's': this.muncher.nextDir = DIRECTIONS.DOWN; break;
                case 'arrowleft': case 'a': this.muncher.nextDir = DIRECTIONS.LEFT; break;
                case 'arrowright': case 'd': this.muncher.nextDir = DIRECTIONS.RIGHT; break;
            }
        });
    }

    start() {
        audio.init();
        this.state = 'PLAYING';
        document.getElementById('overlay-screen').style.display = 'none';
        if (this.score === 0) this.resetLevel();
    }

    resetLevel() {
        this.maze = JSON.parse(JSON.stringify(MAZE));
        this.countPellets();
        this.muncher = new Muncher(10, 15);
        this.ghosts.forEach((g, i) => {
             g.x = g.home.col * 8;
             g.y = g.home.row * 8;
             g.state = 'CHASE';
        });
    }

    update() {
        if (this.state !== 'PLAYING' && this.state !== 'FRIGHTENED') return;

        this.muncher.update();
        
        // Pellet Collision
        const tile = this.muncher.getTilePos();
        if (this.maze[tile.row] && this.maze[tile.row][tile.col] !== undefined) {
            const currentTileValue = this.maze[tile.row][tile.col];
            
            if (currentTileValue === 2) { // Small pellet
                this.maze[tile.row][tile.col] = 0;
                this.updateScore(10);
                this.levelPellets--;
                audio.playWaka();
            } else if (currentTileValue === 3) { // Power pellet
                this.maze[tile.row][tile.col] = 0;
                this.updateScore(50);
                this.levelPellets--;
                this.setFrightened(7000); // 7 seconds
                audio.playWaka();
            }
        }

        // Ghost Collision
        this.ghosts.forEach(ghost => {
            ghost.update(this.muncher);
            
            const dist = Math.sqrt((this.muncher.x - ghost.x)**2 + (this.muncher.y - ghost.y)**2);
            if (dist < 6) {
                if (ghost.state === 'FRIGHTENED') {
                    this.updateScore(200);
                    ghost.x = ghost.home.col * 8;
                    ghost.y = ghost.home.row * 8;
                    ghost.state = 'CHASE';
                } else {
                    this.die();
                }
            }
        });

        if (this.levelPellets <= 0) this.resetLevel();
    }

    setFrightened(duration) {
        this.state = 'FRIGHTENED';
        this.ghosts.forEach(g => g.state = 'FRIGHTENED');
        clearTimeout(this.frightenedTimeout);
        this.frightenedTimeout = setTimeout(() => {
            this.state = 'PLAYING';
            this.ghosts.forEach(g => g.state = 'CHASE');
        }, duration);
    }

    updateScore(points) {
        this.score += points;
        document.getElementById('score').innerText = this.score.toString().padStart(6, '0');
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('retroMuncherHighScore', this.highScore);
            document.getElementById('high-score').innerText = this.highScore.toString().padStart(6, '0');
        }
    }

    die() {
        this.lives--;
        this.state = 'DEATH';
        audio.playDeath();
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            setTimeout(() => {
                this.muncher.x = 10 * 8;
                this.muncher.y = 15 * 8;
                this.muncher.dir = DIRECTIONS.RIGHT;
                this.ghosts.forEach(g => {
                    g.x = g.home.col * 8;
                    g.y = g.home.row * 8;
                });
                this.state = 'PLAYING';
            }, 2000);
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        document.getElementById('overlay-screen').style.display = 'flex';
        document.getElementById('status-message').innerText = 'GAME OVER';
        document.getElementById('title-screen-content').style.display = 'flex'; // Ensure content visible
        this.lives = 3;
        setTimeout(() => {
            document.getElementById('status-message').innerText = 'PRESS ENTER TO START';
            this.score = 0;
            document.getElementById('score').innerText = '000000';
            this.resetLevel();
        }, 3000);
    }

    draw() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Maze
        for (let r = 0; r < this.maze.length; r++) {
            for (let c = 0; c < this.maze[r].length; c++) {
                const tile = this.maze[r][c];
                const x = c * 8;
                const y = r * 8;

                if (tile === 1) { // Wall
                    this.ctx.fillStyle = "#4444ff";
                    this.ctx.fillRect(x, y, 8, 8);
                    this.ctx.strokeStyle = "#000";
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeRect(x, y, 8, 8);
                } else if (tile === 2) { // Pellet
                    this.ctx.fillStyle = "#ffb8ae";
                    this.ctx.fillRect(x + 3.5, y + 3.5, 1, 1);
                } else if (tile === 3) { // Power Pellet
                    this.ctx.fillStyle = "#ffb8ae";
                    this.ctx.beginPath();
                    this.ctx.arc(x + 4, y + 4, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                } else if (tile === 4) { // Gate
                    this.ctx.fillStyle = "#ffb8de";
                    this.ctx.fillRect(x, y + 3, 8, 2);
                }
            }
        }

        this.muncher.draw(this.ctx);
        this.ghosts.forEach(g => g.draw(this.ctx));
        
        if (this.state === 'FRIGHTENED') {
            audio.playFrightened();
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

new Game();
