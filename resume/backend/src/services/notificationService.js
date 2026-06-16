/**
 * notificationService.js
 *
 * Sends interview notifications via:
 *   - Gmail (Nodemailer + App Password)
 *   - WhatsApp Business API (Meta Cloud API)
 *
 * Required .env variables:
 *   GMAIL_USER=your@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char App Password from Google)
 *   GMAIL_FROM_NAME=ObserveNow People         (optional display name)
 *
 *   META_WHATSAPP_TOKEN=EAAxxxx...            (Permanent token from Meta Business)
 *   META_WHATSAPP_PHONE_ID=1234567890         (Phone Number ID from Meta dashboard)
 *   META_WHATSAPP_TEMPLATE_NAME=interview_scheduled  (Template name you created)
 *   META_WHATSAPP_TEMPLATE_LANG=en_US         (Template language code)
 */

// import nodemailer from "nodemailer";
// import fetch from "node-fetch";

// // ─── Gmail Transporter ────────────────────────────────────────────────────────

// const createGmailTransporter = () => {
//   const user = process.env.GMAIL_USER;
//   const pass = process.env.GMAIL_APP_PASSWORD;

//   if (!user || !pass) {
//     throw new Error(
//       "Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env. " +
//       "Generate an App Password at https://myaccount.google.com/apppasswords"
//     );
//   }

//   return nodemailer.createTransport({
//     service: "gmail",
//     auth: { user, pass },
//   });
// };

// // ─── Email Templates ──────────────────────────────────────────────────────────

// const formatDate = (dateStr) => {
//   if (!dateStr) return "TBD";
//   try {
//     return new Date(dateStr).toLocaleDateString("en-IN", {
//       weekday: "long", day: "numeric", month: "long", year: "numeric",
//     });
//   } catch {
//     return dateStr;
//   }
// };

// const typeLabel = { video: "Video Call", phone: "Phone Interview", f2f: "In-Person Interview" };
// const roundLabel = { "1": "Round 1", "2": "Round 2", hr: "HR Round" };

// const buildCandidateEmailHtml = ({ candidateName, role, interviewType, round, date, slot, duration, interviewers, meetLink, location, message, companyName }) => `
// <!DOCTYPE html>
// <html>
// <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
// <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
//   <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
//     <tr><td align="center">
//       <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
//         <!-- Header -->
//         <tr>
//           <td style="background:#534AB7;padding:28px 32px;">
//             <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">📅 Interview Scheduled</p>
//             <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${companyName || "ObserveNow People"}</p>
//           </td>
//         </tr>
//         <!-- Body -->
//         <tr>
//           <td style="padding:28px 32px;">
//             <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hi <strong>${candidateName}</strong>,</p>
//             <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.6;">
//               You are invited for an interview for the <strong>${role}</strong> role.
//               Please find the details below:
//             </p>

//             <!-- Details Card -->
//             <table width="100%" style="background:#f8f7ff;border-radius:8px;border:1px solid #ede9fe;margin-bottom:20px;">
//               <tr><td style="padding:20px 24px;">
//                 <table width="100%" cellpadding="0" cellspacing="0">
//                   ${[
//                     ["Interview Type", typeLabel[interviewType] || interviewType],
//                     ["Round", roundLabel[round] || round],
//                     ["Date", formatDate(date)],
//                     ["Time", slot || "TBD"],
//                     ["Duration", duration ? `${duration} minutes` : "TBD"],
//                     interviewers?.length ? ["Interviewer(s)", interviewers.join(", ")] : null,
//                     meetLink ? ["Meeting Link", `<a href="${meetLink}" style="color:#534AB7;">${meetLink}</a>`] : null,
//                     location ? ["Location", location] : null,
//                   ]
//                   .filter(Boolean)
//                   .map(([label, val]) => `
//                     <tr>
//                       <td style="padding:5px 0;font-size:13px;color:#71717a;width:130px;vertical-align:top;">${label}</td>
//                       <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;">${val}</td>
//                     </tr>
//                   `).join("")}
//                 </table>
//               </td></tr>
//             </table>

//             ${message ? `
//             <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
//               <p style="margin:0;font-size:13px;color:#78350f;"><strong>Note from HR:</strong> ${message}</p>
//             </div>` : ""}

