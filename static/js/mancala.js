
module.exports = class {

	constructor(root){
		const { ko } = root.globals;
		const self = this;
		const mancala = self;

		const Spot = createSpot();

		self.turn = ko.observable(1);

		self.board = [...Array(2)].map((_, s) =>
			[...Array(7)].map((_, p) => new Spot(p, s))
		);

		self.gameOver = ko.computed(() =>
			self.board.some(side => side.every(spot => spot.isGoal || spot.stones() === 0))
		);

		self.gameOver.subscribe(() =>
			self.board.map(side =>
				side[6].stones(
					side.map(s => s.stones())
						.reduce((a, b) => a + b, 0)
				)
			)
		)

		self.standings = ko.computed(() => {
			let [a, b] = self.board.map(side => side[6].stones());
			if(a === b)
				return "tied!";
			return a < b ? "lost." : "won!";
		})

		root.on("ws", ({ type, data }) => {
			if(type === "move")
				self.board[1][data].move();
		})

		return self;

		function createSpot(){
			return class Spot {

				constructor(position, side){
					this.isGoal = position === 6;
					this.stones = ko.observable(this.isGoal ? 1 : 4);
					this.position = position;
					this.side = side;

					this.movable = ko.computed(() =>
						!this.isGoal && mancala.turn() === this.side && this.stones() !== 0
					);
				}

				move(){
					if(!this.movable())
						return;

					let stones = this.stones();

					this.stones(0);

					let loop = [...mancala.board[this.side], ...mancala.board[+!this.side].slice(0, -1)];
					let again;

					for(let i = 0; i < stones; i++) {
						let spot = loop[(i + this.position + 1) % loop.length];
						spot.stones(spot.stones() + 1);

						if(i === stones - 1) {
							again = spot.isGoal;
							if(spot.stones() === 1 && spot.side === this.side) {
								let opp = mancala.board[+!this.side][5 - spot.position];
								let goal = mancala.board[this.side][6];

								goal.stones(goal.stones() + opp.stones());
								opp.stones(0);
							}
						}
					}

					if(this.side === 0)
						root.ws.s("move", this.position);

					mancala.turn(mancala.turn() ^ !again);
				}

			}
		}
	}

}
