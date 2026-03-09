const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const app = express();
const rateLimit = require("express-rate-limit").rateLimit;
const db = new Database("./guestbook.db");
app.use("/admin", require("./admin"));

const limiter = rateLimit({
	windowMs: 300 * 1000,
	limit: 5,
});

db.exec(
	`CREATE TABLE IF NOT EXISTS entries (
    name TEXT, content TEXT, entryId INT, comment TEXT, hidden BOOLEAN, epoch TEXT);
    CREATE TABLE IF NOT EXISTS status (
    name TEXT UNIQUE, status BOOLEAN, int INTEGER, text TEXT);
    INSERT OR IGNORE INTO status (name, status)
    VALUES ('disabled', 0), ('readonly', 0), ('approval', 0), ('hidden', 0); INSERT OR IGNORE INTO status (name, int) VALUES ('posts', 0);
    CREATE TABLE IF NOT EXISTS queue (
    name TEXT, content TEXT, entryId INT, comment TEXT, hidden BOOLEAN, epoch TEXT);`,
);

// db.exec(`DELETE FROM entries; UPDATE status SET int=0 WHERE name='posts'`)
// ^^ getting rid of stuff during testing

// disabled -> Mo entries (posts) get shown
// readonly -> New entries aren't accepted, existing entries are still sent
// approval -> new guestbook entries require approval

// SELECT * FROM queue;
// INSERT INTO entries SELECT * FROM queue WHERE entryId=v; DELETE FROM queue WHERE entryId=v

const guestbookIsDisabled =
	db.prepare(`SELECT status FROM status WHERE name='disabled'`).get().status ===
	0
		? false
		: true;

const guestbookIsReadonly =
	db.prepare(`SELECT status FROM status WHERE name='readonly'`).get().status ===
	0
		? false
		: true;

const guestbookRequiresApproval =
	db.prepare(`SELECT status FROM status WHERE name='approval'`).get().status ===
	0
		? false
		: true;

function guestbookStatus(n) {
	return db.prepare(`SELECT status FROM status WHERE name='${n}'`).get().status === 1
}

console.log(guestbookStatus("approval"));
// console.log(db.prepare(`SELECT status FROM status WHERE name='approval'`).get().status === 0);

const maxPageEntries = 15;
const maxNameLength = 50;
const maxContentLength = 200;

app.get("/status", async (req, res) => {
	let json = {}
	const prep = db.prepare(`SELECT name, status FROM status WHERE name IS NOT 'posts'`).all(); 
	for (bool in prep) {
		if (prep[bool].status != 0) {json[prep[bool].name]=prep[bool].status}
	}
	if (Object.keys(json).length) {
		res.json(json)
	} else {
		res.json({ "normal": 1 })
	}
})

app.post("/", async (req, res) => {
	if (!(await guestbookStatus("hidden"))&& !(await guestbookStatus("disabled"))) {
		const getEntries = await getGuestbookEntries(req.body["page"] - 1);

		console.log(getEntries);
		if (parseInt(getEntries)) {
			res.sendStatus(getEntries);
		} else {
			res.send(getEntries);
		}
	} else {
		res.json([
			{
				name: "Guestbook unavailable",
				content: guestbookStatus('disabled') == false ? "Guestbook posts are currently hidden. Submitted posts will be queued." : "Guestbook is currently disabled. Posts are not shown and can not be submitted.",
				entryId: "1",
				epoch: `${Date.now()}`,
			},
		]);
	}
});
console.log();

app.put("/", limiter, async (req, res) => {
	if (
		!(await guestbookStatus("disabled")) &&
		!(await guestbookStatus("readonly"))
	) {
		if (req.body["content"]) {
			try {
				const addEntry = await addEntryToGuestbook(
					req.body["name"],
					req.body["content"],
					Date.now(),
				);
				switch (addEntry) {
					case 0:
						res.status(500).send();

					case 1:
						res.status(201).send();

					case 2:
						res.status(202).send();
					case 3:
						res.status(413).send();
				}
			} catch (e) {
				res.status(500).send();
			}
		} else {
			res.status(400).send();
		}
	} else {
		if (guestbookStatus("disabled")) {
			res.status(403).send({ disabled: 1 });
		} else if (guestbookStatus("readonly")) {
			res.status(403).send({ readonly: 1 });
		} else {
			res.sendStatus(403);
		}
	}
});
console.log(
	db.prepare("SELECT COUNT(*) FROM entries WHERE hidden=0").get()["COUNT(*)"] %
		maxPageEntries,
);

async function getGuestbookEntries(page) {
	try {
		const entries = db
			.prepare(
				`SELECT name, content, entryId, epoch, comment FROM entries WHERE hidden = 0 ORDER BY entryId DESC LIMIT 15 OFFSET ? `,
			)
			.all(page * maxPageEntries);
		console.log(entries);
		return entries[0]
			? entries
			: page == 0
				? JSON.stringify([
						{
							name: "guestbook",
							content: "there arent any entries in this guestbook yet!",
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

function getGuestbookEntryCount() {
	return db.prepare(`SELECT int FROM status WHERE name='posts'`).get().int;
}

async function addEntryToGuestbook(name, content, epoch) {
	try {
		if (name.length < maxNameLength && content.length < maxContentLength) {
			db.prepare(
				`INSERT INTO ${guestbookStatus("approval") === false ? guestbookStatus("hidden") === false ? "entries" : "queue" : "queue"} VALUES (?, ?, ?, ?, ?, ?)`,
			).run(name, content, getGuestbookEntryCount(), null, 0, epoch);
			db.prepare(`UPDATE status SET int = int + 1 WHERE name='posts'`).run();
			return guestbookStatus("approval") === false ? 1 : 2;
		} else {
			return 3;
		}
	} catch (e) {
		console.error(e);
		return 0;
	}
}

module.exports = app;

// guestbook-wall, guestbook-entry, guestbook-entry-info, guestbook-entry-content, guestbook-entry-comment, guestbook-entry-comment-info, guestbook-entry-comment-content
