// Game State
let currentPlayer = 1;
let scores = [0, 0];
let remainingDice = 6;
let lockedRollSets = [];
let currentRollDice = [];
let cumulativePotentialPoints = 0;
let currentRollValues = [];
let isStealing = false;
let stealTargetPoints = 0;
let stealRemainingDice = 0;
let originalPlayer = 1;
let dudRollPending = false;


// Utility Functions
async function rollDice(numDice) {
    await playDiceSounds(numDice); // Wait for matching number of sounds to finish

    return Array.from({ length: numDice }, () => Math.floor(Math.random() * 6) + 1);
}

function calculateScore(rolls) {
    let counts = {};
    rolls.forEach(r => counts[r] = (counts[r] || 0) + 1);

    const unique = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const values = Object.values(counts).sort((a, b) => b - a);
    const entries = Object.entries(counts).map(([v, c]) => ({ val: parseInt(v), count: c }));

    let possibleScores = [];

    // 6 of a kind
    for (const { val, count } of entries) {
        if (count === 6) {
            let base = val === 1 ? 1000 : val * 100;
            possibleScores.push({ type: '6 of a kind', score: base * 8 });
        }
    }

    // 5 of a kind
    for (const { val, count } of entries) {
        if (count === 5) {
            let base = val === 1 ? 1000 : val * 100;
            let remaining = rolls.filter(r => r !== val);
            let extra = calculateScore(remaining);
            possibleScores.push({ type: '5 of a kind', score: base * 4 + extra });
        }
    }

    // 4 of a kind
    for (const { val, count } of entries) {
        if (count === 4) {
            let base = val === 1 ? 1000 : val * 100;
            let remaining = rolls.filter(r => r !== val);
            let extra = calculateScore(remaining);
            possibleScores.push({ type: '4 of a kind', score: base * 2 + extra });
        }
    }

    // ✅ Updated Full house logic
    const triples = entries.filter(e => e.count >= 3);
    if (triples.length >= 2 || (triples.length === 1 && entries.some(e => e !== triples[0] && e.count >= 2))) {
        // Determine 3-of-a-kind and 2-of-a-kind
        let tripleVal = triples[0].val;
        let pairVal = null;

        if (triples.length >= 2) {
            pairVal = triples[1].val;
        } else {
            for (const e of entries) {
                if (e.val !== tripleVal && e.count >= 2) {
                    pairVal = e.val;
                    break;
                }
            }
        }

        // Remove 3 of tripleVal and 2 of pairVal to check for extra scoring dice
        let leftover = [...rolls];
        let tripleRemoved = 0;
        let pairRemoved = 0;

        for (let i = leftover.length - 1; i >= 0; i--) {
            if (leftover[i] === tripleVal && tripleRemoved < 3) {
                leftover.splice(i, 1);
                tripleRemoved++;
            } else if (leftover[i] === pairVal && pairRemoved < 2) {
                leftover.splice(i, 1);
                pairRemoved++;
            }
        }

        let extra = calculateScore(leftover);
        possibleScores.push({ type: 'Full House', score: 1500 + extra });
    }

    // Straight (1–6)
    if (unique.length === 6 && unique.every((v, i) => v === i + 1)) {
        possibleScores.push({ type: 'Straight', score: 1000 });
    }

    // Three pairs
    if (values.length === 3 && values.every(c => c === 2)) {
        possibleScores.push({ type: 'Three Pairs', score: 1000 });
    }

    // 3 of a kind
    for (const { val, count } of entries) {
        if (count === 3) {
            let base = val === 1 ? 1000 : val * 100;
            let remaining = rolls.filter(r => r !== val);
            let extra = calculateScore(remaining);
            possibleScores.push({ type: '3 of a kind', score: base + extra });
        }
    }

    // Singles: Always add this as a fallback
    let singlePoints = (counts[1] || 0) * 100 + (counts[5] || 0) * 50;
    if (singlePoints > 0) {
        possibleScores.push({ type: 'Singles', score: singlePoints });
    }

    // No valid scoring combination
    if (possibleScores.length === 0) return 0;

    return Math.max(...possibleScores.map(p => p.score));
}

