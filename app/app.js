const express = require("express"),
	app = express();
const path = require("path");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/guestbook", require("../guestbook.js"));
app.use(express.static(path.join(__dirname, "../public/")));

app.listen(5000, () => console.log(`meow`));
