const fs = require('fs');
const path = require('path');
const { logError } = require('./logging.js');

function bright(color, factor = 1.2) {
    let r = (color >> 16) & 0xFF;
    let g = (color >> 8) & 0xFF;
    let b = color & 0xFF;

    r = Math.min(255, Math.floor(r * factor));
    g = Math.min(255, Math.floor(g * factor));
    b = Math.min(255, Math.floor(b * factor));

    return (r << 16) | (g << 8) | b;
}

function genvID(id, profilePath, username, color, date) {
    const keywords = ['username', 'color', 'color-brighter', 'profile', 'id', 'date' ];
    const replacements = [ username, `#${color.toString(16).padStart(6, '0')}`, `#${bright(color, 2).toString(16).padStart(6, '0')}`,
                           profilePath, id.toString(), date ];
    try {
        let t = fs.readFileSync('./pages/vid.html', 'utf-8'); // Template
        for(const [i, word] of keywords.entries()) {
            t = t.replaceAll(`{{${word}}}`, replacements[i]);
        }
        return t;
    } catch(e) { logError(e); }
}

module.exports = { genvID };
