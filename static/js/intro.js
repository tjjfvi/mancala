
module.exports = class {

	constructor(root){
		const { ko } = root.globals;
		const self = this;

		self.games = ko.observable([]);

		self.host = {
			name: ko.observable(""),
			pswd: ko.observable(""),
			host: () => {
				root.ws.s("host", {
					name: self.host.name(),
					pswd: self.host.pswd(),
				});
				root.mancala.turn(0);
			}
		}

		root.on("ws", ({ type, data }) => {
			if(type === "games")
				self.games(data.map(g => new Game(g)));
		})

		class Game {

			constructor({ name, pswd, id }){
				const self = this;

				self.name = name;
				self.pswdReq = pswd;
				self.pswd = ko.observable("");
				self.wrong = ko.observable(false);

				self.join = () => {
					root.ws.s("join", { id, pswd: self.pswd() })
					root.on("ws", ({ type }) => {
						if(type === "joinFailed")
							self.wrong(true);
					})
				}
			}

		}

		return self;
	}

}
