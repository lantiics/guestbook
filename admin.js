const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const app = express();
const rateLimit = require("express-rate-limit").rateLimit;
const db = new Database("./guestbook.db");
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const adminPass = process.env.GLOBAL_PASS ?? process.env.GB_ADMIN_PASS ?? Math.random() * (Math.random() * 1000) + (Math.random() * (Math.random() * 1000)).toString() + (Math.random() * (Math.random() * 1000)).toString() + (Math.random() * (Math.random() * 1000)).toString() + (Math.random() * (Math.random() * 1000)).toString() + (Math.random() * (Math.random() * 1000)).toString()
const maxPageEntries = 15;

const cookieValidation = (req, res, next) => {
	try {
		if ((req.cookies.admin, req.cookies.admin == adminPass)) {
			next();
		} else {
			res.sendFile(path.join(__dirname, "./admin/auth.html"));
		}
	} catch (e) {
		res.sendFile(path.join(__dirname, "./admin/auth.html"));
		console.log(e);
	}
};
app.use(
	"/",
	cookieValidation,
	express.static(path.join(__dirname, "./admin/")),
);

function guestbookStatus(n) {
	return db.prepare(`SELECT status FROM status WHERE name='${n}'`).get().status === 1
}

app.post("/gb/posts", cookieValidation, async (req, res) => {
	const getEntries = await getGuestbookEntries(
		req.body["page"] - 1,
		req.body["queue"] ? (req.body.queue == false ? false : true) : false,
	);

	console.log(getEntries);
	if (getEntries == 404) {
		res.sendStatus(getEntries);
	} else {
		res.send(getEntries);
	}
});

app.post("/gb/manage", cookieValidation, async (req, res) => {
	const manage = await manageEntries(req.body);
	res.send(manage);
});

app.post("/gb/configure", cookieValidation, async (req, res) => {
	try {
		if (guestbookStatus("disabled") && req.body['toggle']=='hidden') {
			db.prepare(`UPDATE status SET status = NOT status WHERE name = 'disabled'`).run()
		} else if (guestbookStatus("hidden") && req.body['toggle'] == 'disabled') {
			db.prepare(`UPDATE status SET status = NOT status WHERE name = 'hidden'`).run()
		} else if (guestbookStatus("readonly") && req.body['toggle'] == 'approval') {
			db.prepare(`UPDATE status SET status = NOT status WHERE name = 'readonly'`).run()
		} else if (guestbookStatus('approval') && req.body['toggle'] == 'readonly') {
			db.prepare(`UPDATE status SET status = NOT status WHERE name = 'approval'`).run()
		} 
			
		
		db.prepare(`UPDATE status SET status = NOT status WHERE name = ?`).run(
			req.body['toggle']
		);
		res.send(200);
	} catch (e) {
		(console.error(e), res.send(500));
	}
});

app.get("/gb/status", cookieValidation, async (req, res) => {
	res.send(await db.prepare("SELECT * FROM status").all());
});

async function getGuestbookEntries(page, queue) {
	try {
		const entries = db
			.prepare(
				`SELECT * FROM ${queue == false ? "entries" : "queue"} ORDER BY entryId DESC LIMIT 15 OFFSET ? `,
			)
			.all(page * maxPageEntries);
		console.log(entries);
		return entries[0]
			? entries
			: page == 0
				? JSON.stringify([
						{
							name: "guestbook",
							content:
								queue == false
									? "there arent any entries in this guestbook yet!"
									: "there are no entries in the queue!",
							entryId: "1",
							epoch: `${Date.now()}`,
						},
					])
				: 404;
	} catch (e) {
		console.error(e);
		return 500;
	}
}

async function manageEntries(json) {
	const method = json["method"];
	const entryId = json["id"];
	const service = json["service"];

	const content = json["content"] ? json["content"] : null;
	const comment = json["comment"] ? json["comment"] : false;
	console.log(entryId, service, method, content, comment);
	switch (method) {
		case "delete":
			return await deleteEntry(entryId, service, comment);
		case "edit":
			return await editEntry(entryId, service, content, comment);
		case "reply":
			return await replyEntry(entryId, content);
		case "hide":
			return await hideEntry(entryId);
		case "approve":
			return await approveEntry(entryId);
	}
}

async function deleteEntry(id, service, comment) {
	const servic = service;
	try {
		console.log(id, service, comment);
		comment === false
			? db.prepare(`DELETE FROM ${servic} WHERE entryId = ?`).run(id)
			: db
					.prepare(`UPDATE ${servic} SET comment = null WHERE entryId = ?`)
					.run(id);
	} catch (e) {
		console.error(e);
	}
}

async function editEntry(id, service, content, comment) {
	const servic = service
	try {
		db.prepare(`UPDATE ${servic} SET ${comment === false ? "content" : "comment"} = ? WHERE entryId = ?`).run(
			
			content,
			id,
		);
	} catch (e) {
		console.error(e);
	}
}

async function replyEntry(id, content) {
	try {
		db.prepare(`UPDATE entries SET comment = ? WHERE entryId = ?`).run(
			content,
			id,
		);
	} catch (e) {
		console.error(e);
	}
}

async function hideEntry(id) {
	try {
		db.prepare(`UPDATE entries SET hidden = NOT hidden WHERE entryId = ?`).run(
			id,
		);
	} catch (e) {
		console.error(e);
	}
}

async function approveEntry(id) {
	try {
		db.prepare(
			`INSERT INTO entries SELECT * FROM queue WHERE entryId = ?;`,
		).run(id);
		db.prepare(`DELETE FROM queue WHERE entryId = ?;`).run(id);
	} catch (e) {
		console.error(e);
	}
}

module.exports = app;
