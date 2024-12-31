const express = require('express');
const app = express();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { logInfo, logError, logWarning, logSuccess } = require('./logging.js');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { initAccountData, createNewAccountDataFolder, getProfilePicturePath } = require('./accontDataManagement.js');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
require('dotenv').config();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());
app.use(cors());

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

function getUsernameFromToken(token) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM tokens WHERE token = ?', [token], (err, rows) => {
            if (err) {
                logError("Failed to get username from token: " + err.message);
                reject(null);
            }

            const sqlToken = rows[0];
            if (rows.length === 0 || sqlToken === undefined) {
                resolve(null);
            } else {
                db.all('SELECT * FROM accounts WHERE id = ?', [sqlToken.account_id], (err, rows) => {
                    if(err) {
                        logError("Failed to get account: " + err.message);
                        reject(null);
                    }

                    const account = rows[0];
                    resolve(account.username);
                });
            }
        });
    });
}

function getAccountIDFromToken(token) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM tokens WHERE token = ?', [token], (err, rows) => {
            if (err) {
                logError("Failed to get account ID from token: " + err.message);
                reject(null);
            }

            const sqlToken = rows[0];

            resolve((rows.length === 0 || sqlToken === undefined) ? null : sqlToken.account_id);
        });
    });
}

// Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        getAccountIDFromToken(req.cookies.token).then(accountID => {
            if (!accountID) {
                return cb(new Error('Account ID is missing.'));
            }

            const accountDir = `./accountData/${accountID}`;
            if (!fs.existsSync(accountDir)) {
                fs.mkdirSync(accountDir, { recursive: true });
            }

            cb(null, accountDir);
        });
    },
    filename: (req, file, cb) => {
        cb(null, 'profile-temp');
    },
});
const upload = multer({ storage });

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

app.get('/accountsettings', (req, res) => {
    if(req.cookies.token === undefined || !isValidToken(req.cookies.token)) {
        res.redirect('/login');
        return;
    }

    res.sendFile(path.join(__dirname, 'pages', 'accountsettings.html'));
});

// Better code (The API. Well, technically the code above is also part of the API but it's... something else.)
app.post('/deleteaccount', async (req, res) => {
    // Get the user ID
    const token = req.body.token;
    const accountID = await getAccountIDFromToken(token);

    if(!accountID) {
        logError("Failed to get account ID");
        const response = {
            successful: false,
            error: "Bad/missing token"
        };
        res.status(500).json(response);
        return;
    }

    // Delete the account
    db.run('DELETE FROM accounts WHERE id = ?', [accountID], (err) => {
        if(err) {
            logError("Failed to delete account: " + err.message);
            const response = {
                successful: false,
                error: "Failed to delete account"
            };
            res.status(500).json(response);
            return;
        }

        db.run('DELETE FROM tokens WHERE account_id = ?', [accountID], (err) => {
            if(err) {
                logError("Failed to delete tokens: " + err.message);
                const response = {
                    successful: false,
                    error: "Failed to delete account"
                };
                res.status(500).json(response);
                return;
            }

            const accountDir = path.join(__dirname, 'accountData', accountID.toString());
            if(fs.existsSync(accountDir)) {
                fs.rmSync(accountDir, { recursive: true, force: true });
            }

            const response = {
                successful: true
            }
            res.json(response);
        });
    });
});

app.post('/getaccountid', async (req, res) => {
    if(!req.body.token) {
        logWarning("Missing required fields");
        const response = {
            successful: false,
            error: "Missing required fields"
        };
        res.json(response);
        return;
    }

    const token = req.body.token;

    if(!await isValidToken(token)) {
        logWarning("Invalid token");
        const response = {
            successful: false,
            error: "Invalid token"
        };
        res.json(response);
        return;
    }

    const accountID = await getAccountIDFromToken(token);
    if(!accountID) {
        logError("Failed to get account ID");
        const response = {
            successful: false,
            error: "Failed to get account ID"
        };
        res.json(response);
        return;
    }

    logSuccess("Account ID retrieved successfully");
    const response = {
        successful: true,
        accountID: accountID
    };
    res.json(response);
});

app.post('/uploadprofilepicture', upload.single('file'), async (req, res) => {
    const token = req.cookies.token;

    const accountID = await getAccountIDFromToken(token);
    if(!token || !accountID) {
        const errResponse = {
            successful: false,
            error: "Bad/missing token"
        }
        res.status(500).json(errResponse);
        return;
    }

    try {
        const tempFilePath = path.join(req.file.destination, req.file.filename);
        const outputPath = path.join(req.file.destination, 'profile.png');

        await sharp(tempFilePath).toFormat('png').resize(200, 200).toFile(outputPath);
        fs.unlinkSync(tempFilePath);

        const response = {
            successful: true
        };
        res.json(response);
    } catch(err) {
        logError('Cound not update profile picture: ' + err.message);
        const response = {
            successful: false,
            error: "Failed to update profile picture"
        };
        res.status(500).json(response);
    }
});

app.get('/getusername/:id', (req, res) => {
    if(!req.params.id) {
        logWarning("Missing required fields");
        const errResponse = {
            successful: false,
            error: "Missing required fields"
        }
        res.status(500).json(errResponse);
        return;
    }
    
    db.all('SELECT * FROM accounts WHERE id = ?', [req.params.id], (err, rows) => {
        if(err) {
            logError("Failed to get username: " + err.message);
            const response = {
                successful: false,
                error: "Failed to get username"
            };
            res.status(500).json(response);
            return;
        }

        if(rows.length === 0) {
            logWarning("Account not found for ID: " + req.params.id);
            const response = {
                successful: false,
                error: "Account not found"
            };
            res.status(500).json(response);
            return;
        }

        const response = {
            successful: true,
            username: rows[0].username
        };
        res.json(response);
    });
});

