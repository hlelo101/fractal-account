// Nothing fancy, just here to add that [INFO], [ERROR], etc.

function logInfo(message) {
    console.log('\u001b[34m[INFO]\u001b[0m: ' + message);
}

function logError(message) {
    console.error('\u001b[31m[ERROR]\u001b[0m: ' + message);
}

function logWarning(message) {
    console.warn('\u001b[33m[WARNING]\u001b[0m: ' + message);
}

function logSuccess(message) {
    console.log('\u001b[32m[SUCCESS]\u001b[0m: ' + message);
}

module.exports = { logInfo, logError, logWarning, logSuccess };