function hasScoringDice(rolls) {
    const counts = {};
    rolls.forEach(r => counts[r] = (counts[r] || 0) + 1);
    return Object.entries(counts).some(([val, count]) => {
        const v = parseInt(val);
        return v === 1 || v === 5 || count >= 3;
    });
}

function disableRollButton() {
    const btn = document.getElementById("roll-dice");
    if (btn) {
        btn.disabled = true;
        btn.classList.add("disabled");
        btn.style.pointerEvents = "none";
    }
}

function enableRollButton() {
    const btn = document.getElementById("roll-dice");
    if (btn) {
        btn.disabled = false;                 // Enable the button element
        btn.classList.remove("disabled");     // Remove disabled styling
        btn.style.pointerEvents = "auto";     // Ensure it's clickable
        btn.style.backgroundColor = "";       // Reset to default style
        btn.style.cursor = "";                // Reset to default cursor
    } else {
        console.warn("Roll button not found");
    }
}

// UI Functions
function updateScores(scores) {
    const scoreLog = document.getElementById('score-log');

    // Create a new row
    const newRow = document.createElement('tr');

    // Count turns by number of rows already added
    const turnNumber = scoreLog.rows.length + 1;

    newRow.innerHTML = `
        <td>${turnNumber}</td>
        <td>${scores[0]}</td>
        <td>${scores[1]}</td>
    `;

    scoreLog.appendChild(newRow);
}

function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}

function displayDice(rolls) {
    currentRollValues = rolls;
    const diceContainer = document.getElementById('dice-container');
    diceContainer.innerHTML = '';

    rolls.forEach((roll, index) => {
        const dice = document.createElement('img');
        dice.src = `images/dice${roll}.png`;  // ✅ FIXED: template string
        dice.className = 'dice';
        dice.alt = `Dice showing ${roll}`;    // ✅ FIXED: template string
        dice.addEventListener('click', () => toggleDiceSelection(dice, index, roll));
        diceContainer.appendChild(dice);
    });
}

function toggleDiceSelection(dice, index, value) {
    if (dice.classList.contains('selected')) {
        dice.classList.remove('selected');
        currentRollDice = currentRollDice.filter(d => d.index !== index);
    } else {
        dice.classList.add('selected');
        currentRollDice.push({ index, value });
    }

    const currentValues = currentRollDice.map(d => d.value);
    const priorPoints = lockedRollSets.reduce((sum, set) => sum + calculateScore(set.map(d => d.value)), 0);
    const currentPoints = calculateScore(currentValues);
    cumulativePotentialPoints = priorPoints + currentPoints;

    document.getElementById('potential-points').textContent = `Potential Points: ${cumulativePotentialPoints}`;

    // ✅ Enable roll button only if some dice are selected
    if (currentRollDice.length > 0) {
        enableRollButton();
    } else {
        disableRollButton();
    }
}

function moveSelectedDiceOutOfPlay() {
    const container = document.getElementById('selected-dice-container');
    container.innerHTML = '';

    lockedRollSets.forEach(set => {
        set.forEach(die => {
            const dice = document.createElement('img');
            dice.src = `images/dice${die.value}.png`;
            dice.alt = `Dice showing ${die.value}`;
            dice.className = 'dice selected';
            container.appendChild(dice);
        });
    });
}

function lockCurrentRollDice() {
    if (currentRollDice.length === 0) return;

    lockedRollSets.push([...currentRollDice]);  // append the selected dice
    currentRollDice = [];
    currentRollValues = [];
    remainingDice = 6 - lockedRollSets.flat().length;

    // If hot dice — all dice scored
    if (remainingDice === 0) {
        remainingDice = 6;  // allow rolling all 6 again
        showMessage("Hot dice! You can roll all 6 dice again.");
    }
}

function resetUI() {
    document.getElementById('dice-container').innerHTML = '';
    document.getElementById('selected-dice-container').innerHTML = '';
    document.getElementById('potential-points').textContent = 'Potential Points: 0';
}

