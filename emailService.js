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
    await transporter.sendMail({
      from: `"Connecta" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });

    return true;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
};

module.exports = { sendEmail };