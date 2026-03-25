const nodemailer = require('nodemailer');

console.log("📧 Loading email service...");
console.log("EMAIL_USER exists:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

// Configure email transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error.message);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// Function to send email
const sendEmail = async (to, subject, html) => {
  // Don't attempt to send if credentials are missing
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email credentials missing. Skipping email send.');
    return false;
  }

  try {
    const mailOptions = {
      from: `"Barangay Connecta" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    };

    console.log(`📧 Attempting to send email to: ${to}`);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return false;
  }
};

// Report Status Email Template (Only)
const getReportStatusEmailTemplate = (residentName, reportCategory, status, message) => {
  const statusColors = {
    reviewing: '#3b82f6',
    ongoing: '#f97316',
    resolved: '#10b981'
  };

  const statusMessages = {
    reviewing: 'under review',
    ongoing: 'currently being processed',
    resolved: 'resolved'
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid ${statusColors[status] || '#007CCF'}">
        <h2 style="color: ${statusColors[status] || '#007CCF'}; margin: 0;">Report Update</h2>
      </div>
      
      <div style="padding: 20px 0;">
        <p style="font-size: 16px; color: #333;">Dear <strong>${residentName}</strong>,</p>
        
        <p style="font-size: 16px; color: #333; margin-top: 15px;">
          Your report "<strong>${reportCategory}</strong>" has been <strong style="color: ${statusColors[status] || '#007CCF'}">${statusMessages[status] || status}</strong>.
        </p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #666;"><strong>Message from Barangay:</strong></p>
          <p style="margin: 10px 0 0 0; color: #333;">${message}</p>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 20px;">
          You can view the full details and track the progress of your report by logging into your account.
        </p>
      </div>
      
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999;">
        <p>This is an automated message from Barangay Connecta. Please do not reply to this email.</p>
      </div>
    </div>
  `;
};

module.exports = {
  sendEmail,
  getReportStatusEmailTemplate
};