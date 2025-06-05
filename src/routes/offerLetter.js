// src/routes/offerLetter.js
require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const router = express.Router();

// AI endpoint + key
const AI_URL = "https://openrouter.ai/api/v1/chat/completions";
const AI_KEY = process.env.DEEPSEEK_API_KEY;

// SMTP transporter (for sending all outgoing mail)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,       // e.g. "smtp.titan.email"
  port: parseInt(process.env.MAIL_PORT, 10), // e.g. 465
  secure: process.env.MAIL_ENCRYPTION === "ssl", // true for port 465
  auth: {
    user: process.env.MAIL_USERNAME, // e.g. "info@brannovate.com"
    pass: process.env.MAIL_PASSWORD,
  },
});

// ───────────────────────────────────────────────────────────────────────────────
// 1) Generate letter text (AI‐powered)
//    POST /offer/generate
//    Body: {
//      candidateName, position, salary, startDate, companyName, additionalDetails
//    }
//    Returns: { success: true, letter }
// ───────────────────────────────────────────────────────────────────────────────
router.post("/offer/generate", async (req, res) => {
  try {
    const {
      candidateName,
      position,
      salary,
      startDate,
      companyName,
      additionalDetails,
    } = req.body;

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `
Write a professional employment offer letter addressed to ${candidateName} 
for the position of ${position} at ${companyName}, with annual salary PKR ${salary} 
starting on ${startDate}. Include: ${additionalDetails}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI error: ${txt}`);
    }

    const { choices } = await aiRes.json();
    const letter = choices?.[0]?.message?.content?.trim();
    if (!letter) throw new Error("No letter returned from AI");

    return res.json({ success: true, letter });
  } catch (err) {
    console.error("❌ /offer/generate error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/offer/send", async (req, res) => {
  try {
    const {
      candidateName,
      candidateEmail,
      position,
      salary,
      startDate,
      companyName,
      additionalDetails,
      letter, // the previewed text from /offer/generate
    } = req.body;

    // Build PDF in memory
    const doc = new PDFDocument();
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
        to: candidateEmail,
        subject: `Your Offer Letter from ${companyName}`,
        text: `Dear ${candidateName},\n\nPlease find attached your offer letter.\n\nBest regards,\n${companyName}`,
        attachments: [
          {
            filename: "OfferLetter.pdf",
            content: pdfBuffer,
          },
        ],
      });

      return res.json({ success: true, message: "Offer letter emailed." });
    });

    doc.fontSize(12).text(letter, { align: "left" });
    doc.end();
  } catch (err) {
    console.error("❌ /offer/send error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 3) Handle candidate reply (acceptance)
//    POST /offer/reply
//    Body: { candidateEmail, replyText }
//    If replyText contains /accept/i → send “Next Steps: Documents Required”
//    Returns: { success: true, message }
// ───────────────────────────────────────────────────────────────────────────────
router.post("/offer/reply", async (req, res) => {
  try {
    const { candidateEmail, replyText } = req.body;
    if (!replyText || !/\baccept/i.test(replyText)) {
      return res.status(400).json({
        success: false,
        message: "No acceptance detected in replyText.",
      });
    }

    // Send the “Next Steps” email
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: candidateEmail,
      subject: "Next Steps: Documents Required for Onboarding",
      text: `Dear Candidate,

Thank you for accepting our offer! To complete your onboarding process, please reply with the following documents:

1. Your most recent CV (resume)
2. A clear copy of your CNIC

Kindly send these at your earliest convenience so we can finalize your start date.

Best regards,
${process.env.MAIL_FROM_NAME}
${process.env.MAIL_FROM_ADDRESS}`,
    });

    return res.json({
      success: true,
      message: "Request-for-documents email sent.",
    });
  } catch (err) {
    console.error("❌ /offer/reply error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
