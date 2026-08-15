const { fromPath } = require("pdf2pic");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

async function extractTextOCR(pdfPath) {

    // Create temp folder safely
    const tempDir = path.join(__dirname, "..", "temp");

    fs.mkdirSync(tempDir, { recursive: true });

    const convert = fromPath(pdfPath, {
        density: 200,
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
        width: 1500,
        height: 2000
    });

    console.log("Starting OCR...");

    const page = await convert(1);

    console.log("OCR image created:", page.path);

    const result = await Tesseract.recognize(
        page.path,
        "eng"
    );

    const text = result.data.text;

    console.log("OCR extracted text length:", text.length);

    // Delete temporary image
    try {
        if (page.path && fs.existsSync(page.path)) {
            fs.unlinkSync(page.path);
        }
    } catch (err) {
        console.log("Could not delete OCR temp file:", err.message);
    }

    return text;
}

module.exports = {
    extractTextOCR
};