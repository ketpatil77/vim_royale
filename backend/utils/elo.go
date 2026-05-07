package utils

import "math"

func CalculateElo(
	playerRating,
	opponentRating float64,
	isPlayerWinner bool,
) (float64, float64) {
	const k = 32.0

	playerExpected := 1.0 / (1.0 + math.Pow(10, (opponentRating-playerRating)/400))
	opponentExpected := 1.0 / (1.0 + math.Pow(10, (playerRating-opponentRating)/400))

	playerScore := 0.0
	opponentScore := 0.0

	if isPlayerWinner {
		playerScore = 1.0
	} else {
		opponentScore = 1.0
	}

	newPlayerRating := playerRating + k*(playerScore-playerExpected)

	newOpponentRating := opponentRating + k*(opponentScore-opponentExpected)

	return newPlayerRating, newOpponentRating
}
