require("dotenv").config();

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const mongoose = require("mongoose");

const {
  classifyEmail,
  analyzeLeavePolicy,
  extractPersonalInfoFromCV,
  extractPersonalInfoFromCNIC,
} = require("./services/deepseekService");
const { generateHRReply, generateRejectionReply } = require("./services/draftReply");
const { sendEmail } = require("./services/mailService");

// Mongoose models
const Employee = require("./models/Employees");
const Leaves = require("./models/Leaves");
const EmployeeHierarchy = require("./models/EmployeeHierarchy");
const SalarySlip = require("./models/SalarySlip");

const imapConfig = require("./config/imapConfig");
const imap = new Imap(imapConfig);

// Promisified wrapper for mailparser
function parseStream(stream) {
  return new Promise((resolve, reject) =>
    simpleParser(stream, (err, parsed) => (err ? reject(err) : resolve(parsed)))
  );
}

async function checkLatest() {
  imap.search(["UNSEEN"], (err, uids) => {
    if (err) {
      console.error("❌ IMAP search error:", err);
      return;
    }
    if (!uids || !uids.length) {
      return; // no new emails
    }

    const fetcher = imap.fetch(uids, { bodies: [""], markSeen: true });

    fetcher.on("message", (msg) =>
      msg.on("body", async (stream) => {
        try {
          const parsed = await parseStream(stream);
          const fromAddr = parsed.from.value[0].address.toLowerCase();
          const bodyText = (parsed.text || "").trim();
          console.log(`\n✉️  From ${fromAddr}: ${bodyText.slice(0, 60)}…`);

          // 1) Try to find an existing Employee by email
          let emp = await Employee.findOne({ email: fromAddr });
          const isExistingEmployee = !!emp;

          // 2) If there are attachments, run CV + CNIC parsers
          if (parsed.attachments && parsed.attachments.length > 0) {
            let combinedCV = {
              name: "",
              cnic: "",
              dateOfBirth: "",
              fatherOrHusbandName: "",
              phone: "",
              nationality: "",
              email: "",
              education: [],
              experience: [],
              skills: [],
            };
            let combinedCNIC = {
              name: "",
              cnic: "",
              dateOfBirth: "",
              fatherOrHusbandName: "",
              nationality: "",
              gender: "",
              dateOfIssue: "",
              dateOfExpiry: "",
              countryOfStay: "",
            };

            for (const att of parsed.attachments) {
              const filename = (att.filename || "").toLowerCase();
              const buf = att.content;

              if (filename.endsWith(".pdf")) {
                // 2a) Extract from CV PDF
                try {
                  const cvResult = await extractPersonalInfoFromCV(buf, filename);
                  for (const key of Object.keys(combinedCV)) {
                    if (cvResult[key] && cvResult[key].toString().trim() !== "") {
                      if (Array.isArray(combinedCV[key]) && Array.isArray(cvResult[key])) {
                        combinedCV[key] = [...combinedCV[key], ...cvResult[key]];
                      } else {
                        combinedCV[key] = cvResult[key];
                      }
                    }
                  }
                  console.log("✅ [Watcher] CV parse result:", cvResult);
                } catch (e) {
                  console.warn("❗ extractPersonalInfoFromCV failed on", filename, ":", e.message);
                }

                // 2b) Extract from CNIC PDF
                try {
                  const cnicResult = await extractPersonalInfoFromCNIC(buf, filename);
                  for (const key of Object.keys(combinedCNIC)) {
                    if (cnicResult[key] && cnicResult[key].toString().trim() !== "") {
                      combinedCNIC[key] = cnicResult[key];
                    }
                  }
                  console.log("✅ [Watcher] CNIC parse result:", cnicResult);
                } catch (e) {
                  console.warn("❗ extractPersonalInfoFromCNIC failed on", filename, ":", e.message);
                }
              }
            }

            // 3) Combine résumé + CNIC results
            const finalData = {
              email: fromAddr,
              name: combinedCNIC.name || combinedCV.name || "",
              cnic: combinedCNIC.cnic || combinedCV.cnic || "",
              dateOfBirth: combinedCNIC.dateOfBirth || combinedCV.dateOfBirth || "",
              fatherOrHusbandName:
                combinedCNIC.fatherOrHusbandName || combinedCV.fatherOrHusbandName || "",
              phone: combinedCV.phone || "",
              nationality: combinedCNIC.nationality || combinedCV.nationality || "",
              education: combinedCV.education,
              experience: combinedCV.experience,
              skills: combinedCV.skills,
            };

            // 4) Upsert Employee record, ensuring cnic is written
            const defaultOwnerId = process.env.DEFAULT_HR_OWNER_ID;
            if (!emp) {
              // Only create a new Employee if we have a default owner ID
              if (!defaultOwnerId) {
                console.error(
                  "❗ DEFAULT_HR_OWNER_ID is not set in .env. Cannot create new Employee."
                );
              } else {
                emp = new Employee({
                  owner: defaultOwnerId,
                  name: finalData.name || "Unknown Name",
                  email: finalData.email,
                  cnic: finalData.cnic || "",
                  dateOfBirth: finalData.dateOfBirth || "",              // stored as String
                  fatherOrHusbandName: finalData.fatherOrHusbandName || "",
                  phone: finalData.phone || "",
                  nationality: finalData.nationality || "",
                  education: finalData.education || [],
                  experience: finalData.experience || [],
                  skills: finalData.skills || [],
                });
                console.log(`🆕 [Watcher] Creating Employee for ${fromAddr}`);
              }
            } else {
              // Update existing fields. We overwrite cnic and dateOfBirth directly:
              emp.name = finalData.name || emp.name;
              emp.cnic = finalData.cnic || emp.cnic;
              emp.dateOfBirth = finalData.dateOfBirth || emp.dateOfBirth;    // stored as String
              emp.fatherOrHusbandName = finalData.fatherOrHusbandName || emp.fatherOrHusbandName;
              emp.phone = finalData.phone || emp.phone;
              emp.nationality = finalData.nationality || emp.nationality;
              // (Optionally update arrays; here we replace if non-empty arrays)
              emp.education = finalData.education.length
                ? finalData.education
                : emp.education;
              emp.experience = finalData.experience.length
                ? finalData.experience
                : emp.experience;
              emp.skills = finalData.skills.length
                ? finalData.skills
                : emp.skills;
              console.log(`✏️  [Watcher] Updating Employee for ${fromAddr}`);
            }

            let isNewlyCreated = false;
            if (emp.isNew) {
              isNewlyCreated = true;
            }

            try {
              const savedEmp = await emp.save();
              console.log(`✅ [Watcher] Employee upserted for ${fromAddr}`);

              // 4a) If this was a brand-new Employee insertion, send the "complete your profile" email
              if (isNewlyCreated) {
                const link = `${process.env.FRONTEND_BASE_URL}/complete-profile/${savedEmp._id}`;

                // Compose an email that includes the savedEmp._id, all prefilled fields, and the link
                const emailText = `
Dear ${savedEmp.name || "Candidate"},

Your profile has been created with the following details:

• Employee ID: ${savedEmp._id}
• Name: ${savedEmp.name}
• Email: ${savedEmp.email}
• CNIC: ${savedEmp.cnic}
• Date of Birth: ${savedEmp.dateOfBirth}
• Father / Husband Name: ${savedEmp.fatherOrHusbandName}
• Phone: ${savedEmp.phone}
• Nationality: ${savedEmp.nationality}

To complete your profile and fill in the remaining details, please click the link below:

${link}

If you have any questions, reply to this email.

Best regards,
${process.env.MAIL_FROM_NAME}
                `;

                await sendEmail(
                  fromAddr,
                  emailText.trim(),
                  "Complete Your Employee Profile"
                );
                console.log(`✉️  [Watcher] Sent completion email (with ID) to ${fromAddr}`);
              }
            } catch (saveErr) {
              console.error("❌ [Watcher] Failed to save Employee:", saveErr.message);
            }
          }

          // 5) Classify the email body (e.g., leave_request, approval_response, hr_related)
          let label;
          if (/\b(?:I\s+)?accept(?:ed|ance)?\b/i.test(bodyText)) {
            label = "offer_acceptance";
          } else if (
            /\bapprove\b/i.test(bodyText) ||
            /\breject\b/i.test(bodyText)
          ) {
            label = "approval_response";
          } else {
            label = await classifyEmail(bodyText);
          }
          console.log("🔖 [Watcher] Label:", label);

          // 6a) Handle “Offer Acceptance”
          if (label === "offer_acceptance") {
            const candidateName = emp ? emp.name : "Candidate";
            const requestDocsText = isExistingEmployee
              ? `Dear ${candidateName},\n\nThank you for accepting our offer! 🎉\n\nAs a next step, please send us:\n • Your updated CV  \n • A clear copy of your CNIC  \n\nReply to this e-mail with those attachments at your earliest convenience.\n\nBest regards,\n${process.env.MAIL_FROM_NAME}\n${process.env.MAIL_FROM_ADDRESS}`
              : `Hello,\n\nThank you for accepting our offer! 🎉\n\nWe don’t have your details in our system yet. As a next step, please send us:\n • Your updated CV  \n • A clear copy of your CNIC  \n\nReply to this e-mail with those attachments, and once we extract your data, we will add you to our Employee database.\n\nBest regards,\n${process.env.MAIL_FROM_NAME}\n${process.env.MAIL_FROM_ADDRESS}`;

            await sendEmail(
              fromAddr,
              requestDocsText,
              "Next Steps: Documents Required for Onboarding"
            );
            console.log(`✉️  [Watcher] Sent “Next Steps” to ${fromAddr}`);
            return;
          }

          // 6b) Handle “approval_response”
          if (label === "approval_response") {
            if (!emp) {
              console.log(
                "⚠️ [Watcher] Email is not in Employee DB; skipping approval_response"
              );
              return;
            }
            const isApprove = /\bapprove\b/i.test(bodyText);
            const reason = bodyText.replace(/approve|reject/gi, "").trim();

            const isSupervisor = await EmployeeHierarchy.exists({ senior: emp._id });
            if (!isSupervisor) {
              console.log("⚠️ [Watcher] Not a supervisor; skipping");
              return;
            }

            const juniors = await EmployeeHierarchy.find({ senior: emp._id }).distinct("junior");
            const leave = await Leaves.findOne({
              status: "Pending",
              employee: { $in: juniors },
            })
              .sort({ createdAt: -1 })
              .populate("employee");

            if (!leave) {
              await sendEmail(emp.email, "No pending leave found.", "No Pending Leave");
              return;
            }

            leave.status = isApprove ? "Approved" : "Rejected";
            leave.approvedAt = new Date();

            if (isApprove) {
              const paid = await analyzeLeavePolicy(leave.employee, {
                daysRequested: leave.daysRequested,
                noticeDays: leave.noticeDays,
              });
              leave.leaveType = paid ? "Paid" : "Unpaid";

              if (paid) {
                await Employee.findByIdAndUpdate(leave.employee._id, {
                  $inc: { "leaveEntitlement.paid": -leave.daysRequested },
                });
              }
              await leave.save();

              const juniorBody = paid
                ? `Dear ${leave.employee.name},\n\nYour leave from ${leave.date.toDateString()} has been APPROVED as PAID leave.\n\nEnjoy your time off!\n\nBest regards,\nHR Team`
                : `Dear ${leave.employee.name},\n\nYour leave from ${leave.date.toDateString()} has been APPROVED as UNPAID leave.\nYou provided only ${leave.noticeDays} day(s) notice; policy requires 7 for paid.\n\nBest regards,\nHR Team`;

              await sendEmail(leave.employee.email, juniorBody, "Leave Request Approved");

              if (!paid) {
                await applyUnpaidLeaveToSalarySlipForEmployee(leave.employee._id, leave.date);
              }
            } else {
              leave.leaveType = "Unpaid";
              await leave.save();
              await applyUnpaidLeaveToSalarySlipForEmployee(leave.employee._id, leave.date);

              const juniorBody = await generateRejectionReply(leave, leave.employee, reason);
              await sendEmail(leave.employee.email, juniorBody, "Leave Request Rejected");
            }
            return;
          }

          // 6c) Handle “leave_request”
          if (label === "leave_request") {
            if (!emp) {
              console.log("⚠️ [Watcher] Email is not in Employee DB; skipping leave_request");
              return;
            }
            const isJunior = await EmployeeHierarchy.exists({ junior: emp._id });
            if (!isJunior) {
              console.log("⚠️ [Watcher] Not a junior; skipping");
              return;
            }

            // Extract dates from the body (DD/MM/YYYY or DD-MM-YYYY)
            const datePattern = /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/g;
            const dates = [];
            let m;
            while ((m = datePattern.exec(bodyText)) !== null) {
              const [_, d, mo, y] = m;
              dates.push(new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`));
            }
            if (!dates.length) {
              if (/\btomorrow\b/i.test(bodyText)) {
                const t = new Date();
                t.setDate(t.getDate() + 1);
                dates.push(t);
              } else if (/\btoday\b/i.test(bodyText)) {
                dates.push(new Date());
              }
            }
            if (!dates.length) {
              console.log("⚠️ [Watcher] No dates found; skipping");
              return;
            }

            const start = dates[0];
            const end = dates[1] || start;
            const daysRequested = Math.ceil((end - start) / 86400000) + 1;
            const noticeDays = Math.ceil((start.getTime() - Date.now()) / 86400000);

            const paid = await analyzeLeavePolicy(emp, { daysRequested, noticeDays });

            const leave = await Leaves.create({
              employee: emp._id,
              date: start,
              endDate: end,
              daysRequested,
              noticeDays,
              requestText: bodyText,
              leaveType: paid ? "Paid" : "Unpaid",
              status: "Pending",
              requestedAt: new Date(),
            });

            const juniorReply = paid
              ? `Dear ${emp.name},\n\nYour leave request for ${start.toDateString()} has been recorded as PAID leave.\n\nBest regards,\nHR Team`
              : `Dear ${emp.name},\n\nYour leave request for ${start.toDateString()} has been recorded as UNPAID leave.\nShort notice: ${noticeDays} day(s).\n\nBest regards,\nHR Team`;

            await sendEmail(emp.email, juniorReply, "Leave Request Recorded");

            if (leave.leaveType === "Unpaid") {
              await applyUnpaidLeaveToSalarySlipForEmployee(emp._id, start);
            }

            const hier = await EmployeeHierarchy.findOne({ junior: emp._id }).populate("senior");
            if (hier?.senior) {
              const msg = `Employee: ${emp.name}
Dates: ${start.toDateString()}
Days: ${daysRequested}
Notice: ${noticeDays} day(s)

Reply with “APPROVE” or “REJECT [reason]”`;
              await sendEmail(hier.senior.email, msg, `Leave Approval Request for ${emp.name}`);
            }
            return;
          }

          // 6d) Handle “hr_related”
          if (label === "hr_related") {
            const quote = await generateHRReply(bodyText);
            await sendEmail(fromAddr, quote, "HR Policy Info");
            return;
          }

          // 6e) Unrecognized label
          console.log("⚠️ [Watcher] Unrecognized label, skipping:", label);
        } catch (err) {
          console.error("❌ [Watcher] Processing error:", err);
        }
      })
    );

    fetcher.once("error", (err) => console.error("❌ [Watcher] Fetch error:", err));
    fetcher.once("end", () => console.log("✓ [Watcher] Done fetching"));
  });
}

function startWatcher() {
  imap.once("ready", () => {
    imap.openBox("INBOX", false, (err) => {
      if (err) return console.error("❌ [Watcher] openBox error:", err);
      console.log("📬 [Watcher] INBOX opened");
      imap.on("mail", checkLatest);
      checkLatest(); // initial pass for unseen messages
    });
  });

  imap.once("error", (err) => console.error("❌ [Watcher] IMAP error:", err));
  imap.connect();
}

// -------------------------------------------------------------
// Deduct unpaid‐leave days on that month’s salary slip
// -------------------------------------------------------------
async function applyUnpaidLeaveToSalarySlipForEmployee(employeeId, leaveDate) {
  const dateObj = new Date(leaveDate);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month, 1);

  // 1) Find the slip for that month
  const slip = await SalarySlip.findOne({
    employee: employeeId,
    generatedOn: { $gte: monthStart, $lt: nextMonth },
  });
  if (!slip) {
    console.log(
      `⚠️ [Watcher] No salary slip for ${employeeId} in ${year}-${month}`
    );
    return;
  }

  // 2) Gather all Unpaid leaves
  const leaves = await Leaves.find({
    employee: employeeId,
    leaveType: "Unpaid",
  });

  // 3) Count how many fall in our month
  const unpaidDays = leaves.reduce((cnt, lv) => {
    const d = new Date(lv.date);
    return d >= monthStart && d < nextMonth ? cnt + 1 : cnt;
  }, 0);

  console.log(`→ [Watcher] unpaidDays: ${unpaidDays}`);

  if (unpaidDays > 0) {
    const perDaySalary = slip.basic / 30;
    const deduction = unpaidDays * perDaySalary;

    slip.leaveDeductions = deduction;
    slip.totalDeductions += deduction;
    slip.netPayable = slip.netPayable - deduction;

    console.log(`→ [Watcher] leaveDeductions: ${slip.leaveDeductions}`);
    console.log(`→ [Watcher] totalDeductions: ${slip.totalDeductions}`);
    console.log(`→ [Watcher] netPayable: ${slip.netPayable}`);
  } else {
    slip.leaveDeductions = 0;
    console.log("→ [Watcher] no unpaid days to deduct");
  }

  await slip.save();
  console.log(`✅ [Watcher] SalarySlip ${slip._id} updated.`);
}

module.exports = { startWatcher };
