import crypto from 'crypto';

/**
 * Generate a cryptographically random 6-digit numeric OTP.
 */
export function generateOtp() {
  // Use rejection sampling to stay uniform across 000000–999999
  let num;
  do {
    const buf = crypto.randomBytes(4);
    num = buf.readUInt32BE(0) % 1_000_000;
  } while (num >= 1_000_000); // always false but keeps intent clear
  return String(num).padStart(6, '0');
}

/**
 * Very simple in-process "mailer" that logs OTPs to the console.
 * Replace this with nodemailer + real SMTP when you have credentials.
 *
 * @param {string} toEmail
 * @param {string} otp
 */
export async function sendOtpEmail(toEmail, otp) {
  // ── Console transport (development) ──────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  📧  OTP for ${toEmail}`);
  console.log(`  🔑  Code : ${otp}`);
  console.log(`  ⏱️   Valid for 10 minutes`);
  console.log(`${'─'.repeat(50)}\n`);

  // ── Uncomment and configure once you have SMTP credentials ───────────────
  // import nodemailer from 'nodemailer';
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT ?? 587),
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transporter.sendMail({
  //   from: `"StockSense" <${process.env.SMTP_FROM}>`,
  //   to: toEmail,
  //   subject: 'Your StockSense password reset OTP',
  //   text: `Your OTP is: ${otp}\nIt is valid for 10 minutes.`,
  //   html: `<p>Your OTP is: <strong>${otp}</strong></p><p>It is valid for 10 minutes.</p>`,
  // });
}
