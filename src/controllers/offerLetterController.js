// controllers/offerLetterController.js
require("dotenv").config();
const Employee    = require("../models/Employees");   // adjust path if needed
const SalarySlip  = require("../models/SalarySlip"); // new import
const { OpenAI }  = require("openai");
const nodemailer  = require("nodemailer");

// initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// initialize SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: process.env.MAIL_PORT === "465",
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: { rejectUnauthorized: false }
});

module.exports = {
  async generateOfferLetter(req, res) {
    try {
      const {
        candidateName,
        candidateEmail,
        position,
        salary,
        startDate,
      } = req.body;

      // 1) create & save employee
      const employee = new Employee({
        owner:       req.user?._id ?? null,
        name:        candidateName,
        email:       candidateEmail,
        designation: position,
        compensation: { basic: salary, grossSalary: salary },
        joiningDate: new Date(startDate),
      });
      await employee.save();

      // 2) create salary slip with grossSalary only
      await SalarySlip.create({
        employee:         employee._id,
        basic:            salary,
        dearnessAllowance: 0,
        houseRentAllowance: 0,
        conveyanceAllowance: 0,
        medicalAllowance:  0,
        utilityAllowance:  0,
        overtimeCompensation: 0,
        dislocationAllowance:  0,
        leaveEncashment:   0,
        bonus:             0,
        arrears:           0,
        autoAllowance:     0,
        incentive:         0,
        fuelAllowance:     0,
        othersAllowances:  0,
        grossSalary:       salary,
        leaveDeductions:   0,
        lateDeductions:    0,
        eobiDeduction:     0,
        sessiDeduction:    0,
        providentFundDeduction: 0,
        gratuityFundDeduction:  0,
        loanDeductions:    {},
        advanceSalaryDeductions: 0,
        medicalInsurance:  0,
        lifeInsurance:     0,
        penalties:         0,
        othersDeductions:  0,
        taxDeduction:      0,
        totalAllowances:   0,
        totalDeductions:   0,
        netPayable:        salary,
      });

      // 3) build AI prompt
      const prompt = `
Write a professional offer letter addressed to ${candidateName},
for the position of ${position}, with a monthly salary of ${salary} currency should be pkr,
and start date ${startDate}.
      `.trim();

      // 4) call OpenAI
      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const letter = aiRes.choices[0].message.content.trim();
      return res.json({ letter });
    } catch (err) {
      console.error("Offer generation error:", err);
      return res.status(500).json({ error: "Failed to generate offer letter" });
    }
  },

  async sendOfferLetter(req, res) {
    try {
      const { candidateEmail, letter } = req.body;
      if (!letter) {
        return res.status(400).json({ error: "No letter provided" });
      }

      // send email
      await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
        to:   candidateEmail,
        subject: "Your Offer Letter from Brannovate",
        text:    letter,
        html:    `<pre style="font-family:inherit">${letter}</pre>`,
      });

      return res.json({ success: true });
    } catch (err) {
      console.error("Email send error:", err);
      return res.status(500).json({ error: "Failed to send offer letter" });
    }
  },
};
