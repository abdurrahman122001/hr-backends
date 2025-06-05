// services/mailService.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:    process.env.MAIL_HOST,                  // smtp.titan.email
  port:    parseInt(process.env.MAIL_PORT, 10),    // 465
  secure:  process.env.MAIL_ENCRYPTION === 'ssl',  // ssl → true
  auth: {
    user: process.env.MAIL_USERNAME,               // info@brannovate.com
    pass: process.env.MAIL_PASSWORD                // your SMTP password
  }
});

async function sendEmail(to, text, subject) {
  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text
    });
    console.log('📧 Email sent to', to);
  } catch (err) {
    console.error('❌ Email sending error:', err);
  }
}

module.exports = { sendEmail };
