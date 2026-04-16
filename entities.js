import { isWall, isGate, MAP_DIMENSIONS } from './maze.js';

const DIRECTIONS = {
    UP: { x: 0, y: -1, angle: Math.PI * 1.5 },
    DOWN: { x: 0, y: 1, angle: Math.PI * 0.5 },
    LEFT: { x: -1, y: 0, angle: Math.PI },
    RIGHT: { x: 1, y: 0, angle: 0 }
};

class Entity {
    constructor(x, y, speed) {
        this.baseX = x; // Grid X
        this.baseY = y; // Grid Y
        this.x = x * MAP_DIMENSIONS.tileSize;
        this.y = y * MAP_DIMENSIONS.tileSize;
        this.speed = speed;
        this.dir = DIRECTIONS.RIGHT;
        this.nextDir = null;
        this.radius = 3.5;
    }

    getTilePos() {
        return {
            col: Math.floor((this.x + 4) / MAP_DIMENSIONS.tileSize),
            row: Math.floor((this.y + 4) / MAP_DIMENSIONS.tileSize)
        };
    }

    updatePosition() {
        const tile = this.getTilePos();
        
        // Handle Wrap-around
        if (this.x < -4) this.x = (MAP_DIMENSIONS.cols * MAP_DIMENSIONS.tileSize) + 4;
        if (this.x > (MAP_DIMENSIONS.cols * MAP_DIMENSIONS.tileSize) + 4) this.x = -4;

        // Try to change direction at center of tile
        const centerX = tile.col * MAP_DIMENSIONS.tileSize;
        const centerY = tile.row * MAP_DIMENSIONS.tileSize;
        const dx = Math.abs(this.x - centerX);
        const dy = Math.abs(this.y - centerY);

        if (this.nextDir && dx < this.speed && dy < this.speed) {
            if (!isWall(tile.col + this.nextDir.x, tile.row + this.nextDir.y)) {
                this.x = centerX;
                this.y = centerY;
                this.dir = this.nextDir;
                this.nextDir = null;
            }
        }

        // Move if no wall
        const nextX = tile.col + this.dir.x;
        const nextY = tile.row + this.dir.y;
        
        if (!isWall(nextX, nextY) || dx > 2 || dy > 2) {
             this.x += this.dir.x * this.speed;
             this.y += this.dir.y * this.speed;
        } else {
            this.x = centerX;
            this.y = centerY;
        }
    }
}

export class Muncher extends Entity {
    constructor(x, y) {
        super(x, y, 0.8); // Speed slightly less than a full pixel for Atari feel
        this.score = 0;
        this.powerTimer = 0;
        this.mouthOpen = 0;
        this.mouthSpeed = 0.15;
    }

    update() {
        this.updatePosition();
        this.mouthOpen += this.mouthSpeed;
        if (this.mouthOpen > 1 || this.mouthOpen < 0) this.mouthSpeed *= -1;
        if (this.powerTimer > 0) this.powerTimer--;
    }

    draw(ctx) {
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        const startAngle = this.dir.angle + (0.2 * this.mouthOpen * Math.PI);
        const endAngle = this.dir.angle + (1.8 * (1 - (0.1 * this.mouthOpen)) * Math.PI);
        
        ctx.moveTo(this.x + 4, this.y + 4);
        ctx.arc(this.x + 4, this.y + 4, this.radius, startAngle, endAngle);
        ctx.fill();
    }
}

export class Ghost extends Entity {
    constructor(x, y, color, type) {
        super(x, y, 0.7);
        this.color = color;
        this.type = type; // 'chaser', 'ambusher', 'random', 'timid'
        this.state = 'CHASE'; // CHASE, SCATTER, FRIGHTENED
        this.home = { col: x, row: y };
        this.frightenedColor = "#2222ff";
    }

    update(muncher) {
        if (this.state === 'FRIGHTENED') {
            this.speed = 0.4;
        } else {
            this.speed = 0.7;
        }

        this.updatePosition();
        this.aiLogic(muncher);
    }

    aiLogic(muncher) {
        const tile = this.getTilePos();
        const dx = Math.abs(this.x - (tile.col * 8));
        const dy = Math.abs(this.y - (tile.row * 8));

        // Decision point: center of tile
        if (dx < this.speed && dy < this.speed) {
            let target = { col: 0, row: 0 };
            
            if (this.state === 'FRIGHTENED') {
                const choices = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
                this.nextDir = choices[Math.floor(Math.random() * choices.length)];
                return;
            }

            // Behavioral Targets
            if (this.type === 'chaser') {
                target = muncher.getTilePos();
            } else if (this.type === 'ambusher') {
                const mTile = muncher.getTilePos();
                target = { col: mTile.col + (muncher.dir.x * 4), row: mTile.row + (muncher.dir.y * 4) };
            } else if (this.type === 'random') {
                const choices = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
                this.nextDir = choices[Math.floor(Math.random() * choices.length)];
                return;
            } else if (this.type === 'timid') {
                const mPos = muncher.getTilePos();
                const dist = Math.sqrt((tile.col - mPos.col)**2 + (tile.row - mPos.row)**2);
                target = dist > 8 ? mPos : { col: 1, row: 22 }; // Top-left corner if near
            }

            // Pathfinding (Simple greedy BFS/Distance)
            const possibleMoves = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT]
                .filter(d => d.x !== -this.dir.x || d.y !== -this.dir.y) // Can't reverse
                .filter(d => !isWall(tile.col + d.x, tile.row + d.y));

            if (possibleMoves.length > 0) {
                possibleMoves.sort((a, b) => {
                    const distA = (tile.col + a.x - target.col)**2 + (tile.row + a.y - target.row)**2;
                    const distB = (tile.col + b.x - target.col)**2 + (tile.row + b.y - target.row)**2;
                    return distA - distB;
                });
                this.nextDir = possibleMoves[0];
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.state === 'FRIGHTENED' ? this.frightenedColor : this.color;
        
        // Body (Circle head + Rect body)
        ctx.beginPath();
        ctx.arc(this.x + 4, this.y + 3, 3.5, Math.PI, 0);
        ctx.lineTo(this.x + 7.5, this.y + 7.5);
        ctx.lineTo(this.x + 0.5, this.y + 7.5);
        ctx.fill();

        // Eyes
        ctx.fillStyle = "white";
        ctx.fillRect(this.x + 2, this.y + 2, 1.5, 1.5);
        ctx.fillRect(this.x + 4.5, this.y + 2, 1.5, 1.5);
    }
}
export { DIRECTIONS };
