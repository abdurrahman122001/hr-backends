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

// require("dotenv").config();
// const fs = require("fs");
// const sharp = require("sharp");
// const Tesseract = require("tesseract.js");
// const { OpenAI } = require("openai");

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// /**
//  * Preprocess image using Sharp (grayscale + thresholding).
//  */
// async function preprocessImage(inputBuffer) {
//   return await sharp(inputBuffer)
//     .grayscale()
//     .threshold(180) // Increase contrast by thresholding
//     .toBuffer();
// }

// /**
//  * OCR: Extract text from image after preprocessing.
//  */
// async function extractTextFromImage(fileData) {
//   const imageBuffer = Buffer.isBuffer(fileData)
//     ? fileData
//     : fs.readFileSync(fileData);

//   const processedImage = await preprocessImage(imageBuffer);

//   const {
//     data: { text },
//   } = await Tesseract.recognize(processedImage, "eng", {
//     logger: (m) => console.log(m.status, m.progress),
//   });

//   return cleanText(text);
// }

// /**
//  * Clean extracted text for better parsing.
//  */
// function cleanText(text) {
//   return text
//     .replace(/\s+/g, " ")         // Normalize all whitespace
//     .replace(/[^\x20-\x7E]+/g, "") // Remove non-printable chars
//     .trim();
// }

// /**
//  * Query OpenAI for structured parsing.
//  */
// async function sendTextToAI(promptText, systemInstruction = "") {
//   const response = await openai.chat.completions.create({
//     model: "gpt-4o",
//     messages: [
//       { role: "system", content: systemInstruction },
//       { role: "user", content: promptText },
//     ],
//     temperature: 0,
//     max_tokens: 4096,
//   });

//   const content = response.choices?.[0]?.message?.content;
//   if (!content) throw new Error("No content returned from AI");
//   return content.trim();
// }

// /**
//  * Extract info from image using OCR and OpenAI.
//  */
// async function extractTextUsingAI(fileData, documentType = "generic") {
//   let rawText;

//   if (Buffer.isBuffer(fileData)) {
//     rawText = await extractTextFromImage(fileData);
//   } else if (typeof fileData === "string") {
//     const ext = fileData.split(".").pop().toLowerCase();
//     if (["png", "jpg", "jpeg"].includes(ext)) {
//       rawText = await extractTextFromImage(fileData);
//     } else {
//       throw new Error("Unsupported file type: only png, jpg, jpeg allowed");
//     }
//   } else {
//     throw new Error("fileData must be a Buffer or file path string");
//   }

//   const prompts = {
//     CV: `You are a CV parser. Return the following JSON (no extra explanation):
// {
//   "phone": "String",
//   "fatherOrHusbandName": "String",
//   "skills": ["Skill1", "Skill2"],
//   "education": [{"degree": "String", "institution": "String"}],
//   "experience": [{"title": "String", "company": "String", "duration": "String"}]
// }`,

//     CNIC: `You are a CNIC parser. Return only this JSON format (no explanation):
// {
//   "cnic": "#####-#######-#",
//   "fatherOrHusbandName": "String",
//   "dateOfBirth": "YYYY-MM-DD",
//   "gender": "M/F",
//   "nationality": "Pakistan",
//   "dateOfIssue": "YYYY-MM-DD",
//   "dateOfExpiry": "YYYY-MM-DD"
// }`,

//     generic: `Summarize this extracted text clearly and concisely. Highlight any relevant information.`,
//   };

//   const systemInstruction = prompts[documentType] || prompts.generic;
//   const promptText = `Extracted OCR Text:\n\n"""${rawText}"""`;

//   const result = await sendTextToAI(promptText, systemInstruction);
//   return result;
// }

// module.exports = {
//   extractTextUsingAI,
// };
// require("dotenv").config();
// const fs = require("fs");
// const sharp = require("sharp");
// const Tesseract = require("tesseract.js");
// const axios = require("axios");

