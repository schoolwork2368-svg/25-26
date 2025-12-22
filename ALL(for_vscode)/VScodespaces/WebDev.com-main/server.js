// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer'); // Import nodemailer

const app = express();
// Middleware to parse JSON bodies for POST requests
app.use(express.json());

// The PORT environment variable is used by hosting providers.
// If it's not set, we'll default to 3000 for local development.
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory (where server.js is located)
app.use(express.static(path.join(__dirname)));

// Nodemailer transporter setup
let transporter;
try {
    const emailService = process.env.EMAIL_SERVICE;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        console.error("Email user or password not set in .env. Email sending will not work.");
    } else {
        // Configure transporter based on service
        if (emailService.toLowerCase() === 'gmail') {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailUser,
                    pass: emailPass,
                },
            });
        } else if (emailService.toLowerCase() === 'outlook' || emailService.toLowerCase() === 'outlook365' || emailService.toLowerCase() === 'hotmail') {
            transporter = nodemailer.createTransport({
                host: 'smtp.office365.com', // Outlook SMTP host
                port: 587,
                secure: false, // Use 'true' for 465, 'false' for 587
                auth: {
                    user: emailUser,
                    pass: emailPass,
                },
                tls: {
                    ciphers: 'SSLv3' // Some older Outlook servers might need this
                }
            });
        } else {
            console.error(`Unsupported email service: ${emailService}. Please use 'Gmail' or 'Outlook'.`);
        }

        if (transporter) {
            // Verify connection configuration
            transporter.verify(function (error, success) {
                if (error) {
                    console.error("Nodemailer transporter verification failed:", error);
                } else {
                    console.log(`Nodemailer transporter configured for ${emailService} and ready to send messages.`);
                }
            });
        }
    }
} catch (error) {
    console.error("Error setting up Nodemailer transporter:", error);
}

// A catch-all route to send index.html for any request that doesn't match a static file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  // Confirm that email environment variables are loaded
  const emailUser = process.env.EMAIL_USER;
  console.log(`Email User Loaded: ${emailUser ? 'Yes' : 'No'}`);
});

// New route to handle email sending
app.post('/send-email', async (req, res) => { // This endpoint is for the contact form
    if (!transporter) {
        return res.status(500).json({ message: 'Email service not configured or failed to initialize.' });
    }

    // Extract email details from the request body
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Missing required fields: name, email, and message.' });
    }

    try {
        // Email options for the notification that will be sent to you
        let info = await transporter.sendMail({
            from: `"Web Dev Hub Contact" <${process.env.EMAIL_USER}>`, // Sender address (your app)
            to: process.env.EMAIL_USER, // Recipient address (you)
            subject: `New Contact Form Submission from ${name}`, // Subject line
            text: `You have a new message from:\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`, // Plain text body
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `, // HTML body
        });

        console.log("Message sent: %s", info.messageId);
        res.status(200).json({ message: 'Email sent successfully!', messageId: info.messageId });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: 'Failed to send email.', error: error.message });
    }
});