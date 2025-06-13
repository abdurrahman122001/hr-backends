// watcher.js
require("dotenv").config();

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const mongoose = require("mongoose");

const { analyzeLeavePolicy, extractTextUsingAI } = require("./services/deepseekService");
const { generateHRReply, generateRejectionReply } = require("./services/draftReply");
const { sendEmail } = require("./services/mailService");
const { sendNdaAndContract } = require("./services/ndaService");

const Employee = require("./models/Employees");

// Initialize IMAP connection
const imap = new Imap(require("./config/imapConfig"));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

function parseStream(stream) {
  return new Promise((resolve, reject) => {
    simpleParser(stream, (err, parsed) => {
      if (err) reject(err);
      else resolve(parsed);
    });
  });
}

async function classifyEmail(text) {
  if (!text) return "hr_related";
  
  if (/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/.test(text) ||
      /\b(today|tomorrow)\b/i.test(text)) {
    return "leave_request";
  }
  return "hr_related";
}

async function sendCompleteProfileLink(id, to) {
  const link = `${process.env.FRONTEND_BASE_URL}/complete-profile/${id}`;
  const html = `
    <div>
      <p>Please complete your profile by visiting:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Route element: <code>&lt;CompleteProfile /&gt;</code></p>
    </div>
  `;
  await sendEmail({ to, subject: "Complete Your Profile", html });
}

async function handleApprovalResponse(employee, emailText) {
  const isApproved = /\bapprove\b/i.test(emailText);
  
  if (isApproved) {
    await sendEmail({
      to: employee.email,
      subject: "Request Approved",
      html: "Your request has been approved."
    });
  } else {
    const rejectionReason = await generateRejectionReply(emailText);
    await sendEmail({
      to: employee.email,
      subject: "Request Rejected",
      html: rejectionReason
    });
  }
}

async function handleLeaveRequest(employee, emailText) {
  try {
    const leaveAnalysis = await analyzeLeavePolicy(emailText);
    const reply = await generateHRReply(leaveAnalysis);
    
    await sendEmail({
      to: employee.email,
      subject: "Leave Request Update",
      html: reply
    });
  } catch (error) {
    console.error("Error processing leave request:", error);
    await sendEmail({
      to: employee.email,
      subject: "Leave Request Error",
      html: "There was an error processing your leave request. Please contact HR directly."
    });
  }
}

async function processMessage(stream) {
  try {
    const parsed = await parseStream(stream);
    if (!parsed.from || !parsed.from.value || !parsed.from.value[0] || !parsed.from.value[0].address) {
      console.warn("Email missing from address");
      return;
    }

    const fromAddr = parsed.from.value[0].address.toLowerCase();
    const bodyText = (parsed.text || "").trim();

    // Upsert employee if attachments are present
    let emp = await Employee.findOne({ email: fromAddr });
    if (parsed.attachments?.length) {
      const data = {
        cnic: "", dateOfBirth: "", gender: "",
        nationality: "", dateOfIssue: "", dateOfExpiry: "",
        phone: "", fatherOrHusbandName: "",
        skills: [], education: [], experience: []
      };

      for (const att of parsed.attachments) {
        const name = (att.filename || "").toLowerCase();
        if (!/\.(png|jpe?g|pdf)$/i.test(name)) continue;
        const buf = att.content;

        try {
          const cv = JSON.parse(await extractTextUsingAI(buf, "CV"));
          Object.assign(data, {
            phone: cv.phone || data.phone,
            fatherOrHusbandName: cv.fatherOrHusbandName || data.fatherOrHusbandName,
          });
          data.skills.push(...(cv.skills || []));
          data.education.push(...(cv.education || []));
          data.experience.push(...(cv.experience || []));
        } catch (error) {
          console.error("Error processing CV:", error);
        }

        try {
          const cnic = JSON.parse(await extractTextUsingAI(buf, "CNIC"));
          Object.assign(data, {
            cnic: cnic.cnic || data.cnic,
            dateOfBirth: cnic.dateOfBirth || data.dateOfBirth,
            gender: cnic.gender || data.gender,
            nationality: cnic.nationality || data.nationality,
            dateOfIssue: cnic.dateOfIssue || data.dateOfIssue,
            dateOfExpiry: cnic.dateOfExpiry || data.dateOfExpiry,
            fatherOrHusbandName: cnic.fatherOrHusbandName || data.fatherOrHusbandName,
          });
        } catch (error) {
          console.error("Error processing CNIC:", error);
        }
      }

      emp = await Employee.findOneAndUpdate(
        { email: fromAddr },
        { ...data, email: fromAddr },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Send profile completion link and NDA
      await sendCompleteProfileLink(emp._id, fromAddr);
      await sendNdaAndContract(emp, fromAddr);
    }

    // Classify and reply to plain-text emails
    let label;
    if (/\baccept(?:ed|ance)?\b/i.test(bodyText)) {
      label = "offer_acceptance";
    } else if (/\bapprove\b/i.test(bodyText) || /\breject\b/i.test(bodyText)) {
      label = "approval_response";
    } else {
      label = await classifyEmail(bodyText);
    }

    if (label === "offer_acceptance") {
      await sendEmail({
        to: fromAddr,
        subject: "Next Steps",
        html: emp
          ? "Thank you for accepting our offer! 🎉 Please send your updated CV & CNIC."
          : "Thank you for accepting! 🎉 Please send your CV & CNIC to get started."
      });
    } else if (label === "approval_response") {
      if (emp) {
        await handleApprovalResponse(emp, bodyText);
      }
    } else if (label === "leave_request") {
      if (emp) {
        await handleLeaveRequest(emp, bodyText);
      }
    } else if (label === "hr_related") {
      const reply = await generateHRReply(bodyText);
      await sendEmail({ to: fromAddr, subject: "HR Policy Info", html: reply });
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

function checkLatest() {
  imap.search(["UNSEEN"], (err, uids) => {
    if (err) {
      console.error("IMAP search error:", err);
      return;
    }
    if (!uids?.length) return;

    const fetcher = imap.fetch(uids, { bodies: [""], markSeen: true });
    fetcher.on("message", msg => {
      msg.on("body", stream => {
        processMessage(stream).catch(error => {
          console.error("Error processing message stream:", error);
        });
      });
      msg.on("error", error => {
        console.error("Message stream error:", error);
      });
    });
    fetcher.once("error", error => {
      console.error("Fetch error:", error);
    });
    fetcher.once("end", () => console.log("Done processing new messages"));
  });
}

function startWatcher() {
  imap.once("ready", () => {
    imap.openBox("INBOX", false, err => {
      if (err) {
        console.error("IMAP openBox error:", err);
        return;
      }
      console.log("Watching for new emails...");
      imap.on("mail", checkLatest);
      checkLatest();
    });
  });

  imap.on("error", err => {
    console.error("IMAP connection error:", err);
  });

  imap.on("end", () => {
    console.log("IMAP connection ended");
  });

  imap.connect();

  // Cleanup on process exit
  process.on("SIGINT", () => {
    imap.end();
    mongoose.connection.close();
    process.exit();
  });
}

module.exports = { startWatcher };