//             <p style="margin:0 0 8px;font-size:13px;color:#52525b;">
//               If you have any questions or need to reschedule, kindly contact to HR.
//             </p>
//             <p style="margin:0;font-size:13px;color:#52525b;">We look forward to speaking with you!</p>
//           </td>
//         </tr>
//         <!-- Footer -->
//         <tr>
//           <td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
//             <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
//               ${companyName || "ObserveNow People"} · This is an automated message from our HR system.
//             </p>
//           </td>
//         </tr>
//       </table>
//     </td></tr>
//   </table>
// </body>
// </html>
// `;

// const buildInterviewerEmailHtml = ({ interviewerName, candidateName, role, interviewType, round, date, slot, duration, meetLink, location, companyName }) => `
// <!DOCTYPE html>
// <html>
// <head><meta charset="UTF-8"></head>
// <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
//   <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
//     <tr><td align="center">
//       <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
//         <tr>
//           <td style="background:#18181b;padding:28px 32px;">
//             <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">🎯 Interview Assignment</p>
//             <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${companyName || "ObserveNow People"}</p>
//           </td>
//         </tr>
//         <tr>
//           <td style="padding:28px 32px;">
//             <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hi <strong>${interviewerName}</strong>,</p>
//             <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.6;">
//               You have been assigned as an interviewer for <strong>${candidateName}</strong> — <strong>${role}</strong>.
//             </p>
//             <table width="100%" style="background:#f9fafb;border-radius:8px;border:1px solid #e4e4e7;margin-bottom:20px;">
//               <tr><td style="padding:20px 24px;">
//                 <table width="100%" cellpadding="0" cellspacing="0">
//                   ${[
//                     ["Candidate", candidateName],
//                     ["Role", role],
//                     ["Type", typeLabel[interviewType] || interviewType],
//                     ["Round", roundLabel[round] || round],
//                     ["Date", formatDate(date)],
//                     ["Time", slot || "TBD"],
//                     ["Duration", duration ? `${duration} minutes` : "TBD"],
//                     meetLink ? ["Meeting Link", `<a href="${meetLink}" style="color:#534AB7;">${meetLink}</a>`] : null,
//                     location ? ["Location", location] : null,
//                   ]
//                   .filter(Boolean)
//                   .map(([label, val]) => `
//                     <tr>
//                       <td style="padding:5px 0;font-size:13px;color:#71717a;width:130px;">${label}</td>
//                       <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;">${val}</td>
//                     </tr>
//                   `).join("")}
//                 </table>
//               </td></tr>
//             </table>
//             <p style="margin:0;font-size:13px;color:#52525b;">Please be available at the scheduled time. Reply to this email if you have any concerns.</p>
//           </td>
//         </tr>
//         <tr>
//           <td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
//             <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">${companyName || "ObserveNow People"} · HR System</p>
//           </td>
//         </tr>
//       </table>
//     </td></tr>
//   </table>
// </body>
// </html>
// `;

// // ─── Send Email ───────────────────────────────────────────────────────────────

// export const sendInterviewEmail = async ({
//   to,                  // string or string[] — recipient email(s)
//   subject,
//   html,
//   replyTo,
// }) => {
//   const transporter = createGmailTransporter();
//   const fromName = process.env.GMAIL_FROM_NAME || "ObserveNow People";
//   const fromEmail = process.env.GMAIL_USER;

//   const info = await transporter.sendMail({
//     from: `"${fromName}" <${fromEmail}>`,
//     to: Array.isArray(to) ? to.join(", ") : to,
//     subject,
//     html,
//     replyTo: replyTo || fromEmail,
//   });

//   return { messageId: info.messageId, accepted: info.accepted };
// };

// // ─── WhatsApp Business API (Meta Cloud API) ───────────────────────────────────

// /**
//  * Sends a WhatsApp template message.
//  *
//  * The template must be pre-approved in your Meta Business Manager.
//  * Template variables ({{1}}, {{2}}, ...) are passed as `components`.
//  *
//  * Default template variable mapping (adjust to match your approved template):
//  *   {{1}} = candidate_name
//  *   {{2}} = role
//  *   {{3}} = date
//  *   {{4}} = time/slot
//  *   {{5}} = interview_type
//  */
// export const sendWhatsAppMessage = async ({
//   to,           // phone number with country code, e.g. "919876543210"
//   templateName,
//   languageCode,
//   components,   // array of component objects for template variables
// }) => {
//   const token = process.env.META_WHATSAPP_TOKEN;
//   const phoneId = process.env.META_WHATSAPP_PHONE_ID;
//   const tplName = templateName || process.env.META_WHATSAPP_TEMPLATE_NAME || "interview_scheduled";
//   const tplLang = languageCode || process.env.META_WHATSAPP_TEMPLATE_LANG || "en_US";

