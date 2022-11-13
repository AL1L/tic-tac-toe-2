class GameEvent extends Event {
    constructor(game, type, eventInitDict) {
        super(type, eventInitDict)
        this.game = game;
    }
}

const possibleWins = [
    // Horiz
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    // Crosses
    [0, 4, 8],
    [2, 4, 6],
    // Vert
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
];

const miniNames = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"];

class Game extends EventTarget {
    constructor() {
        super();
        this.mainBoard = new Array(9).fill(null);
        this.board = new Array(9 * 9).fill(null);
        this.turn = 0;
        this.lastPlayedIndex = -1;
        this.winner = null;
        this.hover = {
            main: null,
            mini: null,
        }
        this.history = [];
    }

    seralize() {
        return JSON.stringify({
            mainBoard: this.mainBoard,
            board: this.board,
            turn: this.turn,
            lastPlayedIndex: this.lastPlayedIndex,
            winner: this.winner,
            history: this.history,
        });
    }

    save(id) {
        window.localStorage.setItem('game-' + id, this.seralize())
    }

    static load(id) {
        const raw = window.localStorage.getItem('game-' + id);
        const game = new Game();

        if (!raw)
            return game;

        const data = JSON.parse(raw);

        game.mainBoard = data.mainBoard;
        game.board = data.board;
        game.turn = data.turn;
        game.lastPlayedIndex = data.lastPlayedIndex;
        game.winner = data.winner;
        game.history = data.history;

        return game;
    }

    get nextSquare() {
        if (this.winner) return -1;
        if (this.isMiniFull(this.lastPlayedIndex % 9)) return -1;
        return this.lastPlayedIndex % 9;
    }

    get whosTurn() {
        return (this.turn % 2) + 1;
    }

    setHover(x, y, style) {
    }
    setHover(x, y, style) {
        const mainX = Math.floor(x / (style.width / 3));
        const mainY = Math.floor(y / (style.height / 3));
        const mainI = mainX + mainY * 3;

        const mainInBounds = mainX >= 0 && mainX <= 2 && mainY >= 0 && mainY <= 2;
        const main = mainInBounds ? [mainI, mainX, mainY] : null;

        function getMiniHover() {
            const miniWidth = style.width / 3 - style.mini.default.padding * 2;
            const miniHeight = style.height / 3 - style.mini.default.padding * 2;
            const originX = style.width / 3 * mainX + style.mini.default.padding;
            const originY = style.height / 3 * mainY + style.mini.default.padding;

            if (x < originX || x > originX + miniWidth)
                return null;
            if (y < originY || y > originY + miniHeight)
                return null;
            
            const miniX = Math.floor((x - originX) / (miniWidth / 3));
            const miniY = Math.floor((y - originY) / (miniHeight / 3));
            const miniI = mainI * 9 + miniX + miniY * 3;

            return [miniI, miniX, miniY];
        }
        
        let mini = main && getMiniHover();

        const beforeHover = JSON.stringify(this.hover);

        this.hover = { main, mini };

        if (beforeHover !== JSON.stringify(this.hover))
            this.dispatchEvent(new GameEvent(this, "render"));
    }

    apartOfSquare(at) {
        return Math.floor(at / 9);
    }

    isMiniFull(i) {
        return this.board.slice(i * 9, i * 9 + 9).filter(Number).length === 9;
    }

    checkWinner() {
        for (let [a, b, c] of possibleWins) {
            if (this.mainBoard[a] && this.mainBoard[b] && this.mainBoard[c]
                && this.mainBoard[a][0] === this.mainBoard[b][0] && this.mainBoard[a][0] === this.mainBoard[c][0])
                return this.mainBoard[a][0];
        }
        return null;
    }

    checkMiniState(mini) {
        if (this.mainBoard[mini] !== null)
            return;

        const slice = this.board.slice(mini * 9, mini * 9 + 9);

        console.log(mini, slice)

        // Check for a win in this square
        let winner = null;
        const winners = []
        for (let [a, b, c] of possibleWins) {
            if (slice[a] === slice[b] && slice[a] === slice[c] && slice[a] !== null) {
                winner = slice[a];
                winners.push([a, c]);
            }
        }
        if (winner !== null && winners.length) {
            this.mainBoard[mini] = [winner, winners];
        }
    }

