import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Backend env load: SUPABASE_URL=", !!supabaseUrl, "SUPABASE_SERVICE_ROLE_KEY=", !!supabaseServiceRoleKey);

let supabase = null;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Backend upload route will be disabled.");
} else {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "backend running" });
});
 
app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend API running 🚀"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/email-config-debug", (req, res) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  res.json({
    gmailUserSet: !!gmailUser,
    gmailUserPreview: gmailUser ? `${gmailUser.substring(0, 5)}...${gmailUser.substring(gmailUser.length - 5)}` : null,
    gmailPassLength: gmailPass ? gmailPass.length : 0,
    gmailPassHasSpaces: gmailPass ? gmailPass.includes(" ") : false,
    warningMessage: gmailPass?.includes(" ") ? "⚠️ WARNING: Gmail app password contains spaces! This may cause authentication issues." : "OK"
  });
});

app.post("/api/test-email", async (req, res) => {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const testEmail = req.body.email;

    if (!testEmail) {
      return res.status(400).json({ error: "Test email address required in body" });
    }

    if (!gmailUser || !gmailPass) {
      return res.status(400).json({ error: "Gmail credentials not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.verify();
    
    await transporter.sendMail({
      from: gmailUser,
      to: testEmail,
      subject: "Test Email from HRMS Backend",
      text: "If you receive this, email configuration is working correctly!",
    });

    res.json({ status: "ok", message: `Test email sent to ${testEmail}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-user", async (req, res) => {
  console.log("/api/create-user hit");

  if (!supabase) {
    return res.status(500).json({ error: "Backend Supabase configuration missing." });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
    });

    if (error) {
      console.error("Create user error:", error);
      return res.status(400).json({ error: error.message });
    }

    console.log("User created successfully:", data.user?.id);

    // Send welcome email with login credentials to the candidate
    try {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD;
      const fromName = process.env.GMAIL_FROM_NAME || "ObserveNow People";
      const companyName = process.env.COMPANY_NAME || "ObserveNow People";
      const portalUrl = process.env.CANDIDATE_PORTAL_URL || "http://localhost:5173";

      console.log("📧 Email Config Check:");
      console.log("  - GMAIL_USER:", gmailUser ? `${gmailUser.substring(0, 10)}...` : "❌ NOT SET");
      console.log("  - GMAIL_APP_PASSWORD:", gmailPass ? "✅ SET (length: " + gmailPass.length + ")" : "❌ NOT SET");
      console.log("  - fromName:", fromName);
      console.log("  - companyName:", companyName);
      console.log("  - portalUrl:", portalUrl);

      if (gmailUser && gmailPass) {
        console.log("🔧 Creating email transporter...");
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: gmailUser, pass: gmailPass },
        });

        // Test connection before sending
        try {
          await transporter.verify();
          console.log("✅ Email transporter verified successfully");
        } catch (verifyErr) {
          console.error("❌ Email transporter verification failed:", verifyErr.message);
          throw new Error(`Gmail authentication failed: ${verifyErr.message}. Check your GMAIL_USER and GMAIL_APP_PASSWORD.`);
        }

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr>
          <td style="background:#5e22a4;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Welcome to ${companyName}! 🎉</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Your onboarding portal is ready</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hi there,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.7;">
              We're excited to have you join <strong>${companyName}</strong>! Your HR team has set up your onboarding portal.
              Please use the credentials below to log in and complete your onboarding process.
            </p>

            <table width="100%" style="background:#f8f7ff;border-radius:8px;border:1px solid #ede9fe;margin-bottom:20px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#4f2886;text-transform:uppercase;letter-spacing:0.05em;">Your Login Credentials</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#71717a;width:100px;">Portal URL</td>
                    <td style="padding:6px 0;font-size:13px;color:#18181b;font-weight:500;">
                      <a href="${portalUrl}" style="color:#5e22a4;">${portalUrl}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#71717a;">Email</td>
                    <td style="padding:6px 0;font-size:13px;color:#18181b;font-weight:500;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#71717a;">Password</td>
                    <td style="padding:6px 0;font-size:13px;color:#18181b;font-weight:500;">${password}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#78350f;">
                🔒 <strong>Important:</strong> Please change your password after your first login for security.
              </p>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:#52525b;line-height:1.6;">
              Once logged in, you'll be able to submit your documents, review your offer letter, and track your onboarding progress.
            </p>
            <p style="margin:0;font-size:13px;color:#52525b;">
              If you have any questions, please reach out to your HR team.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 20px;">
            <p style="margin:0;font-size:14px;color:#18181b;font-weight:500;">Welcome aboard!</p>
            <p style="margin:4px 0 0;font-size:13px;color:#71717a;">HR Team, ${companyName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
              ${companyName} · This is an automated message, please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await transporter.sendMail({
          from: `"${fromName}" <${gmailUser}>`,
          to: email,
          subject: `Welcome to ${companyName} — Your Login Credentials`,
          html,
        });

        console.log("✅ Welcome email sent successfully to:", email);
      } else {
        console.warn("⚠️  Gmail credentials not set — welcome email skipped.");
        if (!gmailUser) console.warn("  Missing: GMAIL_USER");
        if (!gmailPass) console.warn("  Missing: GMAIL_APP_PASSWORD");
      }
    } catch (emailErr) {
      // Log the error but don't block user creation
      console.error("❌ Welcome email error (non-blocking):", emailErr.message);
      console.error("   Stack:", emailErr.stack);
    }

    return res.json({
      status: "ok",
      userId: data.user?.id,
      email: data.user?.email,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ error: error?.message || "Failed to create user." });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("/api/upload hit: supabase=", !!supabase, "SUPABASE_URL=", !!supabaseUrl, "SERVICE_KEY=", !!supabaseServiceRoleKey);

  if (!supabase) {
    return res.status(500).json({ error: "Backend Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Missing file upload." });
  }

  const bucket = req.body.bucket || "documents";
  const employeeId = req.body.employeeId;
  const requestedPath = req.body.path;
  const file = req.file;
  const fileName = file.originalname.replace(/\s+/g, "_");
  const filePath = requestedPath || `${employeeId || "uploads"}/${Date.now()}-${fileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, { 
        upsert: true,
        contentType: file.mimetype || "application/pdf"
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Storage upload failed." });
    }

    const { data: publicData, error: publicUrlError } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (publicUrlError) {
      console.error("Supabase public URL error:", publicUrlError);
      return res.status(500).json({ error: publicUrlError.message || "Failed to generate public URL." });
    }

    console.log("File uploaded successfully:", { filePath, publicUrl: publicData.publicUrl });

    return res.json({
      status: "ok",
      bucket,
      path: filePath,
      publicUrl: publicData.publicUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error?.message || "Upload failed." });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled backend error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: err?.message || "Internal server error." });
});

if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(staticPath));

  app.use((req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";
// import multer from "multer";
// import { createClient } from "@supabase/supabase-js";

// const __filename = fileURLToPath(import.meta.url); 
// const __dirname = path.dirname(__filename);

// dotenv.config({ path: path.join(__dirname, ".env") });

// const app = express();
// const upload = multer({ storage: multer.memoryStorage() });

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// console.log("Backend env load: SUPABASE_URL=", !!supabaseUrl, "SUPABASE_SERVICE_ROLE_KEY=", !!supabaseServiceRoleKey);

// let supabase = null;
// if (!supabaseUrl || !supabaseServiceRoleKey) {
//   console.warn("Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Backend upload route will be disabled.");
// } else {
//   supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
//     auth: {
//       persistSession: false,
//     },
//   });
// }

// app.use(cors());
// app.use(express.json());

// app.get("/", (req, res) => {
//   res.json({ status: "backend running" });
// });
 
// app.get("/api", (req, res) => {
//   res.json({
//     status: "ok",
//     message: "Backend API running 🚀"
//   });
// });

// app.get("/api/health", (req, res) => {
//   res.json({
//     status: "healthy",
//     timestamp: new Date().toISOString()
//   });
// });

// app.post("/api/create-user", async (req, res) => {
//   console.log("/api/create-user hit");

//   if (!supabase) {
//     return res.status(500).json({ error: "Backend Supabase configuration missing." });
//   }

//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({ error: "Email and password are required." });
//   }

//   try {
//     const { data, error } = await supabase.auth.admin.createUser({
//       email,
//       password,
//       email_confirm: true, // Auto-confirm the email
//     });

//     if (error) {
//       console.error("Create user error:", error);
//       return res.status(400).json({ error: error.message });
//     }

//     console.log("User created successfully:", data.user?.id);
//     return res.json({
//       status: "ok",
//       userId: data.user?.id,
//       email: data.user?.email,
//     });
//   } catch (error) {
//     console.error("Create user error:", error);
//     return res.status(500).json({ error: error?.message || "Failed to create user." });
//   }
// });

// app.post("/api/upload", upload.single("file"), async (req, res) => {
//   console.log("/api/upload hit: supabase=", !!supabase, "SUPABASE_URL=", !!supabaseUrl, "SERVICE_KEY=", !!supabaseServiceRoleKey);

//   if (!supabase) {
//     return res.status(500).json({ error: "Backend Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: "Missing file upload." });
//   }

//   const bucket = req.body.bucket || "documents";
//   const employeeId = req.body.employeeId;
//   const requestedPath = req.body.path;
//   const file = req.file;
//   const fileName = file.originalname.replace(/\s+/g, "_");
//   const filePath = requestedPath || `${employeeId || "uploads"}/${Date.now()}-${fileName}`;

//   try {
//     const { error: uploadError } = await supabase.storage
//       .from(bucket)
//       .upload(filePath, file.buffer, { 
//         upsert: true,
//         contentType: file.mimetype || "application/pdf"
//       });

//     if (uploadError) {
//       console.error("Supabase upload error:", uploadError);
//       return res.status(500).json({ error: uploadError.message || "Storage upload failed." });
//     }

//     const { data: publicData, error: publicUrlError } = supabase.storage
//       .from(bucket)
//       .getPublicUrl(filePath);

//     if (publicUrlError) {
//       console.error("Supabase public URL error:", publicUrlError);
//       return res.status(500).json({ error: publicUrlError.message || "Failed to generate public URL." });
//     }

//     console.log("File uploaded successfully:", { filePath, publicUrl: publicData.publicUrl });

//     return res.json({
//       status: "ok",
//       bucket,
//       path: filePath,
//       publicUrl: publicData.publicUrl,
//     });
//   } catch (error) {
//     console.error("Upload error:", error);
//     return res.status(500).json({ error: error?.message || "Upload failed." });
//   }
// });

// app.use((err, req, res, next) => {
//   console.error("Unhandled backend error:", err);
//   if (res.headersSent) {
//     return next(err);
//   }
//   res.status(500).json({ error: err?.message || "Internal server error." });
// });

// if (process.env.NODE_ENV === "production") {
//   const staticPath = path.join(__dirname, "../frontend/dist");
//   app.use(express.static(staticPath));

//   app.use((req, res) => {
//     res.sendFile(path.join(staticPath, "index.html"));
//   });
// }

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });