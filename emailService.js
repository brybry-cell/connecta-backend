const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, text) => {
  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_USER, // must match verified sender
      subject,
      text
    });

    console.log("EMAIL SENT via SendGrid");
    return true;
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    return false;
  }
};

module.exports = { sendEmail };