app.get('/getprofile/:id', (req, res) => {
    const id = req.params.id;
    if(id === 'default') {
        if(!fs.existsSync(path.join(__dirname, 'defaultData', 'profile.png'))) {
            res.status(404).send("Profile picture not found");
            return;
        }
        res.sendFile(path.join(__dirname, 'defaultData', 'profile.png'));
        return;
    }

    if(!fs.existsSync(path.join(__dirname, 'accountData', id, 'profile.png'))) {
        // Send the default profile picture by... default
        if(!fs.existsSync(path.join(__dirname, 'defaultData', 'profile.png'))) {
            res.status(404).send("Profile picture not found");
            return;
        }
        res.sendFile(path.join(__dirname, 'defaultData', 'profile.png'));
        return;
    }
    res.sendFile(path.join(__dirname, 'accountData', id, 'profile.png'));
});

app.post('/getprofilepicturelink', async (req, res) => {
    if(!req.body.token) {
        logWarning("Missing required fields");
        const response = {
            successful: false,
            error: "Missing required fields"
        };
        res.status(500).json(response);
        return;
    }

    if(!isValidToken(req.body.token)) {
        logWarning("Invalid token");
        const response = {
            successful: false,
            error: "Invalid token"
        };
        res.status(500).json(response);
        return;
    }

    const id = await getAccountIDFromToken(req.body.token);
    if(!id) {
        logError("Failed to get account ID");
        const response = {
            successful: false,
            error: "Failed to get profile picture link"
        };
        res.status(500).json(response);
        return;
    }

    const profilePicturePath = getProfilePicturePath(id);
    if(!profilePicturePath) {
        logError("Failed to get profile picture link");
        const response = {
            successful: false,
            error: "Failed to get profile picture link"
        };
        res.status(500).json(response);
        return;
    }

    const response = {
        successful: true,
        link: profilePicturePath
    };
    res.json(response);
});

app.post('/getusername', async (req, res) => {
    if(!req.body.token) {
        logWarning("Missing required fields");
        const response = {
            successful: false,
            error: "Missing required fields"
        };
        res.json(response);
        return;
    }
    const token = req.body.token;

    if(!await isValidToken(token)) {
        logWarning("Invalid token");
        const response = {
            successful: false,
            error: "Invalid token"
        };
        res.json(response);
        return;
    }

    const username = await getUsernameFromToken(token);
    if(!username) {
        logError("Failed to get username");
        const response = {
            successful: false,
            error: "Failed to get username"
        };
        res.json(response);
        return;
    }

    logSuccess("Username retrieved successfully");
    const response = {
        successful: true,
        username: username
    };
    res.json(response);
});

app.post('/updatepassword', (req, res) => {
    if (!req.body.oldPassword || !req.body.newPassword || !req.body.token) {
        logWarning("Missing required fields");
        const response = {
            successful: false,
            error: "Missing required fields"
        };
        res.json(response);
        return;
    }

    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    const token = req.body.token;

    if(!isValidToken(token)) {
        logWarning("Invalid token");
        const response = {
            successful: false,
            error: "Invalid token"
        };
        res.json(response);
        return;
    }

    db.all('SELECT * FROM tokens WHERE token = ?', [token], (err, rows) => {
        if(err) {
            logError("Failed to get token: " + err.message);
            const response = {
                successful: false,
                error: "Failed to update password"
            };
            res.json(response);
            return;
        }

        const sqlToken = rows[0];
        db.all('SELECT * FROM accounts WHERE id = ?', [sqlToken.account_id], (err, rows) => {
            if(err) {
                logError("Failed to get account: " + err.message);
                const response = {
                    successful: false,
                    error: "Failed to update password"
                };
                res.json(response);
                return;
            }

            const account = rows[0];
            if(!(bcrypt.compareSync(oldPassword + account.salt, account.password))) {
                logWarning("Incorrect old password");
                const response = {
                    successful: false,
                    error: "Incorrect old password"
                };
                res.json(response);
                return;
            }

            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = bcrypt.hashSync(newPassword + salt, 10);

            db.run('UPDATE accounts SET password = ?, salt = ? WHERE id = ?', [hashedPassword, salt, account.id], (err) => {
                if(err) {
                    logError("Failed to update password: " + err.message);
                    const response = {
                        successful: false,
                        error: "Failed to update password"
                    };
                    res.json(response);
                    return;
                }

                logSuccess("Password updated successfully");
                const response = {
                    successful: true
                };
                res.json(response);
            });
        });
    });
});

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

                db.all('SELECT * FROM accounts WHERE username = ?', [username], (err, rows) => {
                    if(err) {
                        logError("Failed to get account: " + err.message);
                        const response = {
                            successful: false,
                            error: "Failed to create account"
                        };
                        res.json(response);
                        return;
                    }

                    createNewAccountDataFolder(rows[0].id);
                    logSuccess("Account created successfully");
                    const response = {
                        successful: true
                    };
                    res.json(response);
                });
            });
        }
    });
});

// Initialization
// Oh and the storage is on the top of the file
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

        initAccountData(db);
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
