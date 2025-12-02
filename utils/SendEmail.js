import nodemailer from "nodemailer";

export async function sendEmail(to, subject, html) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `Reactors App <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent to:", to);
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
}
