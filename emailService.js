const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // IMPORTANT
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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