function playDiceSounds(numDice) {
    const soundFiles = [
        'Sounds/DiceRoll1.mp3',
        'Sounds/DiceRoll2.mp3',
        'Sounds/DiceRoll3.mp3'
    ];

    // Only play up to the number of dice (max 3)
    const soundsToPlay = soundFiles.slice(0, Math.min(numDice, soundFiles.length));

    const playPromises = soundsToPlay.map(file => {
        return new Promise(resolve => {
            const audio = new Audio(file);
            audio.volume = 0.4;
            audio.play();
            audio.addEventListener('ended', resolve);
        });
    });

    return Promise.all(playPromises);
}

// Game Logic
async function rollDiceHandler() {
    if (currentRollDice.length > 0) {
        lockCurrentRollDice(); // Store selected scoring dice
    }

    // Clear visuals
    document.getElementById('dice-container').innerHTML = '';
    document.getElementById('selected-dice-container').innerHTML = '';
    currentRollDice = [];

    const diceToRoll = isStealing ? stealRemainingDice : remainingDice;
    const rolls = await rollDice(diceToRoll);
    currentRollValues = rolls;
    displayDice(rolls);
    disableRollButton();

    const hasScoring = hasScoringDice(rolls);
    const isHotDice = lockedRollSets.flat().length % 6 === 0 && lockedRollSets.flat().length > 0;

    if (!hasScoring && !isHotDice) {
        currentRollValues = rolls;
        dudRollPending = true;
        showMessage(`Dud roll confirmed. No points awarded. You rolled: ${rolls.join(', ')}`);

        // ✅ Rebuild dud dice in standard format
        displayDice(rolls);

        // ✅ Enable End Turn button manually if needed
        enableRollButton();  // Let user end turn manually
        return;
    }

    dudRollPending = false;

    if (isStealing) {
        stealRemainingDice = rolls.length;
        showMessage(`Player ${getOpponent()} is stealing! Rolled: ${rolls.join(', ')}`);
    } else {
        remainingDice = rolls.length;
        showMessage('');
    }
}

