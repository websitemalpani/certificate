const nodemailer = require("nodemailer");
const env = require("../config/env");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

const sendEmailWithAttachment = async ({
  to,
  subject,
  text,
  attachmentPath,
}) => {
  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject,
    text,
    attachments: [
      {
        filename: attachmentPath.split("/").pop(),
        path: attachmentPath,
      },
    ],
  });
};

module.exports = { sendEmailWithAttachment };
