import { SettingsManager } from '../game/classes/settingsManager.js';
import { setupGameUpdateInterval, handleGameConnection } from '../game/controllers/gameController.js';

export const settingsManagers = new Map();
const gameQueue = [];
let tournamentId = 0;
const tournaments = new Map();
const tournamentQueues = new Map();
const invites = [];

export async function gameRoutes(fastify, options) {
	const { db } = fastify;

	// create a new game
	fastify.post('/game/create', async (request, reply) => { //envoyer les deux joueurs
		const gameId = Math.random().toString(36).substring(2, 8);
		const settingsManager = new SettingsManager();
		settingsManagers.set(gameId, settingsManager);

		reply.send({ gameId });
	});

	// 1v1
	fastify.post('/game/queue', async (request, reply) => {
		const { playerId } = request.body;
		if (!playerId) return reply.code(400).send({ error: 'Player ID is required' });
		gameQueue.push(playerId);
		if (gameQueue.lenght >= 2) {
			const [p1, p2] = gameQueue.splice(0, 2);
			const gameId = Math.random().toString(36).substring(2, 8);
			settingsManagers.set(gameId, new SettingsManager());
			return reply.send({ matched: true, gameId });
		}
		return reply.code(202).send({ queued: true });
	});

	fastify.delete('/game/queue/leave', async (request, reply) => {
		const { playerId } = request.body;
		if (!playerId) return reply.code(400).send({ error: 'Player ID is required' });
		const index = gameQueue.indexOf(playerId);
		if (index !== -1) {
			gameQueue.splice(index, 1);
			return reply.send({ left: true });
		}
		return reply.code(200).send({ notInQueue: true });
	});

	// —— TOURNAMENT ——
	fastify.post('/tournaments', async (request, reply) => {
		const { creatorId, maxPlayers } = request.body;
		if (!creatorId || !maxPlayers) {
			return reply.code(400).send({ error: 'creatorId and maxPlayers required' });
		}
		const tid = tournamentId++;
		tournaments.set(tid, {
			id: tid,
			creatorId,
			maxPlayers,
			players: [],
			bracket: [],
			status: 'waiting'
		});
		return reply.code(201).send({ tournamentId: tid });
	});

	fastify.post('/tournaments/:tournamentId/join', async (request, reply) => {
		const tid = Number(request.params.tournamentId);
		const { playerId } = request.body;
		const tour = tournaments.get(tid);
		if (!tour) {
			return reply.code(404).send({ error: 'Tournament not found' });
		}

		// pull or init queue
		let queue = tournamentQueues.get(tid) || [];
		if (queue.includes(playerId)) {
			return reply.code(400).send({ error: 'Already joined' });
		}
		queue.push(playerId);
		tournamentQueues.set(tid, queue);

		// not full yet?
		if (queue.length < tour.maxPlayers) {
			return reply.code(202).send({
				queued: true,
				joinedCount: queue.length,
				needed: tour.maxPlayers - queue.length
			});
		}

		// full → start tournament
		tour.players = queue.slice();
		tour.status = 'started';

		// simple single‑elim bracket pairing
		const matches = [];
		for (let i = 0; i < queue.length; i += 2) {
			matches.push({
				matchId: `${tid}-${i / 2}`,
				players: [queue[i], queue[i + 1]],
				winner: null
			});
		}
		tour.bracket = matches;

		return reply.send({
			tournamentId: tid,
			bracket: matches,
			status: tour.status
		});
	});

	fastify.get('/tournaments/:tournamentId', async (request, reply) => {
		const tid = Number(request.params.tournamentId);
		const tour = tournaments.get(tid);
		if (!tour) {
			return reply.code(404).send({ error: 'Tournament not found' });
		}
		return reply.send({
			players: tour.players,
			bracket: tour.bracket,
			status: tour.status
		});
	});

	fastify.get('/tournaments/:tournamentId/bracket', async (request, reply) => {
		const tid = Number(request.params.tournamentId);
		const tour = tournaments.get(tid);
		if (!tour) {
			return reply.code(404).send({ error: 'Tournament not found' });
		}
		return reply.send({ matches: tour.bracket });
	});

	// —— INVITES ——
	fastify.post('/invites', async (request, reply) => {
		const { fromId, toUsername, gameType, tournamentId } = request.body;
		if (!fromId || !toUsername || !gameType) {
			return reply.code(400).send({ error: 'fromId, toUsername and gameType required' });
		}
		invites.push({ fromId, toUsername, gameType, tournamentId });
		return reply.send({ invited: true });
	});


	// WebSocket route
	fastify.register(async function (fastify) {
		fastify.get('/game/:gameId', { websocket: true }, handleGameConnection);
	});
	// Start game update loop
	setupGameUpdateInterval();



	// /*** 📌 Route: GAME ***/
	// fastify.post("/user/game", async (request, reply) => {
	//     const { player1_id, player2_id, score_player1, score_player2, winner_id } = request.body;

	//     // Log la requête entrante
	//     fastify.log.info({ 
	//         body: request.body 
	//     }, "Tentative d'enregistrement d'une partie");

	//     try {
	//         // Vérifier que tous les champs requis sont présents
	//         if (!player1_id || !player2_id || score_player1 === undefined || 
	//             score_player2 === undefined || !winner_id) {
	//             fastify.log.warn({
	//                 missing: Object.entries({ player1_id, player2_id, score_player1, score_player2, winner_id })
	//                     .filter(([_, v]) => !v)
	//                     .map(([k]) => k)
	//             }, "Échec d'enregistrement : champs manquants");
	//             return reply.code(400).send({ 
	//                 error: "Missing required fields",
	//                 required: ["player1_id", "player2_id", "score_player1", "score_player2", "winner_id"]
	//             });
	//         }

	//         // Vérifier que les joueurs existent
	//         const player1 = db.prepare("SELECT id, username FROM users WHERE id = ?").get(player1_id);
	//         const player2 = db.prepare("SELECT id, username FROM users WHERE id = ?").get(player2_id);

	//         if (!player1 || !player2) {
	//             fastify.log.warn({
	//                 player1: player1 ? player1.username : `ID ${player1_id} non trouvé`,
	//                 player2: player2 ? player2.username : `ID ${player2_id} non trouvé`
	//             }, "Échec d'enregistrement : joueur(s) non trouvé(s)");
	//             return reply.code(404).send({ 
	//                 error: "One or both players not found",
	//                 details: {
	//                     player1Exists: !!player1,
	//                     player2Exists: !!player2
	//                 }
	//             });
	//         }

	//         // Vérifier que winner_id correspond à l'un des joueurs
	//         if (winner_id !== player1_id && winner_id !== player2_id) {
	//             fastify.log.warn({
	//                 winner_id,
	//                 player1_id,
	//                 player2_id
	//             }, "Échec d'enregistrement : ID du gagnant invalide");
	//             return reply.code(400).send({ 
	//                 error: "Winner must be one of the players"
	//             });
	//         }

	//         // Vérifier que les scores sont des nombres positifs
	//         if (score_player1 < 0 || score_player2 < 0) {
	//             fastify.log.warn({
	//                 score_player1,
	//                 score_player2
	//             }, "Échec d'enregistrement : scores négatifs");
	//             return reply.code(400).send({ 
	//                 error: "Scores must be positive numbers"
	//             });
	//         }

	//         // Commencer une transaction
	//         const transaction = db.transaction(() => {
	//             fastify.log.info("Début de la transaction");
	//             const result = db.prepare(`
	//                 INSERT INTO games (player1_id, player2_id, score_player1, score_player2, winner_id)
	//                 VALUES (?, ?, ?, ?, ?)
	//             `).run(player1_id, player2_id, score_player1, score_player2, winner_id);

	//             // Mettre à jour les statistiques
	//             if (winner_id === player1_id) {
	//                 fastify.log.debug(`Mise à jour des stats - Victoire: ${player1.username}, Défaite: ${player2.username}`);
	//                 db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(player1_id);
	//                 db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(player2_id);
	//             } else {
	//                 fastify.log.debug(`Mise à jour des stats - Victoire: ${player2.username}, Défaite: ${player1.username}`);
	//                 db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(player2_id);
	//                 db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(player1_id);
	//             }

	//             return result;
	//         });

	//         // Exécuter la transaction
	//         const result = transaction();

	//         fastify.log.info({
	//             gameId: result.lastInsertRowid,
	//             player1: player1.username,
	//             player2: player2.username,
	//             score: `${score_player1}-${score_player2}`,
	//             winner: winner_id === player1_id ? player1.username : player2.username
	//         }, "Partie enregistrée avec succès");

	//         return { 
	//             success: true, 
	//             gameId: result.lastInsertRowid,
	//             message: "Game saved successfully"
	//         };

	//     } catch (error) {
	//         fastify.log.error(error, "Erreur lors de l'enregistrement de la partie");
	//         return reply.code(500).send({ 
	//             error: "Failed to save game",
	//             details: error.message
	//         });
	//     }
	// });

	// /*** 📌 Route: LEADERBOARD ***/
	// fastify.get("/leaderboard", async (request, reply) => {
	//     fastify.log.info("Requête du leaderboard");

	//     try {
	//         const leaderboard = db.prepare(`
	//             SELECT 
	//                 id, username, wins, losses,
	//                 CAST(wins AS FLOAT) / CASE WHEN (wins + losses) = 0 THEN 1 ELSE (wins + losses) END as win_rate
	//             FROM users
	//             ORDER BY wins DESC, win_rate DESC
	//             LIMIT 10
	//         `).all();

	//         fastify.log.info({
	//             playerCount: leaderboard.length,
	//             topPlayer: leaderboard[0]?.username
	//         }, "Leaderboard récupéré avec succès");

	//         return { success: true, leaderboard };
	//     } catch (error) {
	//         fastify.log.error(error, "Erreur lors de la récupération du leaderboard");
	//         return reply.code(500).send({ error: "Failed to fetch leaderboard" });
	//     }
	// });
}

