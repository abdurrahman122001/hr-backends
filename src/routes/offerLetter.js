// src/routes/offerLetter.js
require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const router = express.Router();

// AI endpoint + key
const AI_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_KEY = process.env.DEEPSEEK_API_KEY;

// SMTP transporter
const transporter = nodemailer.createTransport({
  host:     process.env.MAIL_HOST,                    // smtp.titan.email
  port:     parseInt(process.env.MAIL_PORT, 10),      // 465
  secure:   process.env.MAIL_ENCRYPTION === 'ssl',    // SSL on port 465
  auth: {
    user:   process.env.MAIL_USERNAME,                 // info@brannovate.com
    pass:   process.env.MAIL_PASSWORD,
  },
});

// 1) Generate letter text
router.post('/generate', async (req, res) => {
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
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Write a professional employment offer letter to ${candidateName} for the position of ${position} at ${companyName} with annual salary PKR ${salary} starting ${startDate}. Include: ${additionalDetails}`,
        }],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI error: ${txt}`);
    }
    const { choices } = await aiRes.json();
    const letter = choices?.[0]?.message?.content?.trim();
    if (!letter) throw new Error('No letter returned');

    res.json({ success: true, letter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2) Generate PDF + email
router.post('/send', async (req, res) => {
  try {
    const {
      candidateName,
      candidateEmail,
      position,
      salary,
      startDate,
      companyName,
      additionalDetails,
      letter,          // the previewed text
    } = req.body;

    // Build PDF in memory
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', async () => {
      const pdf = Buffer.concat(buffers);

      await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
        to:   candidateEmail,
        subject: `Your Offer Letter from ${companyName}`,
        text:    `Dear ${candidateName},\n\nPlease find attached your offer letter.\n\nBest,\n${companyName}`,
        attachments: [{
          filename: 'OfferLetter.pdf',
          content:  pdf,
        }],
      });

      res.json({ success: true, message: 'Offer letter emailed.' });
    });

    doc.fontSize(12).text(letter, { align: 'left' });
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