//   if (!token || !phoneId) {
//     throw new Error(
//       "Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID in .env. " +
//       "Get these from your Meta Business Manager → WhatsApp → API Setup."
//     );
//   }

//   // Format the phone number — strip any non-digits
//   const phone = String(to).replace(/\D/g, "");
//   if (!phone || phone.length < 10) {
//     throw new Error(`Invalid phone number: ${to}`);
//   }

//   const body = {
//     messaging_product: "whatsapp",
//     to: phone,
//     type: "template",
//     template: {
//       name: tplName,
//       language: { code: tplLang },
//       components: components || [],
//     },
//   };

//   const response = await fetch(
//     `https://graph.facebook.com/v19.0/${phoneId}/messages`,
//     {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(body),
//     }
//   );

//   const data = await response.json();

//   if (!response.ok || data.error) {
//     throw new Error(
//       `WhatsApp API error: ${data.error?.message || JSON.stringify(data)}`
//     );
//   }

//   return { messageId: data.messages?.[0]?.id, status: "sent" };
// };

// // ─── High-level: Send all interview notifications ─────────────────────────────

// /**
//  * Call this after an interview is saved to DB.
//  * Handles email to candidate + interviewers, and WhatsApp to candidate.
//  *
//  * @param {object} interview  — the saved interview row from Supabase
//  * @param {object} candidate  — resume_candidates row (needs email, phone, full_name)
//  * @param {object} job        — resume_jobs row (needs title)
//  */
// export const sendInterviewNotifications = async (interview, candidate, job) => {
//   const results = {
//     candidateEmail: null,
//     interviewerEmails: [],
//     candidateWhatsApp: null,
//     errors: [],
//   };

//   const role = job?.title || interview?.job_id || "the role";
//   const companyName = process.env.COMPANY_NAME || "ObserveNow People";

//   const interviewData = {
//     candidateName: candidate?.full_name || "Candidate",
//     role,
//     interviewType: interview?.interview_type,
//     round: interview?.round,
//     date: interview?.scheduled_date,
//     slot: interview?.scheduled_slot,
//     duration: interview?.duration_minutes,
//     interviewers: interview?.interviewers || [],
//     meetLink: interview?.meet_link || null,
//     location: interview?.location || null,
//     message: interview?.message || null,
//     companyName,
//   };

//   const notifyVia = interview?.notify_via || "email"; // "email" | "whatsapp" | "both"
//   const sendEmail = notifyVia === "email" || notifyVia === "both";
//   const sendWhatsApp = notifyVia === "whatsapp" || notifyVia === "both";

//   // 1. Email to candidate
//   if (sendEmail && candidate?.email) {
//     try {
//       const result = await sendInterviewEmail({
//         to: candidate.email,
//         subject: `Interview Scheduled: ${companyName} — ${interviewData.date ? formatDate(interviewData.date) : "Date TBD"}`,
//         html: buildCandidateEmailHtml(interviewData),
//       });
//       results.candidateEmail = { status: "sent", ...result };
//     } catch (err) {
//       results.errors.push({ type: "candidateEmail", error: err.message });
//     }
//   }

//   // 2. Email to each interviewer (if they have an email address)
//   if (sendEmail && interview?.interviewers?.length) {
//     for (const interviewer of interview.interviewers) {
//       // interviewer can be "Name <email@company.com>" or just "email@company.com"
//       const emailMatch = interviewer.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
//       const nameMatch = interviewer.match(/^([^<]+)</);
//       const interviewerEmail = emailMatch?.[1];
//       const interviewerName = nameMatch?.[1]?.trim() || interviewer.replace(/<.*>/, "").trim() || interviewer;

//       if (interviewerEmail) {
//         try {
//           const result = await sendInterviewEmail({
//             to: interviewerEmail,
//             subject: `Interview Assigned: ${interviewData.candidateName} for ${companyName}`,
//             html: buildInterviewerEmailHtml({ ...interviewData, interviewerName }),
//           });
//           results.interviewerEmails.push({ interviewer: interviewerEmail, status: "sent", ...result });
//         } catch (err) {
//           results.errors.push({ type: "interviewerEmail", interviewer, error: err.message });
//         }
//       }
//     }
//   }

