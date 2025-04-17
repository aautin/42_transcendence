import { GameConfig } from "../../../../shared/config/gameConfig.js";
export class Ball {
    constructor() {
        this.x = GameConfig.CANVAS_WIDTH / 2;
        this.y = GameConfig.CANVAS_HEIGHT / 2;
        this.radius = GameConfig.DEFAULT_BALL_RADIUS;
        this.speedX = GameConfig.DEFAULT_BALL_SPEED;
        this.speedY = GameConfig.DEFAULT_BALL_SPEED;
    }
    updatePosition(ballState) {
        this.x = ballState.x;
        this.y = ballState.y;
        this.speedX = ballState.speedX;
        this.speedY = ballState.speedY;
    }
}