// const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// /**
//  * Preprocess image using Sharp (grayscale + threshold).
//  */
// async function preprocessImage(inputBuffer) {
//   return await sharp(inputBuffer)
//     .grayscale()
//     .threshold(180)
//     .toBuffer();
// }

// /**
//  * OCR using Tesseract on preprocessed image.
//  */
// async function extractTextFromImage(fileData) {
//   const imageBuffer = Buffer.isBuffer(fileData)
//     ? fileData
//     : fs.readFileSync(fileData);

//   const processedImage = await preprocessImage(imageBuffer);

//   const {
//     data: { text },
//   } = await Tesseract.recognize(processedImage, "eng", {
//     logger: (m) => console.log(m.status, m.progress),
//   });

//   return cleanText(text);
// }

// /**
//  * Clean and normalize text before sending to LLM.
//  */
// function cleanText(text) {
//   return text
//     .replace(/\s+/g, " ")
//     .replace(/[^\x20-\x7E]+/g, "")
//     .trim();
// }

// /**
//  * Send text to DeepSeek R1-Zero (via OpenRouter).
//  */
// async function sendTextToAI(promptText, systemInstruction = "") {
//   try {
//     const response = await axios.post(
//       OPENROUTER_URL,
//       {
//         model: "deepseek-r1-zero:free", // You can also use "deepseek-coder:6.7b"
//         messages: [
//           { role: "system", content: systemInstruction },
//           { role: "user", content: promptText },
//         ],
//         temperature: 0.2,
//         max_tokens: 4096,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, // Set your DeepSeek API key here
//           "Content-Type": "application/json",
//           "HTTP-Referer": "https://yourdomain.com", // Optional but recommended
//           "X-Title": "deepseek-r1-zero-ocr-parser",
//         },
//       }
//     );

//     const content = response.data?.choices?.[0]?.message?.content;
//     if (!content) throw new Error("No content returned from DeepSeek");

//     return content.trim();
//   } catch (err) {
//     console.error("DeepSeek API Error:", err.message);
//     throw err;
//   }
// }

// /**
//  * Main Function to Extract Text from Image & Parse via DeepSeek
//  */
// async function extractTextUsingAI(fileData, documentType = "generic") {
//   let rawText;

//   if (Buffer.isBuffer(fileData)) {
//     rawText = await extractTextFromImage(fileData);
//   } else if (typeof fileData === "string") {
//     const ext = fileData.split(".").pop().toLowerCase();
//     if (["png", "jpg", "jpeg"].includes(ext)) {
//       rawText = await extractTextFromImage(fileData);
//     } else {
//       throw new Error("Unsupported file type: only png, jpg, jpeg allowed");
//     }
//   } else {
//     throw new Error("fileData must be a Buffer or file path string");
//   }

//   const prompts = {
//     CV: `You are a professional CV parser. Return exactly this JSON format (no explanation):
// {
//   "phone": "Phone number",
//   "fatherOrHusbandName": "Father or Husband Name",
//   "skills": ["Skill1", "Skill2"],
//   "education": [{"degree": "BSc", "institution": "XYZ University"}],
//   "experience": [{"title": "Job Title", "company": "Company", "duration": "Years"}]
// }`,

//     CNIC: `You are a CNIC parser. Return exactly this JSON format (no explanation):
// {
//   "cnic": "#####-#######-#",
//   "fatherOrHusbandName": "Father or Husband Name",
//   "dateOfBirth": "YYYY-MM-DD",
//   "gender": "M/F",
//   "nationality": "Pakistan",
//   "dateOfIssue": "YYYY-MM-DD",
//   "dateOfExpiry": "YYYY-MM-DD"
// }`,

//     generic: `Summarize this extracted text clearly. Highlight useful information and avoid repetition.`,
//   };

//   const systemInstruction = prompts[documentType] || prompts.generic;
//   const promptText = `Extracted OCR Text:\n\n"""${rawText}"""`;

//   const result = await sendTextToAI(promptText, systemInstruction);
//   return result;
// }

// module.exports = {
//   extractTextUsingAI,
// };
