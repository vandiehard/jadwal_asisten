const Tesseract = require('tesseract.js');
const fs = require('fs');

async function run() {
    console.log("--- OCR EXACT UPLOADED IMAGE ---");
    const { data: { text } } = await Tesseract.recognize('./uploads/7db555a5614d4c46c4543952ebb5fe9d', 'eng');
    console.log("RAW TEXT:\n" + text);
    
    console.log("\n--- REGEX MATCHES ---");
    const results = [];
    const lines = text.split('\n');
    let currentDay = null;

    for (const line of lines) {
        const dayMatch = line.match(/(senin|selasa|rabu|kamis|jumat|sabtu|minggu)/i);
        if (dayMatch) {
            const rawDay = dayMatch[1];
            currentDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
        }

        const shiftMatches = line.match(/(?<!\d)(?:[1-9]|1[0-4])(?:\s*\/\s*(?:[1-9]|1[0-4]))+(?!\d)/g);
        if (shiftMatches && shiftMatches.length > 0) {
            shiftMatches.forEach(shiftStr => {
                results.push({
                    hari: currentDay || 'Senin',
                    stringKRS: shiftStr.replace(/\s+/g, '')
                });
            });
        }
    }
    console.log("RESULTS:\n", results);
}

run().catch(console.error);
