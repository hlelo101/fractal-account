const express = require('express');
const app = express();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { logInfo, logError, logWarning, logSuccess } = require('./logging.js');
require('dotenv').config();
const validator = require('validator');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// TODO: Add some good fucking sanitization because right now anyone looking at this immediatly gets the urge to try a SQL injection on this fucking piece of shi-

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function isValidToken(token) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM tokens WHERE token = ?', [token], (err, rows) => {
            if (err) {
                logError("Failed to check token: " + err.message);
                reject(false);
            }

            const sqlToken = rows[0];
            if (rows.length === 0 || sqlToken === undefined) {
                resolve(false);
            } else {
                if(sqlToken.expiration_date < new Date().toISOString()) {
                    // Remove expired token
                    db.run('DELETE FROM tokens WHERE token = ?', [sqlToken.token], (err) => {
                        if (err) logError("Failed to delete expired token: " + err.message);
                    });
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        });
    });
}

// Ugly code :(
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'links.html'));
});

app.get('/createaccount', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'accountcreation.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/tokenchecker', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'checktoken.html'));
});

// Better code
app.post('/checktoken', async (req, res) => {
    const token = req.body.token;

    if(await isValidToken(token)) {
        logSuccess("Token is valid");

        const response = {
            successful: true,
            valid: true
        };
        res.json(response);
    } else {
        logWarning("Token is invalid");

        const response = {
            successful: true,
            valid: false
        };
        res.json(response);
    }
});

app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    db.all('SELECT * FROM accounts WHERE username = ?', [username], (err, rows) => {
        if (err) {
            logError("Failed to get account: " + err.message);
            const response = {
                successful: false,
                error: "Failed to login"
            };
            res.json(response);
            return;
        }

        if (rows.length === 0) {
            logWarning("Account does not exist");
            const response = {
                successful: false,
                error: "Account does not exist"
            };
            res.json(response);
            return;
        }

        const account = rows[0];

        if(!(bcrypt.compareSync(password + account.salt, account.password))) {
            logWarning("Incorrect password");
            const response = {
                successful: false,
                error: "Incorrect password"
            };
            res.json(response);
            return;
        }

        // Save the token
        const token = crypto.randomBytes(20).toString('hex');
        const expiration_date = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        db.run('INSERT INTO tokens (token, account_id, expiration_date) VALUES (?, ?, ?)', [token, account.id, expiration_date], (err) => {
            if(err) {
                logError("Failed to save token: " + err.message);
                const response = {
                    successful: false,
                    error: "Failed to save the token"
                };
                res.json(response);
                return;
            }

            logSuccess("Login successful, username: " + username);
            const response = {
                successful: true,
                token: token
            };
            res.json(response);
        });
    });
});

app.post('/register', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    logInfo('Password: ', password);

    // Check if account already exists
    db.all('SELECT * FROM accounts WHERE username = ?', [username], (err, rows) => {
        if (err) {
            logError("Failed to check if account exists: " + err.message);
            const response = {
                successful: false,
                error: "Failed to create account"
            };
            res.json(response);
            return;
        }

        if (rows.length > 0) {
            logWarning("Account already exists");
            const response = {
                successful: false,
                error: "Account already exists"
            };
            res.json(response);
            return;
        } else {
            logInfo("Creating account, username: " + username);

            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = bcrypt.hashSync(password + salt, 10);
        
            db.run('INSERT INTO accounts (username, password, salt) VALUES (?, ?, ?)', [username, hashedPassword, salt], (err) => {
                if (err) {
                    logError("Failed to create account: " + err.message);
                    const response = {
                        successful: false,
                        error: "Failed to create account"
                    };
                    res.json(response);
                    return;
                }

                logSuccess("Account created successfully");
                const response = {
                    successful: true
                };
                res.json(response);
            });
        }
    });
});

// Initialization
logInfo("Server started");
const db = new sqlite3.Database(path.join(__dirname, 'accounts.db'), (err) => {
    if (err) {
        logError("Failed to connect to the database: " + err.message);
        process.exit(1);
    }

    db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        salt TEXT NOT NULL
    )`, (err) => {
        if(err) {
            logError("Failed to create accounts table: " + err.message);
            process.exit(1);
        }

        db.run(`CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL,
            account_id INTEGER NOT NULL,
            expiration_date TEXT NOT NULL
        )`, (err) => {
            if(err) {
                logError("Failed to create tokens table: " + err.message);
                process.exit(1);
            }

            logSuccess("Database initialized");
        });
    });
});

setInterval(() => {
    db.run('DELETE FROM tokens WHERE expiration_date < ?', [new Date().toISOString()], (err) => {
        if(err) logError("Failed to delete expired tokens: " + err.message);
    });
}, 60 * 5000);

app.listen(process.env.PORT, () => {
    logInfo("Server is listening on port " + process.env.PORT);
});