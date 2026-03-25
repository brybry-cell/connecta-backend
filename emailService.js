// backend/emailService.js
const nodemailer = require('nodemailer');

// Configure email transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS  // Your Gmail app password
  }
});

// Function to send email
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Email templates
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

const getNewsNotificationEmailTemplate = (title, category, description, postedBy) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #007CCF">
        <h2 style="color: #007CCF; margin: 0;">New Barangay Announcement</h2>
      </div>
      
      <div style="padding: 20px 0;">
        <h3 style="color: #333; margin-bottom: 10px;">${title}</h3>
        
        <div style="background-color: #f0f8ff; padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; display: inline-block;">
          <span style="color: #007CCF; font-size: 12px;">${category}</span>
        </div>
        
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          ${description.substring(0, 300)}${description.length > 300 ? '...' : ''}
        </p>
        
        <div style="background-color: #f5f5f5; padding: 12px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Posted by:</strong> ${postedBy}
          </p>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 20px;">
          Visit the barangay portal to read the full announcement and stay updated with the latest news.
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
  getReportStatusEmailTemplate,
  getNewsNotificationEmailTemplate
};