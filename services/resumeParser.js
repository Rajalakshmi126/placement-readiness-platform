const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { extractTextOCR } = require("./ocr");

// =====================================================
// EXTRACT TEXT FROM FILE
// =====================================================

async function extractTextFromFile(filePath) {

    const ext = path.extname(filePath).toLowerCase();

    // =================================================
    // PDF
    // =================================================

    if (ext === ".pdf") {

        const buffer = fs.readFileSync(filePath);

        const data = await pdfParse(buffer);

        console.log("\n========== PDF DEBUG ==========");
        console.log("Pages:", data.numpages);
        console.log("Extracted text length:", data.text ? data.text.length : 0);
        console.log("Extracted text:");
        console.log(data.text);
        console.log("================================\n");

        // ---------------------------------------------
        // Normal text PDF
        // ---------------------------------------------

        if (data.text && data.text.trim().length >= 50) {

            console.log("PDF text extraction successful.");

            return data.text;
        }

        // ---------------------------------------------
        // Scanned PDF -> OCR
        // ---------------------------------------------

        console.log(
            "PDF contains little/no text. Starting OCR..."
        );

        const ocrText = await extractTextOCR(filePath);

        if (!ocrText || ocrText.trim().length < 20) {

            throw new Error(
                "Unable to extract text from this PDF, even with OCR."
            );
        }

        console.log("OCR extraction successful.");
        console.log("OCR text length:", ocrText.length);

        return ocrText;
    }

    // =================================================
    // DOCX
    // =================================================

    if (ext === ".docx") {

        console.log("\n========== DOCX EXTRACTION ==========");

        let extractedText = "";

        // ---------------------------------------------
        // First attempt: Mammoth
        // ---------------------------------------------

        try {

            const result = await mammoth.extractRawText({
                path: filePath
            });

            extractedText = result.value || "";

            console.log(
                "Mammoth extracted characters:",
                extractedText.length
            );

            console.log("\n---------- MAMMOTH TEXT ----------");
            console.log(extractedText);
            console.log("----------------------------------\n");

        } catch (error) {

            console.error(
                "Mammoth extraction error:",
                error.message
            );
        }

        // ---------------------------------------------
        // If Mammoth worked, use it
        // ---------------------------------------------

        if (extractedText.trim().length >= 20) {

            console.log(
                "DOCX extraction successful using Mammoth."
            );

            return extractedText;
        }

        // ---------------------------------------------
        // FALLBACK
        //
        // Some DOCX files contain text in structures
        // Mammoth doesn't expose correctly.
        //
        // Use PowerShell to extract the DOCX XML.
        // Windows already has PowerShell.
        // ---------------------------------------------

        console.log(
            "Mammoth extracted insufficient text."
        );

        console.log(
            "Starting DOCX XML fallback..."
        );

        try {

            const fallbackText =
                await extractDocxXmlText(filePath);

            console.log(
                "DOCX XML fallback text length:",
                fallbackText.length
            );

            console.log("\n---------- DOCX XML TEXT ----------");
            console.log(fallbackText);
            console.log("------------------------------------\n");

            if (fallbackText.trim().length >= 20) {

                console.log(
                    "DOCX extraction successful using XML fallback."
                );

                return fallbackText;
            }

        } catch (error) {

            console.error(
                "DOCX XML fallback failed:",
                error.message
            );
        }

        throw new Error(
            "DOCX text extraction failed. The document may contain scanned images or unsupported embedded content."
        );
    }

    // =================================================
    // DOC
    // =================================================

    if (ext === ".doc") {

        throw new Error(
            "Legacy .doc files are not supported directly. Please save the document as .docx and upload again."
        );
    }

    // =================================================
    // TXT
    // =================================================

    if (ext === ".txt") {

        console.log("TXT detected.");

        const text = fs.readFileSync(filePath, "utf8");

        if (!text || text.trim().length < 5) {

            throw new Error(
                "TXT file is empty."
            );
        }

        return text;
    }

    // =================================================
    // Unsupported
    // =================================================

    throw new Error(
        "Unsupported file format. Please upload PDF, DOCX, or TXT."
    );
}


// =====================================================
// DOCX XML FALLBACK
// =====================================================

function extractDocxXmlText(filePath) {

    return new Promise((resolve, reject) => {

        const absolutePath =
            path.resolve(filePath);

        /*
         * DOCX files are ZIP archives.
         *
         * We use PowerShell because you are running
         * this application on Windows.
         *
         * The command:
         *   1. Opens the DOCX as a ZIP
         *   2. Reads word/document.xml
         *   3. Extracts every <w:t>...</w:t>
         *   4. Converts XML entities
         */

        const psScript = `
$ErrorActionPreference = "Stop"

$zipPath = '${absolutePath.replace(/'/g, "''")}'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

try {

    $entry = $zip.GetEntry("word/document.xml")

    if ($null -eq $entry) {
        throw "word/document.xml was not found inside the DOCX file."
    }

    $reader = New-Object System.IO.StreamReader($entry.Open())

    try {
        $xml = $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }

}
finally {
    $zip.Dispose()
}

$matches = [regex]::Matches(
    $xml,
    '<w:t(?:\\\\s[^>]*)?>(.*?)</w:t>'
)

$result = New-Object System.Text.StringBuilder

foreach ($match in $matches) {

    $value = $match.Groups[1].Value

    $value = [System.Net.WebUtility]::HtmlDecode($value)

    [void]$result.Append($value)
    [void]$result.Append(" ")
}

$result.ToString()
`;

        const child = spawn(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                psScript
            ],
            {
                windowsHide: true
            }
        );

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", data => {
            stdout += data.toString();
        });

        child.stderr.on("data", data => {
            stderr += data.toString();
        });

        child.on("error", error => {
            reject(error);
        });

        child.on("close", code => {

            if (code !== 0) {

                reject(
                    new Error(
                        stderr ||
                        `PowerShell exited with code ${code}`
                    )
                );

                return;
            }

            resolve(stdout.trim());
        });
    });
}


