const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,      // your email
    pass: process.env.EMAIL_PASS       // app password (NOT normal password)
  }
});

const sendEmail = async (to, subject, text) => {
  try {
    console.log("Sending email to:", to); // 👈 PUT IT HERE

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });

    console.log("EMAIL SENT:", info.response); // 👈 ALSO ADD THIS

    return true;
  } catch (err) {
    console.error("EMAIL ERROR:", err); // 👈 AND THIS

    return false;
  }
};

module.exports = { sendEmail };