    play(at) {
        if (at < 0 || at > 80 || Number.isNaN(at))
            throw new Error("Invalid position: " + at);
        if (this.winner)
            throw new Error("The game has ended. The winner is player " + this.winner);

        // if (this.turn === 0)
        //     at = this.apartOfSquare(at) * 9 + this.apartOfSquare(at);

        if (this.turn !== 0 && !this.isMiniFull(this.nextSquare) && this.apartOfSquare(at) !== this.nextSquare)
            throw new Error("You must play in board " + miniNames[this.nextSquare]);

        if (this.board[at])
            throw new Error("That place is already occupied");

        this.board[at] = this.whosTurn;
        this.lastPlayedIndex = at;
        this.history.push(at);

        this.checkMiniState(Math.floor(at / 9));

        this.winner = this.checkWinner();

        const turnEvent = new GameEvent(this, "turn");
        turnEvent.player = this.whosTurn;
        turnEvent.at = at;
        turnEvent.turn = this.turn;

        this.turn++;

        this.dispatchEvent(turnEvent);
        this.dispatchEvent(new GameEvent(this, "render"));
    }

    undo() {
        this.turn--;
        const at = this.history.pop();
        const player = this.board[at];
        this.lastPlayedIndex = this.history.length ? this.history[this.history.length - 1] : -1;
        delete this.board[at];

        const undoEvent = new GameEvent(this, "undo");
        undoEvent.player = player;
        undoEvent.at = at;
        undoEvent.turn = this.turn + 1;

        this.dispatchEvent(undoEvent);
        this.dispatchEvent(new GameEvent(this, "render"));
    }

    toStatusString() {
        if (this.winner)
            return `Player ${this.winner === 1 ? "X" : "O"} won!`
        if (this.turn === 0)
            return "Player X starts, play anywhere.";
        const playerName = this.whosTurn === 1 ? "X" : "O";
        if (this.isMiniFull(this.nextSquare))
            return `Player ${playerName}'s turn. Play on any board.`;
        
        return `Player ${playerName}'s turn. Play on board ${miniNames[this.nextSquare]}.`;
        
    }

