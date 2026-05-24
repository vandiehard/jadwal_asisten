const Tesseract = require('tesseract.js');
const path = 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/05c6b6d9-9b68-485c-881d-e3295dc0bfaa/media__1779655538915.png';
const path2 = 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/05c6b6d9-9b68-485c-881d-e3295dc0bfaa/media__1779656881716.png';

async function run() {
    console.log("--- OCR IMAGE 1 (Diptarama) ---");
    const res1 = await Tesseract.recognize(path, 'eng');
    console.log(res1.data.text);
    
    console.log("\n\n--- OCR IMAGE 3 (Dimas) ---");
    const res2 = await Tesseract.recognize(path2, 'eng');
    console.log(res2.data.text);
}

run().catch(console.error);
