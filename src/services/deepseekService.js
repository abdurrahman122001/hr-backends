require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");

const AI_URL = "https://api.openai.com/v1/chat/completions";
const AI_KEY = process.env.OPENAI_API_KEY;

/**
 * Extracts text from a PDF buffer or file path.
 */
async function extractTextFromPDF(fileData) {
  const buffer = Buffer.isBuffer(fileData)
    ? fileData
    : fs.readFileSync(fileData);
  const parsed = await pdfParse(buffer);
  return parsed.text;
}

/**
 * Extracts text from an image buffer or file path using Tesseract.js.
 */
async function extractTextFromImage(fileData) {
  const image = Buffer.isBuffer(fileData)
    ? fileData
    : fs.readFileSync(fileData);

  const {
    data: { text },
  } = await Tesseract.recognize(image, "eng", {
    logger: (m) => console.log(m.status, m.progress),
  });

  return text;
}

/**
 * Sends extracted text (rawText) to GPT-4o for analysis.
 * Returns exactly the AI's string response (JSON as a string).
 */
async function sendTextToAI(promptText, systemInstruction = "") {
  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          systemInstruction || "You are an expert document text extractor.",
      },
      {
        role: "user",
        content: promptText,
      },
    ],
    temperature: 0,
    max_tokens: 4000,
  };

  const response = await axios.post(AI_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_KEY}`,
    },
    timeout: 30000,
  });

  const content = response.data.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No content returned from AI");

  return content;
}

/**
 * Main function to extract and process text.
 *
 * - If fileData is a Buffer:
 *     • If documentType = "CV" or "CNIC", treat as PDF.
 *     • Otherwise, try PDF first; if that fails, run OCR.
 * - If fileData is a string path, infer extension.
 *
 * documentType: "CV" | "CNIC" | "generic"
 * Returns a JSON string from the AI. Caller must JSON.parse(...) it.
 */
async function extractTextUsingAI(fileData, documentType = "generic") {
  let rawText = "";

  if (Buffer.isBuffer(fileData)) {
    if (documentType === "CV" || documentType === "CNIC") {
      rawText = await extractTextFromPDF(fileData);
    } else {
      try {
        rawText = await extractTextFromPDF(fileData);
      } catch {
        rawText = await extractTextFromImage(fileData);
      }
    }
  } else if (typeof fileData === "string") {
    const ext = fileData.split(".").pop().toLowerCase();
    if (ext === "pdf") {
      rawText = await extractTextFromPDF(fileData);
    } else if (["png", "jpg", "jpeg"].includes(ext)) {
      rawText = await extractTextFromImage(fileData);
    } else {
      throw new Error("Unsupported file type.");
    }
  } else {
    throw new Error("fileData must be a Buffer or a file path string.");
  }

  const instructions = {
    CV: `
You are a professional CV parser. Return exactly this JSON format:

{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "skills": ["Skill1", "Skill2"],
  "education": [{"degree": "BSc", "institution": "XYZ University"}],
  "experience": [{"title": "Job Title", "company": "Company", "duration": "Years"}]
}
Only return the JSON. Don't explain anything else.
    `,
    CNIC: `
You are a CNIC parser. Return exactly this JSON format:

{
  "name": "Full name on CNIC",
  "cnic": "#####-#######-#",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "M/F",
  "nationality": "Pakistan",
  "dateOfIssue": "YYYY-MM-DD",
  "dateOfExpiry": "YYYY-MM-DD"
}
Only return the JSON. Don't explain anything else.
    `,
    generic: `
Extract key information from the following document text. Summarize its contents.
    `,
  };

  const prompt = `Extracted Text:\n\n${rawText}`;
  const instruction = instructions[documentType] || instructions.generic;
  const result = await sendTextToAI(prompt, instruction);
  return result;
}

module.exports = {
  extractTextUsingAI,
};
