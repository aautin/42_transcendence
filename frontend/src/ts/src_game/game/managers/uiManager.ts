import { GameConfig, PowerUpTypes } from '../../../shared/config/gameConfig.js';

export class UIManager {
	private lastBlink: number = 0;
	private showStartMessage: boolean = true;
	private readonly BLINK_INTERVAL: number = GameConfig.BLINK_INTERVAL;
	private activePowerupsByType: Map<string, Map<number, { id: number, expiresAt: number }>> = new Map();
	private powerupIcons: Map<string, { emoji: string, label: string }> = new Map();

	constructor(
		private context: CanvasRenderingContext2D,
		private canvas: HTMLCanvasElement,
		private powerUpsEnabled: boolean,
	) {
		if (this.powerUpsEnabled)
			this.initializePowerupIcons();
	}

	private initializePowerupIcons(): void {
		this.powerupIcons.set(PowerUpTypes.PADDLE_GROW, {
			emoji: "🍄",
			label: "Paddle Grow"
		});
		this.powerupIcons.set(PowerUpTypes.PADDLE_SHRINK, {
			emoji: "🪓",
			label: "Paddle Shrink"
		});
		this.powerupIcons.set(PowerUpTypes.BALL_GROW, {
			emoji: "🍉",
			label: "Ball Grow"
		});
		this.powerupIcons.set(PowerUpTypes.BALL_SHRINK, {
			emoji: "🫐",
			label: "Ball Shrink"
		});
		this.powerupIcons.set(PowerUpTypes.PADDLE_SLOW, {
			emoji: "🐢",
			label: "Paddle Slow"
		});
	}

	public showTournamentInfo(round: string, players: string[]) {
		const container = document.getElementById("tournament-info");
		if (container) {
			container.innerHTML = `
                <div class="tournament-info-title">Tournament ${round.charAt(0).toUpperCase() + round.slice(1)}</div>
                <div class="tournament-info-players">${players.join(" vs ")}</div>
            `;
			container.style.display = "block";
			setTimeout(() => { container.style.display = "none"; }, 5000);
		}
	}

	drawStartMessage(timestamp: number, gameStarted: boolean, playerNumber: number, servingPlayer: number): void {
		if (!gameStarted) {
			if (timestamp - this.lastBlink > this.BLINK_INTERVAL) {
				this.showStartMessage = !this.showStartMessage;
				this.lastBlink = timestamp;
			}
			if (this.showStartMessage) {
				if (servingPlayer === playerNumber) {
					this.context.fillStyle = "white";
					this.context.font = "20px Arial";
					this.context.textAlign = "center";
					this.context.fillText("Press Space to Start", this.canvas.width / 2, (this.canvas.height / 2) - 50);
				} else {
					this.drawWaitingMessage('Waiting for the other Player to start...');
				}
			}
		}
	}

	drawErrorMessage(message: string): void {
		this.context.fillStyle = "red";
		this.context.font = "20px Arial";
		this.context.textAlign = "center";
		this.context.fillText(message, this.canvas.width / 2, (this.canvas.height / 2) + 50);
	}

	drawWaitingMessage(message: string): void {
		this.context.fillStyle = "white";
		this.context.font = "20px Arial";
		this.context.textAlign = "center";
		this.context.fillText(message, this.canvas.width / 2, (this.canvas.height / 2) + 50);
	}

	drawDisconnectionMessage(message: string, isWinner: boolean): void {
		this.context.save();
		this.context.fillStyle = 'rgba(0, 0, 0, 0.7)';
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.context.font = '24px Arial';
		this.context.textAlign = 'center';

		if (isWinner) {
			this.context.fillStyle = '#4CAF50';  // Green for winner
			this.context.fillText(message, this.canvas.width / 2, this.canvas.height / 2 - 50);
			this.context.fillText('You win by forfeit!', this.canvas.width / 2, this.canvas.height / 2);
		} else {
			this.context.fillStyle = '#F44336';  // Red for loser
			this.context.fillText(message, this.canvas.width / 2, this.canvas.height / 2 - 50);
			this.context.fillText('You lost the connection', this.canvas.width / 2, this.canvas.height / 2);
		}

		this.context.font = '16px Arial';
		this.context.fillStyle = 'white';
		this.context.fillText('Returning to lobby...', this.canvas.width / 2, this.canvas.height / 2 + 50);
		this.context.restore();
	}


	clearOverlay(): void {
		const gameOverMenu = document.getElementById('game-over-menu');
		if (gameOverMenu) {
			gameOverMenu.remove();
		}
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	public addActivePowerup(powerupId: number, type: string, player: number): void {
		console.log(`Adding powerup ${powerupId} of type ${type} for player ${player}`);
		if (!this.activePowerupsByType.has(type)) {
			this.activePowerupsByType.set(type, new Map());
		}

		const playerPowerups = this.activePowerupsByType.get(type)!;

		if (playerPowerups.has(player)) {
			playerPowerups.get(player)!.expiresAt = Date.now() + GameConfig.POWERUP_DURATION;
		} else {
			playerPowerups.set(player, {
				id: powerupId,
				expiresAt: Date.now() + GameConfig.POWERUP_DURATION
			});
		}
	}

	public removeActivePowerup(powerupId: number): void {
		this.activePowerupsByType.forEach((playerMap, type) => {
			playerMap.forEach((powerup, player) => {
				if (powerup.id === powerupId) {
					playerMap.delete(player);
					if (playerMap.size === 0) {
						this.activePowerupsByType.delete(type);
					}
				}
			});
		});
	}

	public drawPowerupStatus(): void {
		this.context.save();

		// Legend background
		const legendHeight = 80;
		const legendY = this.canvas.height - legendHeight;
		this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
		this.context.fillRect(0, legendY, this.canvas.width, legendHeight);

		this.context.fillStyle = 'white';
		this.context.font = '12px Arial';
		this.context.textAlign = 'center';

		// Draw powerup icons
		const iconSize = 32;
		const padding = 20;
		const itemWidth = iconSize + padding * 2;
		const startX = (this.canvas.width - (this.powerupIcons.size * itemWidth)) / 2;

		let i = 0;
		this.powerupIcons.forEach((iconInfo, type) => {
			const iconX = startX + (i * itemWidth) + padding;
			const iconY = legendY + 28;

			// Draw icon
			this.context.font = '24px Arial';
			this.context.textAlign = 'center';
			this.context.fillText(iconInfo.emoji, iconX + iconSize / 2, iconY);

			// Draw label
			this.context.font = '10px Arial';
			this.context.fillText(iconInfo.label, iconX + iconSize / 2, iconY + 16);

			// Draw player timers if active
			const playerPowerups = this.activePowerupsByType.get(type);
			if (playerPowerups) {
				let j = 0;
				playerPowerups.forEach((powerup, player) => {
					// Calculate time left
					const timeLeft = Math.max(0, (powerup.expiresAt - Date.now()) / 1000);

					if (timeLeft <= 0) {
						// Schedule for removal
						setTimeout(() => this.removeActivePowerup(powerup.id), 0);
						return;
					}

					// Draw player indicator and timer
					const timerX = iconX + iconSize / 2;
					const timerY = iconY + 40 + j * 12;

					// Player indicator with color
					this.context.fillStyle = player === 1 ? '#4CAF50' : '#F44336';
					this.context.fillText(`P${player}: ${timeLeft.toFixed(1)}s`, timerX, timerY);
					this.context.fillStyle = 'white';

					j++;
				});
			}

			i++;
		});

		this.context.restore();
	}
}