//   // 3. WhatsApp to candidate
//   if (sendWhatsApp && candidate?.phone) {
//     try {
//       // Build template components — adjust variable order to match your approved template
//       const components = [
//         {
//           type: "body",
//           parameters: [
//             { type: "text", text: interviewData.candidateName },
//             { type: "text", text: role },
//             { type: "text", text: interviewData.date ? formatDate(interviewData.date) : "TBD" },
//             { type: "text", text: interviewData.slot || "TBD" },
//             { type: "text", text: typeLabel[interviewData.interviewType] || interviewData.interviewType || "Interview" },
//           ],
//         },
//       ];

//       const result = await sendWhatsAppMessage({
//         to: candidate.phone,
//         components,
//       });
//       results.candidateWhatsApp = { status: "sent", ...result };
//     } catch (err) {
//       results.errors.push({ type: "candidateWhatsApp", error: err.message });
//     }
//   }

//   return results;
// };


/**
 * notificationService.js
 *
 * Sends interview notifications via:
 *   - Gmail (Nodemailer + App Password)
 *   - WhatsApp Business API (Meta Cloud API)
 *
 * Required .env variables:
 *   GMAIL_USER=your@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char App Password from Google)
 *   GMAIL_FROM_NAME=ObserveNow People         (optional display name)
 *
 *   META_WHATSAPP_TOKEN=EAAxxxx...            (Permanent token from Meta Business)
 *   META_WHATSAPP_PHONE_ID=1234567890         (Phone Number ID from Meta dashboard)
 *   META_WHATSAPP_TEMPLATE_NAME=interview_scheduled  (Template name you created)
 *   META_WHATSAPP_TEMPLATE_LANG=en_US         (Template language code)
 */

import nodemailer from "nodemailer";
import fetch from "node-fetch";

// ─── Gmail Transporter ────────────────────────────────────────────────────────

const createGmailTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env. " +
      "Generate an App Password at https://myaccount.google.com/apppasswords"
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    logger: true,
    debug: true,
  });
};

// ─── Email Templates ──────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return "TBD";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const typeLabel = { video: "Video Call", phone: "Phone Interview", f2f: "In-Person Interview" };
const roundLabel = { "1": "Round 1", "2": "Round 2", hr: "HR Round" };

