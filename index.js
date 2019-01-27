
const express = require("express");
const browserify = require("browserify");
const watchify = require("watchify");
const crypto = require("crypto");
const fs = require("fs");
const stylus = require("stylus");
const { promisify } = require("util");

const b = browserify({
	entries: [__dirname + "/static/js/index.js"],
	cache: {},
	packageCache: {},
	debug: true,
	plugin: [watchify],
})

b.on("update", bundle)
bundle()

function bundle(){
	console.log("Bundling client JS");
	b.bundle()
		.on("end", () => console.log("Bundled client JS"))
		.on("error", console.error)
		.pipe(fs.createWriteStream(__dirname + "/static/bundle.js"))
}

const app = express();
require("express-ws")(app);

app.use(express.static(__dirname + "/static/"));

app.get("/bundle.css", async (req, res) => {
	res.set("Content-Type", "text/css").send(await promisify(stylus.render)(
		`@import '${__dirname + "/static/stylus/"}*'`,
		{ filename: "_.styl" },
	));
});

let wss = {
	waiting: [],
	hosting: [],
	byId:    {},
}

app.ws("/ws", ws => {

	ws.s = function(type, data){
		if(this.readyState !== 1)
			return;

		this.send(JSON.stringify({ type, data }));
	}

	ws.status = "waiting";

	wss.waiting.push(ws);

	sendGames([ws]);

	ws.on("message", message => {
		let { type, data } = JSON.parse(message);

		switch(type) {
			case "move": {
				if(ws.status !== "playing")
					return;

				ws.o.s(type, data);

				break;
			}

			case "join": {
				if(ws.status !== "waiting")
					return;

				let ws2 = wss.byId[(data || {}).id];

				if(!ws2 || !~wss.hosting.indexOf(ws2) || data.pswd !== ws2.pswd)
					return ws.s("joinFailed");

				wss.hosting.splice(wss.hosting.indexOf(ws2), 1);
				wss.waiting.splice(wss.waiting.indexOf(ws), 1);
				sendGames();

				ws.o  = ws2;
				ws2.o =  ws;

				ws.status = ws2.status = "playing";

				sendStatus(ws, ws2);

				break;
			}

			case "host": {
				if(ws.status !== "waiting")
					return;

				ws.id = genId();
				wss.byId[ws.id] = ws;
				ws.name = data.name;
				ws.pswd = data.pswd;

				wss.waiting.splice(wss.waiting.indexOf(ws), 1);
				wss.hosting.push(ws);
				sendGames();

				ws.status = "hosting";

				sendStatus(ws);

				break;
			}
		}
	})

	ws.on("close", () => {
		switch(ws.status) {
			case "waiting":
				wss.waiting.splice(wss.waiting.indexOf(ws), 1);
				break;

			case "hosting":
				wss.hosting.splice(wss.hosting.indexOf(ws), 1);
				sendGames();
				break;

			case "playing":
				ws.o.s("close");
				ws.o.close();
		}
	})

})

const port = process.env.PORT || 65438;

app.listen(port, () =>
	console.log(`Listening on http://localhost:${port}/`)
)

function sendGames(ws_ = wss.waiting){
	ws_.map(ws => ws.s("games", wss.hosting.map(({ id, name, pswd }) => ({
		id,
		name,
		pswd: !!pswd,
	}))));
}

function sendStatus(...wss){
	wss.map(ws => ws.s("status", ws.status));
}

function genId(){
	return crypto.randomBytes(128).toString("hex");
}
