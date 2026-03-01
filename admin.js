const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const app = express();
const rateLimit = require("express-rate-limit").rateLimit;
const db = new Database("./guestbook.db");
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const adminPass = 'meow';

const cookieValidation = (req, res, next) => {
	try {if (req.cookies.admin, req.cookies.admin == adminPass) {
		next();
	} else {
		res.sendFile(path.join(__dirname, "./admin/auth.html"))
	}} catch (e) {res.sendFile(path.join(__dirname, "./admin/auth.html"));console.log(e)}
};
app.use('/', cookieValidation, express.static(path.join(__dirname, './admin/')))

module.exports = app