const buildCandidateEmailHtml = ({ candidateName, role, interviewType, round, date, slot, duration, interviewers, meetLink, location, message, companyName }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#534AB7;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">📅 Interview Scheduled</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${companyName || "ObserveNow People"}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hi <strong>${candidateName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.6;">
              You are invited for an interview for the <strong>${role}</strong> role.
              Please find the details below:
            </p>

            <!-- Details Card -->
            <table width="100%" style="background:#f8f7ff;border-radius:8px;border:1px solid #ede9fe;margin-bottom:20px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${[
                    ["Interview Type", typeLabel[interviewType] || interviewType],
                    ["Round", roundLabel[round] || round],
                    ["Date", formatDate(date)],
                    ["Time", slot || "TBD"],
                    ["Duration", duration ? `${duration} minutes` : "TBD"],
                    interviewers?.length ? ["Interviewer(s)", interviewers.join(", ")] : null,
                    meetLink ? ["Meeting Link", `<a href="${meetLink}" style="color:#534AB7;">${meetLink}</a>`] : null,
                    location ? ["Location", location] : null,
                  ]
                  .filter(Boolean)
                  .map(([label, val]) => `
                    <tr>
                      <td style="padding:5px 0;font-size:13px;color:#71717a;width:130px;vertical-align:top;">${label}</td>
                      <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;">${val}</td>
                    </tr>
                  `).join("")}
                </table>
              </td></tr>
            </table>

            ${message ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#78350f;"><strong>Note from HR:</strong> ${message}</p>
            </div>` : ""}

            <p style="margin:0 0 8px;font-size:13px;color:#52525b;">
              If you have any questions or need to reschedule, kindly contact to HR.
            </p>
            <p style="margin:0;font-size:13px;color:#52525b;">We look forward to speaking with you!</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
              ${companyName || "ObserveNow People"} · This is an automated message from our HR system.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const buildInterviewerEmailHtml = ({ interviewerName, candidateName, role, interviewType, round, date, slot, duration, meetLink, location, companyName }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr>
          <td style="background:#18181b;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">🎯 Interview Assignment</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${companyName || "ObserveNow People"}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hi <strong>${interviewerName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.6;">
              You have been assigned as an interviewer for <strong>${candidateName}</strong> — <strong>${role}</strong>.
            </p>
            <table width="100%" style="background:#f9fafb;border-radius:8px;border:1px solid #e4e4e7;margin-bottom:20px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${[
                    ["Candidate", candidateName],
                    ["Role", role],
                    ["Type", typeLabel[interviewType] || interviewType],
                    ["Round", roundLabel[round] || round],
                    ["Date", formatDate(date)],
                    ["Time", slot || "TBD"],
                    ["Duration", duration ? `${duration} minutes` : "TBD"],
                    meetLink ? ["Meeting Link", `<a href="${meetLink}" style="color:#534AB7;">${meetLink}</a>`] : null,
                    location ? ["Location", location] : null,
                  ]
                  .filter(Boolean)
                  .map(([label, val]) => `
                    <tr>
                      <td style="padding:5px 0;font-size:13px;color:#71717a;width:130px;">${label}</td>
                      <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;">${val}</td>
                    </tr>
                  `).join("")}
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:13px;color:#52525b;">Please be available at the scheduled time. Reply to this email if you have any concerns.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">${companyName || "ObserveNow People"} · HR System</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Rejection Email Template ─────────────────────────────────────────────────

const buildRejectionEmailHtml = ({ candidateName, role, companyName, additionalNote }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${companyName || "ObserveNow People"}</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Application Update</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Dear <strong>${candidateName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.7;">
              Thank you for your interest in the <strong>${role}</strong> position at
              <strong>${companyName || "ObserveNow People"}</strong> and for taking the time to apply.
            </p>
            <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.7;">
              After careful consideration, we regret to inform you that we will not be moving
              forward with your application at this time. This was a difficult decision as we
              received many strong applications.
            </p>
            ${additionalNote ? `
            <div style="background:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
              <p style="margin:0;font-size:13px;color:#52525b;line-height:1.6;"><strong>Note:</strong> ${additionalNote}</p>
            </div>` : ""}
            <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.7;">
              We appreciate the time you invested in this process and encourage you to apply for
              future openings that match your experience and interests.
            </p>
            <p style="margin:0;font-size:14px;color:#52525b;">We wish you all the best in your job search.</p>
          </td>
        </tr>
        <!-- Sign off -->
        <tr>
          <td style="padding:0 32px 28px;">
            <p style="margin:0;font-size:14px;color:#18181b;font-weight:500;">Warm regards,</p>
            <p style="margin:4px 0 0;font-size:13px;color:#71717a;">HR Team, ${companyName || "ObserveNow People"}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
              ${companyName || "ObserveNow People"} · This is an automated message from our HR system.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Send Rejection Email ─────────────────────────────────────────────────────

const buildOfferEmailHtml = ({ candidateName, role, designation, ctc, joiningDate, reportingTo, additionalNote, companyName }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr>
          <td style="background:#534AB7;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">📄 Your Offer Letter</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${companyName || "ObserveNow People"}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hi <strong>${candidateName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.6;">
              Congratulations! We are pleased to share your offer details for the <strong>${designation || role}</strong> position.
            </p>
            <table width="100%" style="background:#f8f7ff;border-radius:8px;border:1px solid #ede9fe;margin-bottom:20px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${[
                    ["Role", designation || role],
                    ["CTC", ctc || "To be discussed"],
                    ["Joining Date", joiningDate || "TBD"],
                    ["Reporting To", reportingTo || "TBD"],
                  ]
                  .map(([label, val]) => `
                    <tr>
                      <td style="padding:5px 0;font-size:13px;color:#71717a;width:130px;vertical-align:top;">${label}</td>
                      <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;">${val}</td>
                    </tr>
                  `).join("")}
                </table>
              </td></tr>
            </table>
            ${additionalNote ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#78350f;"><strong>Note:</strong> ${additionalNote}</p>
            </div>` : ""}
            <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.7;">
              Your signed offer letter is attached to this email. Please review the document and reach out to HR if you have any questions.
            </p>
            <p style="margin:0;font-size:14px;color:#52525b;">We look forward to welcoming you to the team.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">${companyName || "ObserveNow People"} · This is an automated message from our HR system.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