// =====================================================
// RUN PYTHON SKILL EXTRACTOR
// =====================================================

function runSkillExtractor(text) {

    return new Promise((resolve, reject) => {

        const isWindows =
            process.platform === "win32";

        const pythonBin =
            process.env.PYTHON_BIN ||
            (isWindows ? "py" : "python3");

        const scriptPath = path.join(
            __dirname,
            "..",
            "python",
            "skill_extractor.py"
        );

        // ---------------------------------------------
        // Create temp directory
        // ---------------------------------------------

        const tempDir = path.join(
            __dirname,
            "..",
            "temp"
        );

        fs.mkdirSync(
            tempDir,
            { recursive: true }
        );

        // ---------------------------------------------
        // Create temporary text file
        // ---------------------------------------------

        const tempFile = path.join(
            tempDir,
            `resume_${Date.now()}.txt`
        );

        fs.writeFileSync(
            tempFile,
            text,
            "utf8"
        );

        console.log(
            "\n========== PYTHON SKILL EXTRACTOR =========="
        );

        console.log(
            "Python:",
            pythonBin
        );

        console.log(
            "Script:",
            scriptPath
        );

        console.log(
            "Input:",
            tempFile
        );

        console.log(
            "Text length:",
            text.length
        );

        console.log(
            "============================================\n"
        );

        // ---------------------------------------------
        // Run Python with FILE PATH
        //
        // IMPORTANT:
        // We are NOT using stdin anymore.
        // This avoids the EPIPE problem.
        // ---------------------------------------------

        const child = spawn(
            pythonBin,
            [
                scriptPath,
                tempFile
            ],
            {
                windowsHide: true
            }
        );

        let stdout = "";
        let stderr = "";

        child.stdout.on(
            "data",
            data => {
                stdout += data.toString();
            }
        );

        child.stderr.on(
            "data",
            data => {
                stderr += data.toString();
            }
        );

        child.on(
            "error",
            error => {

                console.error(
                    "Python process error:",
                    error
                );

                cleanupTempFile();

                reject(error);
            }
        );

        child.on(
            "close",
            code => {

                console.log(
                    "\n========== PYTHON RESULT =========="
                );

                console.log(
                    "Exit code:",
                    code
                );

                console.log(
                    "STDOUT:",
                    stdout
                );

                console.log(
                    "STDERR:",
                    stderr
                );

                console.log(
                    "===================================\n"
                );

                cleanupTempFile();

                if (code !== 0) {

                    reject(
                        new Error(
                            `skill_extractor.py exited with code ${code}\n` +
                            `${stderr || stdout}`
                        )
                    );

                    return;
                }

                try {

                    const result =
                        JSON.parse(
                            stdout.trim()
                        );

                    resolve(result);

                } catch (error) {

                    reject(
                        new Error(
                            "Python returned invalid JSON.\n\n" +
                            stdout
                        )
                    );
                }
            }
        );

        function cleanupTempFile() {

            try {

                if (fs.existsSync(tempFile)) {

                    fs.unlinkSync(tempFile);
                }

            } catch (error) {

                console.warn(
                    "Could not delete temporary file:",
                    error.message
                );
            }
        }
    });
}


// =====================================================
// ANALYZE RESUME
// =====================================================

async function analyzeResume(filePath) {

    console.log(
        "\n============================================"
    );

    console.log(
        "          STARTING RESUME ANALYSIS"
    );

    console.log(
        "============================================\n"
    );

    // ---------------------------------------------
    // Extract text
    // ---------------------------------------------

    const text =
        await extractTextFromFile(filePath);

    // ---------------------------------------------
    // Make sure text exists
    // ---------------------------------------------

    if (!text || text.trim().length < 20) {

        throw new Error(
            "Resume text extraction returned insufficient text."
        );
    }

    console.log(
        "\n========== RESUME TEXT ==========\n"
    );

    console.log(text);

    console.log(
        "\n=================================\n"
    );

    // ---------------------------------------------
    // Analyze with Python
    // ---------------------------------------------

    const analysis =
        await runSkillExtractor(text);

    console.log(
        "\n========== RESUME ANALYSIS =========="
    );

    console.log(
        JSON.stringify(
            analysis,
            null,
            2
        )
    );

    console.log(
        "======================================\n"
    );

    // ---------------------------------------------
    // Return everything
    // ---------------------------------------------

    return {
        rawText: text,
        ...analysis
    };
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    extractTextFromFile,

    runSkillExtractor,

    analyzeResume

};