    /**
     * Renders the board to a canvas
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    renderBoard(ctx, style) {
        if (!this.isMiniFull(this.nextSquare) && this.nextSquare !== -1) {
            const y = Math.floor(this.nextSquare / 3);
            const x = this.nextSquare - y * 3;
            ctx.fillStyle = style.main.next.fillStyle;
            ctx.rect((style.width / 3) * x, (style.height / 3) * y, style.width / 3, style.height / 3);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
        }

        // Main board
        ctx.lineWidth = style.main.default.lineWidth;
        ctx.strokeStyle = style.main.default.strokeStyle;

        // Left vert
        ctx.beginPath();
        ctx.moveTo(style.width / 3, 0);
        ctx.lineTo(style.width / 3, style.height);
        ctx.stroke();

        // Right vert
        ctx.beginPath();
        ctx.moveTo(style.width * (2/3), 0);
        ctx.lineTo(style.width * (2/3), style.height);
        ctx.stroke();

        // Top horiz
        ctx.beginPath();
        ctx.moveTo(0, style.height / 3);
        ctx.lineTo(style.width, style.height / 3);
        ctx.stroke();

        // Bottom horiz
        ctx.beginPath();
        ctx.moveTo(0, style.height * (2/3));
        ctx.lineTo(style.width, style.height * (2/3));
        ctx.stroke();
        
        // Mini boards
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                ctx.lineWidth = style.mini.default.lineWidth;
                ctx.strokeStyle = style.mini.default.strokeStyle;

                const originX = style.width / 3 * x + style.mini.default.padding;
                const originY = style.height / 3 * y + style.mini.default.padding;
                const miniWidth = style.width / 3 - style.mini.default.padding * 2
                const miniHeight = style.height / 3 - style.mini.default.padding * 2
                const index = (x + y * 3);
                const startingIndex = index * 9;

                // Left vert
                ctx.beginPath();
                ctx.moveTo(originX + miniWidth / 3, originY);
                ctx.lineTo(originX + miniWidth / 3, originY + miniHeight);
                ctx.stroke();

                // Right vert
                ctx.beginPath();
                ctx.moveTo(originX + miniWidth * (2/3), originY);
                ctx.lineTo(originX + miniWidth * (2/3), originY + miniHeight);
                ctx.stroke();

                // Top horiz
                ctx.beginPath();
                ctx.moveTo(originX + 0, originY + miniHeight / 3);
                ctx.lineTo(originX + miniWidth, originY + miniHeight / 3);
                ctx.stroke();

                // Bottom horiz
                ctx.beginPath();
                ctx.moveTo(originX, originY + miniHeight * (2/3));
                ctx.lineTo(originX + miniWidth, originY + miniHeight * (2/3));
                ctx.stroke();

                // Places
                for (let py = 0; py < 3; py++) {
                    for (let px = 0; px < 3; px++) {
                        const i = startingIndex + (px + py * 3);

                        if (!this.board[i] && (!this.hover.mini || this.hover.mini[0] !== i)) {
                            continue;
                        }

                        const player = this.winner ? this.board[i] : this.board[i] || this.whosTurn;
                        if (!player) continue;
                        const playerStyle = {
                            ...style.players.default,
                            ...style.players[player].default,
                        }

                        const pOriginX = originX + miniWidth / 3 * px + playerStyle.padding;
                        const pOriginY = originY + miniHeight / 3 * py + playerStyle.padding;
                        const size = Math.min(miniHeight, miniWidth) / 3 - playerStyle.padding * 2;

                        ctx.lineWidth = playerStyle.lineWidth;
                        ctx.strokeStyle = playerStyle.strokeStyle;
            
                        if (player === 1) {
                            // Downward cross
                            ctx.beginPath();
                            ctx.moveTo(pOriginX, pOriginY);
                            ctx.lineTo(pOriginX + size, pOriginY + size);
                            ctx.stroke();
            
                            // Upward cross
                            ctx.beginPath();
                            ctx.moveTo(pOriginX + size, pOriginY);
                            ctx.lineTo(pOriginX, pOriginY + size);
                            ctx.stroke();
                        } else {
                            ctx.beginPath();
                            ctx.arc(pOriginX + size / 2, pOriginY + size / 2, size / 2, 0, 360);
                            ctx.stroke();
                        }
                    }
                }

                ctx.lineWidth = style.mini.default.lineWidth;
                ctx.strokeStyle = style.mini.default.strokeStyle;
                
                if (this.mainBoard[index]) {
                    for (let [start, end] of this.mainBoard[index][1]) {
                        const wy1 = Math.floor(start / 3);
                        const wx1 = start - wy1 * 3;
                        const wy2 = Math.floor(end / 3);
                        const wx2 = end - wy2 * 3;
                        let offsets = [0,0,0,0];
                        if (wy1 == wy2) {
                            offsets = [0, miniHeight / 6, miniWidth / 3, miniHeight / 6];
                        } else if (wx1 === wx2) {
                            offsets = [miniWidth / 6, 0, miniWidth / 6, miniHeight / 3];
                        } else if (start === 0) {
                            offsets = [0, 0, miniWidth / 3, miniHeight / 3];
                        } else if (start === 2) {
                            offsets = [miniWidth / 3, 0, 0, miniHeight / 3];
                        }
                        ctx.beginPath();
                        ctx.moveTo(originX + (miniWidth / 3 * wx1) + offsets[0], originY + (miniHeight / 3 * wy1) + offsets[1]);
                        ctx.lineTo(originX + (miniWidth / 3 * wx2) + offsets[2], originY + (miniHeight / 3 * wy2) + offsets[3]);
                        ctx.stroke();
                    }
                }
            }
        }
    }
}


const style = {
    height: 700,
    width: 700,
    main: {
        default: {
            // padding: 0,
            lineWidth: 4,
            strokeStyle: "#000000",
        },
        next: {
            fillStyle: "#FFFF0060"
        }
    },
    mini: {
        default: {
            padding: 25,
            lineWidth: 2,
            strokeStyle: "#000000",
        },
        current: {},
        cat: {},
    },
    players: {
        default: {
            padding: 10,
            lineWidth: 2,
            strokeStyle: "black",
        },
        [1]: {
            default: {
                strokeStyle: "red",
            },
            wonMini: {},
        },
        [2]: {
            default: {
                strokeStyle: "blue",
            },
            wonMini: {},
        }
    }
};

function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("canvas");
    /** @type {HTMLParagraphElement} */
    const status = document.getElementById("status");
    const context = canvas.getContext("2d");
    let game = Game.load('main');

    game.renderBoard(context, style);
    status.innerText = game.toStatusString();

    game.addEventListener("render", (e) => {
        context.clearRect(0, 0, style.width, style.height);
        e.game.renderBoard(context, style);
        status.innerText = game.toStatusString();
    });

    game.addEventListener("turn", () => {
        game.save('main');
    });
    game.addEventListener("undo", () => {
        game.save('main');
    });

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        game.setHover(mouseX, mouseY, style);
    });

    canvas.addEventListener("click", () => {
        if (!game.hover || !game.hover.mini)
            return;

        try {
            game.play(game.hover.mini[0])
        } catch (e) {
            status.innerText = e.message;
        }
    });

    undo.addEventListener("click", () => {
        game.undo();
    })

    clear.addEventListener("click", () => {
        console.log("Old game", game.seralize());
        localStorage.removeItem('game-main');
        window.location.reload();
    })

    window.game = game;
}

if (document.readyState === 'complete') {
    main();
} else document.addEventListener("DOMContentLoaded", function() {
    main();
});