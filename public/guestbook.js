const entryForm = document.getElementById("guestbook-entry-form");
const guestbookWall = document.getElementById("guestbook-wall");
const entryName = document.getElementById("name-input");
const entryContent = document.getElementById("entry-input");
const entrySubmit = document.getElementById("guestbook-input-submit");
const maxPostCount = 15;
const guestbookServicePath = "/services/guestbook";
let currentPage = 1;
const commentName='comment'

entryForm.addEventListener("submit", function (event) {
	event.preventDefault();
	const entryFormData = new FormData(entryForm);
	const entryName = entryFormData.get("name") || "anonymous";
	const entryContentText = entryFormData.get("content");

	submitGuestbookEntry(entryName, entryContentText);
});

async function submitGuestbookEntry(name, content) {
	const entryJson = JSON.stringify({ name: name, content: content });
	fetch(guestbookServicePath, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: entryJson,
	}).then((response) => {
		if (response.ok) {
			console.log("ya"); // MAKE THE BUTTON CHANGE !!
			entrySubmit.value = "submitted";
			setTimeout(() => {
				getGuestbookEntries(currentPage);
				entrySubmit.value = "submit";
			}, 1000);
		} else {
			console.log("na"); // MAKE THE BUTTON CHANGE AS WELL !!!
		}
	});
}

function deleteGuestbookEntry(page, int, entryId) {
	// const entryid =
	// 	entryId < 15 && int != +1
	// 		? entryId
	// 		: int == +1
	// 			? entryId + maxPostCount
	// 			: entryId - maxPostCount;
	// console.log(entryid, "meow");
	try {
		const meow = document.querySelectorAll(`div[data-entryid]`);
		meow.forEach((elem) => {
			elem.remove();
		});
	} catch (e) {}
}

async function getGuestbookEntries(page, int) {
	try {
		const response = await fetch(guestbookServicePath, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ page: page }),
		});
		if (response.ok) {
			document.getElementById('gb-page-counter').innerText = currentPage
			const entryData = (await response.json()).reverse();

			if (entryData != {}) {
				deleteGuestbookEntry();

				for (entry in entryData) {
					n = entry;
					entry = entryData[entry];

					buildGuestbookEntry(
						entry.name,
						entry.content,
						entry.entryId,
						parseInt(entry.epoch),
						entry.comment,
					);
				}
			} else {
				console.log("no");
			}
			console.log(entryData);
		} else {
			console.error();
			console.log(response.status);
			return response.body;
		}
	} catch (e) {
		console.error("whoops!", e);
	}
}

async function incrementPage(int) {
	if ((currentPage == 1 && int != -1) || currentPage > 1) {
		console.log("ya");
			const response = await fetch(guestbookServicePath, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ page: currentPage + 1 }),
			})
			console.log(response.status)
			if (response.status == 200) { int == '+1' ? currentPage++ : currentPage--;
				getGuestbookEntries(currentPage, int);
			} else {
				if (int === -1) {
					int == '+1' ? currentPage++ : currentPage--;
					getGuestbookEntries(currentPage, int); 
				}
			}
	} else {
		console.log("na");
	}
}

function buildGuestbookEntry(name, content, entryId, epoch, comment = null) {
	// console.log(name, content, entryId, epoch, comment);
	const classes = {
		entry: "guestbook-entry",
		entryName: "guestbook-entry-info",
		dateId: "guestbook-entry-timestamp",
		content: "guestbook-entry-content",
				comment_entry: "guestbook-comment",
		comment_name: "guestbook-comment-name"
	};
	const entry = Object.assign(document.createElement("div"), {
		className: classes.entry,
	});
	entry.setAttribute(`data-entryId`, entryId);
	const entryName = Object.assign(document.createElement("div"), {
		className: classes.entryName,
		innerText: name,
	});
	const entryDateId = Object.assign(document.createElement("div"), {
		className: classes.dateId,
		innerText: `${entryId} | ${new Date(epoch).toLocaleDateString()}`,
		title: `ID: ${entryId} | POSTED: ${new Date(epoch).toDateString()}`
	});
	const entryContent = Object.assign(document.createElement("div"), {
		className: classes.content,
		innerText: content,
	});


	// const entryCommentInfo = Object.assign(document.createElement("div"), {className: classes.comment_info})

	entry.appendChild(entryName);
	entry.appendChild(entryDateId);
	entry.appendChild(entryContent);
		if (comment) {
		const entryComment = Object.assign(document.createElement("div"), {
			className: classes.comment_entry
		});
		const entryCommentName = Object.assign(document.createElement("div"), {
			className: classes.comment_name, innerText: commentName
		});
		const entryCommentContent = Object.assign(document.createElement("div"), {innerText: comment});
		entryComment.appendChild(entryCommentName);entryComment.appendChild(entryCommentContent);entry.appendChild(entryComment)
	}
	guestbookWall.insertBefore(entry, guestbookWall.firstChild);
}

async function getGuestbookStatus() {
	const guestbookStatusPath = "/services/guestbook/status";
	const response = await fetch(guestbookStatusPath)
	const statusDiv = document.getElementById("guestbook-status")
	const jsonResponse = await response.json()
	if (!jsonResponse['normal']) {
		console.log('OH NO')
			if (jsonResponse["approval"]) {
				statusDiv.innerText = 'New entries currently require approval, and will be sent into a queue upon submission.'}
			else if (jsonResponse["readonly"]) {
				statusDiv.innerText = 'Guestbook is currently read-only and new entries cannot be submitted.'
			}

		
	}
}

document.addEventListener("DOMContentLoaded", getGuestbookEntries(currentPage), getGuestbookStatus());