export const sendOfferEmail = async ({ candidate, job, offer, attachment }) => {
  if (!candidate?.email) {
    console.warn("sendOfferEmail: candidate has no email, skipping.");
    return { status: "skipped", reason: "no email" };
  }

  const companyName = process.env.COMPANY_NAME || "ObserveNow People";
  const role = job?.title || "the position";
  const candidateName = candidate?.full_name || candidate?.name || "Candidate";
  const subject = `Offer Letter for ${role} from ${companyName}`;

  const emailOptions = {
    to: candidate.email,
    subject,
    html: buildOfferEmailHtml({
      candidateName,
      role,
      designation: offer.designation || role,
      ctc: offer.ctc || "To be discussed",
      joiningDate: offer.joining_date || offer.joiningDate || "TBD",
      reportingTo: offer.reporting_to || offer.reportingTo || "TBD",
      additionalNote: offer.additional_note || offer.additionalNote || "",
      companyName,
    }),
    attachments: [],
  };

  if (attachment?.buffer && attachment.filename) {
    console.log(`sendOfferEmail: attaching file name=${attachment.filename} size=${attachment.buffer.length}`);
    emailOptions.attachments.push({
      filename: attachment.filename,
      content: attachment.buffer,
      contentType: "application/pdf",
    });
  } else {
    console.log('sendOfferEmail: no attachment buffer or filename present');
  }

  const result = await sendInterviewEmail(emailOptions);
  return { status: "sent", ...result };
};

export const sendRejectionEmail = async (candidate, job, additionalNote = "") => {
  if (!candidate?.email) {
    console.warn("sendRejectionEmail: candidate has no email, skipping.");
    return { status: "skipped", reason: "no email" };
  }

  const companyName = process.env.COMPANY_NAME || "ObserveNow People";
  const role = job?.title || "the position";
  const candidateName = candidate?.full_name || "Candidate";

  try {
    const result = await sendInterviewEmail({
      to: candidate.email,
      subject: `Your Application Update — ${role} at ${companyName}`,
      html: buildRejectionEmailHtml({ candidateName, role, companyName, additionalNote }),
    });
    return { status: "sent", ...result };
  } catch (err) {
    console.error("Rejection email error:", err.message);
    return { status: "error", error: err.message };
  }
};

// ─── Send Email ───────────────────────────────────────────────────────────────

export const sendInterviewEmail = async ({
  to,                  // string or string[] — recipient email(s)
  subject,
  html,
  replyTo,
  attachments,
}) => {
  const transporter = createGmailTransporter();
  const fromName = process.env.GMAIL_FROM_NAME || "ObserveNow People";
  const fromEmail = process.env.GMAIL_USER;

  const recipient = Array.isArray(to) ? to.join(', ') : to;
  console.log(`sendInterviewEmail: sending email to=${recipient} subject=${subject} attachments=${Array.isArray(attachments)?attachments.length:0}`);

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient,
      subject,
      html,
      replyTo: replyTo || fromEmail,
      attachments: attachments && attachments.length ? attachments : undefined,
    });

    console.log('sendInterviewEmail: sent', { messageId: info.messageId, accepted: info.accepted });
    return { messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    console.error('sendInterviewEmail error:', err && err.message ? err.message : err);
    throw err;
  }
};

// ─── WhatsApp Business API (Meta Cloud API) ───────────────────────────────────

/**
 * Sends a WhatsApp template message.
 *
 * The template must be pre-approved in your Meta Business Manager.
 * Template variables ({{1}}, {{2}}, ...) are passed as `components`.
 *
 * Default template variable mapping (adjust to match your approved template):
 *   {{1}} = candidate_name
 *   {{2}} = role
 *   {{3}} = date
 *   {{4}} = time/slot
 *   {{5}} = interview_type
 */
export const sendWhatsAppMessage = async ({
  to,           // phone number with country code, e.g. "919876543210"
  templateName,
  languageCode,
  components,   // array of component objects for template variables
}) => {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_ID;
  const tplName = templateName || process.env.META_WHATSAPP_TEMPLATE_NAME || "interview_scheduled";
  const tplLang = languageCode || process.env.META_WHATSAPP_TEMPLATE_LANG || "en_US";

  if (!token || !phoneId) {
    throw new Error(
      "Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID in .env. " +
      "Get these from your Meta Business Manager → WhatsApp → API Setup."
    );
  }

  // Format the phone number — strip any non-digits
  const phone = String(to).replace(/\D/g, "");
  if (!phone || phone.length < 10) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: tplName,
      language: { code: tplLang },
      components: components || [],
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(
      `WhatsApp API error: ${data.error?.message || JSON.stringify(data)}`
    );
  }

  return { messageId: data.messages?.[0]?.id, status: "sent" };
};

