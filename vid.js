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

function getTextColor(bgColorInt) {
    const r = (bgColorInt >> 16) & 0xFF;
    const g = (bgColorInt >> 8) & 0xFF;
    const b = bgColorInt & 0xFF;

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return Math.floor(brightness) > 128 ? '0, 0, 0' : '255, 255, 255';
}

function genvID(id, profilePath, username, color, date) {
    const textColor = getTextColor(color);
    const keywords = ['username', 'color', 'color-brighter', 'profile', 'id', 'date', 'text-color-main', 'text-color-h1', 'text-color-id',
                     'invert'];
    const replacements = [username, `#${color.toString(16).padStart(6, '0')}`, `#${bright(color, 2).toString(16).padStart(6, '0')}`,
                          profilePath, id.toString(), date, `rgba(${textColor}, 0.90)`, `rgba(${textColor}, 0.80)`,
                          `rgba(${textColor}, 0.60)`, textColor === '0, 0, 0' ? 'filter: invert(1);' : ''];
    try {
        let t = fs.readFileSync('./pages/vid.html', 'utf-8'); // Template
        for(const [i, word] of keywords.entries()) {
            t = t.replaceAll(`{{${word}}}`, replacements[i]);
        }
        return t;
    } catch(e) { logError(e); }
}

module.exports = { genvID };