function endTurnHandler() {
    if (dudRollPending) {
        dudRollPending = false;

        if (isStealing) {
            const originalPlayer = currentPlayer === 1 ? 2 : 1;
            scores[originalPlayer - 1] += stealTargetPoints;
            updateScores(scores);

            if (scores[originalPlayer - 1] >= 10000) {
                const playAgain = confirm(`Player ${originalPlayer} wins with ${scores[originalPlayer - 1]} points!\n\nPlay again?`);
                if (playAgain) resetGame();
                return;
            }

            showMessage(`Steal failed. Original player banks ${stealTargetPoints} points.`);
            isStealing = false;
            stealTargetPoints = 0;
            stealRemainingDice = 0;
        }

        resetTurn();
        switchPlayer();
        updateCurrentPlayerDisplay();
        displayDice([]);
        enableRollButton();
        return;
    }

    const isDud = currentRollValues.length > 0 && !hasScoringDice(currentRollValues);
    const selectedDiceValues = currentRollDice.map(d => d.value);
    const selectedPoints = calculateScore(selectedDiceValues);

    const playerIndex = currentPlayer - 1;
    const opponentIndex = currentPlayer === 1 ? 1 : 0;
    const bothPlayersOnBoard = scores[0] >= 500 && scores[1] >= 500;

    if (selectedPoints === 0 && !isDud) {
        showMessage("No valid scoring dice selected.");
        return;
    }

    if (currentRollDice.length > 0) {
        lockCurrentRollDice();
    }

    const finalScore = lockedRollSets.reduce((sum, set) => sum + calculateScore(set.map(d => d.value)), 0);

    if (isStealing) {
        const diceUsedThisTurn = lockedRollSets.flat().length;
        stealRemainingDice -= diceUsedThisTurn;
        stealTargetPoints += finalScore;

        const hotDice = diceUsedThisTurn > 0 && stealRemainingDice <= 0;

        if (hotDice) {
            showMessage(`Hot dice during steal! You've earned ${finalScore} this round. Roll again with 6 fresh dice.\nCurrent potential points: ${stealTargetPoints}`);
            lockedRollSets = [];
            currentRollDice = [];
            stealRemainingDice = 6;
            enableRollButton();
            return;
        }


        if (bothPlayersOnBoard) {
            showMessage(`Successful steal! You’ve gained ${stealTargetPoints} points from the steal. Waiting to see if opponent wants to steal back.`);
            const wantsToStealBack = confirm(`Player ${getOpponent()}, do you want to steal back by rolling the remaining ${stealRemainingDice} dice?`);
            if (wantsToStealBack) {
                switchPlayer();
                isStealing = true;
                currentRollDice = [];
                lockedRollSets = [];
                displayDice([]);
                enableRollButton();
                return;
            }
        }

        scores[playerIndex] += stealTargetPoints;
        updateScores(scores);

        if (scores[playerIndex] >= 10000) {
            const playAgain = confirm(`Player ${currentPlayer} wins with ${scores[playerIndex]} points!\n\nPlay again?`);
            if (playAgain) resetGame();
            return;
        }

        showMessage(`Player ${currentPlayer} banks ${stealTargetPoints} points after successful steal!`);
        isStealing = false;
        stealTargetPoints = 0;
        stealRemainingDice = 0;
        resetTurn();
        switchPlayer();
        updateCurrentPlayerDisplay();
        displayDice([]);
        enableRollButton();
        return;
    }

    if (!isStealing) {
        if (finalScore < 500 && scores[playerIndex] === 0) {
            showMessage("You must score at least 500 points in one turn to get on the board.");
            resetTurn();
            switchPlayer();
            updateCurrentPlayerDisplay();
            displayDice([]);
            enableRollButton();
            return;
        }

        const unscoredDice = 6 - lockedRollSets.flat().length;
        if (unscoredDice > 0 && finalScore > 0 && bothPlayersOnBoard) {
            const offerSteal = confirm(`Player ${getOpponent()}, do you want to steal ${finalScore} points and roll ${unscoredDice} remaining dice?`);
            if (offerSteal) {
                switchPlayer();
                isStealing = true;
                stealTargetPoints = finalScore;
                stealRemainingDice = unscoredDice;
                lockedRollSets = [];
                currentRollDice = [];
                displayDice([]);
                enableRollButton();
                showMessage(`Player ${currentPlayer} is attempting a steal with ${unscoredDice} dice!`);
                return;
            }
        }

        scores[playerIndex] += finalScore;
        updateScores(scores);

        if (scores[playerIndex] >= 10000) {
            const playAgain = confirm(`Player ${currentPlayer} wins with ${scores[playerIndex]} points!\n\nPlay again?`);
            if (playAgain) resetGame();
            return;
        }

        showMessage(`Player ${currentPlayer} banks ${finalScore} points.`);
        resetTurn();
        switchPlayer();
        updateCurrentPlayerDisplay();
        displayDice([]);
        enableRollButton();
    }
}

function resetGame() {
    scores = [0, 0];
    currentPlayer = 1;
    isStealing = false;
    stealTargetPoints = 0;
    stealRemainingDice = 0;
    lockedRollSets = [];
    currentRollDice = [];
    currentRollValues = [];

    resetTurn();
    updateScores(scores);

    document.getElementById('current-player').textContent = `Current Player: Player ${currentPlayer}`;
    document.getElementById('dice-container').innerHTML = ''; // Clear dice display
    document.getElementById('message').textContent = '';       // Clear any messages
    document.getElementById('score-log').innerHTML = '';
    showMessage("New game started!");
}

function resetTurn() {
    currentRollDice = [];
    lockedRollSets = [];
    currentRollValues = [];
    remainingDice = 6;
    cumulativePotentialPoints = 0;
    resetUI();
}

function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    document.getElementById('current-player').textContent = `Current Player: Player ${currentPlayer}`;
    showMessage(`It's now Player ${currentPlayer}'s turn`);
}

function getOpponent() {
    return currentPlayer === 1 ? 2 : 1;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('roll-dice').addEventListener('click', rollDiceHandler);
    document.getElementById('end-turn').addEventListener('click', endTurnHandler);
});