// ─── High-level: Send all interview notifications ─────────────────────────────

/**
 * Call this after an interview is saved to DB.
 * Handles email to candidate + interviewers, and WhatsApp to candidate.
 *
 * @param {object} interview  — the saved interview row from Supabase
 * @param {object} candidate  — resume_candidates row (needs email, phone, full_name)
 * @param {object} job        — resume_jobs row (needs title)
 */
export const sendInterviewNotifications = async (interview, candidate, job) => {
  const results = {
    candidateEmail: null,
    interviewerEmails: [],
    candidateWhatsApp: null,
    errors: [],
  };

  const role = job?.title || interview?.job_id || "the role";
  const companyName = process.env.COMPANY_NAME || "ObserveNow People";

  const interviewData = {
    candidateName: candidate?.full_name || "Candidate",
    role,
    interviewType: interview?.interview_type,
    round: interview?.round,
    date: interview?.scheduled_date,
    slot: interview?.scheduled_slot,
    duration: interview?.duration_minutes,
    interviewers: interview?.interviewers || [],
    meetLink: interview?.meet_link || null,
    location: interview?.location || null,
    message: interview?.message || null,
    companyName,
  };

  const notifyVia = interview?.notify_via || "email"; // "email" | "whatsapp" | "both"
  const sendEmail = notifyVia === "email" || notifyVia === "both";
  const sendWhatsApp = notifyVia === "whatsapp" || notifyVia === "both";

  // 1. Email to candidate
  if (sendEmail && candidate?.email) {
    try {
      const result = await sendInterviewEmail({
        to: candidate.email,
        subject: `Interview Scheduled: ${companyName} — ${interviewData.date ? formatDate(interviewData.date) : "Date TBD"}`,
        html: buildCandidateEmailHtml(interviewData),
      });
      results.candidateEmail = { status: "sent", ...result };
    } catch (err) {
      results.errors.push({ type: "candidateEmail", error: err.message });
    }
  }

  // 2. Email to each interviewer (if they have an email address)
  if (sendEmail && interview?.interviewers?.length) {
    for (const interviewer of interview.interviewers) {
      // interviewer can be "Name <email@company.com>" or just "email@company.com"
      const emailMatch = interviewer.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      const nameMatch = interviewer.match(/^([^<]+)</);
      const interviewerEmail = emailMatch?.[1];
      const interviewerName = nameMatch?.[1]?.trim() || interviewer.replace(/<.*>/, "").trim() || interviewer;

      // Skip if interviewer email is same as candidate email — avoids duplicate/wrong email
      if (!interviewerEmail) continue;
      if (candidate?.email && interviewerEmail.toLowerCase() === candidate.email.toLowerCase()) {
        console.log(`Skipping interviewer email for ${interviewerEmail} — same as candidate.`);
        continue;
      }

      try {
        const result = await sendInterviewEmail({
          to: interviewerEmail,
          subject: `Interview Assigned: ${interviewData.candidateName} for ${companyName}`,
          html: buildInterviewerEmailHtml({ ...interviewData, interviewerName }),
        });
        results.interviewerEmails.push({ interviewer: interviewerEmail, status: "sent", ...result });
      } catch (err) {
        results.errors.push({ type: "interviewerEmail", interviewer, error: err.message });
      }
    }
  }

  // 3. WhatsApp to candidate
  if (sendWhatsApp && candidate?.phone) {
    try {
      // Build template components — adjust variable order to match your approved template
      const components = [
        {
          type: "body",
          parameters: [
            { type: "text", text: interviewData.candidateName },
            { type: "text", text: role },
            { type: "text", text: interviewData.date ? formatDate(interviewData.date) : "TBD" },
            { type: "text", text: interviewData.slot || "TBD" },
            { type: "text", text: typeLabel[interviewData.interviewType] || interviewData.interviewType || "Interview" },
          ],
        },
      ];

      const result = await sendWhatsAppMessage({
        to: candidate.phone,
        components,
      });
      results.candidateWhatsApp = { status: "sent", ...result };
    } catch (err) {
      results.errors.push({ type: "candidateWhatsApp", error: err.message });
    }
  }

  return results;
};