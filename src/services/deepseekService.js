require("dotenv").config();
const fs = require("fs");
const Tesseract = require("tesseract.js");
const { OpenAI } = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extracts raw text from an image buffer or file path using Tesseract.js.
 */
async function extractTextFromImage(fileData) {
  const imageBuffer = Buffer.isBuffer(fileData)
    ? fileData
    : fs.readFileSync(fileData);

  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng", {
    logger: (m) => console.log(m.status, m.progress),
  });

  return text;
}

/**
 * Uses OpenAI's GPT-4o model to process extracted text.
 * promptText: The OCR-extracted text
 * systemInstruction: The role-based instruction for parsing
 */
async function sendTextToAI(promptText, systemInstruction = "") {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: promptText },
    ],
    temperature: 0,
    max_tokens: 4000,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content returned from AI");

  return content.trim();
}

/**
 * Main extraction function: runs OCR on images then sends to GPT-4o for parsing.
 * fileData: Buffer or file path string for an image
 * documentType: "CV" | "CNIC" | "generic"
 * Returns the JSON string result from GPT-4o.
 */
async function extractTextUsingAI(fileData, documentType = "generic") {
  let rawText;

  // 1) OCR step
  if (Buffer.isBuffer(fileData)) {
    rawText = await extractTextFromImage(fileData);
  } else if (typeof fileData === "string") {
    const ext = fileData.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg"].includes(ext)) {
      rawText = await extractTextFromImage(fileData);
    } else {
      throw new Error("Unsupported file type: only png, jpg, jpeg allowed");
    }
  } else {
    throw new Error("fileData must be a Buffer or file path string");
  }

  // 2) System prompt definitions
  const prompts = {
    CV: `You are a professional CV parser. Return exactly this JSON format (no explanation):
{
  "phone": "Phone number",
  "fatherOrHusbandName": "Father or Husband Name",
  "skills": ["Skill1", "Skill2"],
  "education": [{"degree": "BSc", "institution": "XYZ University"}],
  "experience": [{"title": "Job Title", "company": "Company", "duration": "Years"}]
}`,

    CNIC: `You are a CNIC parser. Return exactly this JSON format (no explanation):
{
  "cnic": "#####-#######-#",
  "fatherOrHusbandName": "Father or Husband Name",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "M/F",
  "nationality": "Pakistan",
  "dateOfIssue": "YYYY-MM-DD",
  "dateOfExpiry": "YYYY-MM-DD"
}`,

    generic: `Extract key information from the following text. Summarize its contents concisely.`,
  };

  const systemInstruction = prompts[documentType] || prompts.generic;
  const promptText = `Extracted Text:\n\n${rawText}`;

  // 3) AI parsing step
  const result = await sendTextToAI(promptText, systemInstruction);
  return result;
}

module.exports = {
  extractTextUsingAI,
};
// services/extractTextUsingAI.js
// require("dotenv").config();
// const fs = require("fs");
// const Tesseract = require("tesseract.js");
// const { OpenAI } = require("openai");

// // Initialize OpenAI client
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// /** Read buffer from file or keep if already buffer */
// function getBuffer(fileData) {
//   if (Buffer.isBuffer(fileData)) return fileData;
//   if (typeof fileData === "string") return fs.readFileSync(fileData);
//   throw new Error("fileData must be Buffer or path");
// }

// /** Run OCR (English + Urdu) */
// async function extractTextFromImage(fileData) {
//   const buffer = getBuffer(fileData);
//   const { data: { text }} = await Tesseract.recognize(buffer, "eng+urd", {
//     logger: (m) => console.log(m.status, m.progress),
//   });
//   return text;
// }

// /** Send to GPT for parsing */
// async function sendTextToAI(promptText, systemInstruction) {
//   const res = await openai.chat.completions.create({
//     model: "gpt-4o",
//     messages: [
//       { role: "system", content: systemInstruction },
//       { role: "user", content: promptText },
//     ],
//     temperature: 0,
//     max_tokens: 1024,
//   });
//   const content = res.choices?.[0]?.message?.content;
//   if (!content) throw new Error("No content from AI");
//   return content.trim();
// }

// /**
//  * Main: supports single file or array.
//  * documentType: "CNIC" or "generic"
//  */
// async function extractTextUsingAI(fileData, documentType = "CNIC") {
//   const prompts = {
//     CNIC: `You are a CNIC parser. OCR text may include Urdu for addresses—translate any Urdu into English. Return exactly this JSON format (no explanations):
// {
//   "cnic": "#####-#######-#",
//   "fatherOrHusbandName": "Father or Husband Name",
//   "dateOfBirth": "YYYY-MM-DD",
//   "gender": "M/F",
//   "nationality": "Pakistan",
//   "dateOfIssue": "YYYY-MM-DD",
//   "dateOfExpiry": "YYYY-MM-DD",
//   "presentAddress": "Present address in English",
//   "permanentAddress": "Permanent address in English"
// }`,
//     generic: `Extract key information from the following text and summarize it.`,
//   };
//   const systemInstruction = prompts[documentType] || prompts.generic;

//   // Helper for one file
//   async function processOne(file) {
//     // OCR
//     const rawText = await extractTextFromImage(file);
//     const promptText = `OCR Extracted Text:\n\n${rawText}`;
//     // AI parse
//     const parsed = await sendTextToAI(promptText, systemInstruction);
//     // Try to parse JSON if CNIC
//     if (documentType === "CNIC") {
//       try {
//         return JSON.parse(parsed);
//       } catch {
//         // if not valid JSON, return raw
//         return { error: "Invalid JSON", raw: parsed };
//       }
//     }
//     return parsed;
//   }

//   // If array, map
//   if (Array.isArray(fileData)) {
//     const results = [];
//     for (const f of fileData) {
//       results.push(await processOne(f));
//     }
//     return results;
//   } else {
//     return await processOne(fileData);
//   }
// }

// module.exports = { extractTextUsingAI };
