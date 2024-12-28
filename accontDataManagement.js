const fs = require('fs');
const { logInfo, logError, logWarning, logSuccess } = require('./logging.js');
const sqlite3 = require('sqlite3').verbose();

// Initialize folders, etc.
async function initAccountData(dbConnection) {
    if (!fs.existsSync('./accountData')) {
        logWarning('Account data folder not found, creating...');
        fs.mkdirSync('./accountData');
    }

    dbConnection.all('SELECT * FROM accounts', (err, rows) => {
        if(err) {
            logError('Failed to get accounts from database: ' + err);
            return;
        }

        rows.forEach(row => {
            if (!fs.existsSync('./accountData/' + row.id)) {
                logWarning('Account folder not found, creating...');
                fs.mkdirSync('./accountData/' + row.id);
            }
        });
    });
}

function createNewAccountDataFolder(id) {
    if(!fs.existsSync('./accountData/' + id)) {
        fs.mkdirSync('./accountData/' + id);
    }
}

function getProfilePicturePath(id) {
    if(fs.existsSync('accountData/' + id + '/profile.png')) {
        return '/getprofile/' + id;
    } else {
        return '/getprofile/default';
    }
}

module.exports = { initAccountData, createNewAccountDataFolder, getProfilePicturePath };