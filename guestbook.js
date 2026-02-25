const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const rateLimit = require("express-rate-limit").rateLimit;
const db = new Database("./guestbook.db");

const limiter = rateLimit({
	windowMs: 0 * 1000,
	limit: 3,
});

db.exec(
	`CREATE TABLE IF NOT EXISTS entries (
    name TEXT, content TEXT, entryId INT, comment TEXT, hidden BOOLEAN, epoch TEXT);
    CREATE TABLE IF NOT EXISTS status (
    name TEXT UNIQUE, status BOOLEAN, int INTEGER, text TEXT);
    INSERT OR IGNORE INTO status (name, status)
    VALUES ('disabled', 0), ('readonly', 0), ('approval', 0); INSERT OR IGNORE INTO status (name, int) VALUES ('posts', 0);
    CREATE TABLE IF NOT EXISTS queue (
    name TEXT, content TEXT, entryId INT, comment TEXT, hidden BOOLEAN, epoch TEXT);`,
);

// disabled -> Mo entries (posts) get shown
// readonly -> New entries aren't accepted, existing entries are still sent
// approval -> new guestbook entries require approval

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

console.log(guestbookIsDisabled, guestbookIsReadonly);

app.get("/", async (req, res) => {
	if (!guestbookIsDisabled) {
		const getEntries = await getGuestbookEntries(0, 15);
		if (getEntries === 500) {
			res.status(500).send();
		}
		res.send(getEntries);
	} else {
		res.status(403).send({ disabled: 1 });
	}
});
console.log();

app.post("/", limiter, async (req, res) => {
	if (!guestbookIsDisabled && !guestbookIsReadonly) {
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
				}
			} catch (e) {
				res.status(500).send();
			}
		} else {
			res.status(400).send();
		}
	} else {
		if (guestbookIsDisabled) {
			res.status(403).send({ disabled: 1 });
		} else if (guestbookIsReadonly) {
			res.status(403).send({ readonly: 1 });
		} else {
			res.sendStatus(403);
		}
	}
});

async function getGuestbookEntries(start, end) {
	try {
		const entries = db
			.prepare(`SELECT * FROM entries WHERE entryId BETWEEN ? AND ?`)
			.all(start, end);
		console.log(entries);
		return entries;
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
		db.prepare(
			`INSERT INTO ${guestbookRequiresApproval === false ? "entries" : "queue"} VALUES (?, ?, ?, ?, ?, ?)`,
		).run(name, content, getGuestbookEntryCount(), null, 0, epoch);
		db.prepare(`UPDATE status SET int = int + 1 WHERE name='posts'`).run();
		return guestbookRequiresApproval === false ? 1 : 2;
	} catch (e) {
		console.error(e);
		return 0;
	}
}

module.exports = app;

// guestbook-wall, guestbook-entry, guestbook-entry-info, guestbook-entry-content, guestbook-entry-comment, guestbook-entry-comment-info, guestbook-entry-comment-content
