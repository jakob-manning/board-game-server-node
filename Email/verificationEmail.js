const sgMail = require('@sendgrid/mail')

const BACKEND = process.env.SERVER_BACKEND_ROOT + ""

const sendVerificationEmail = async (address, token) => {
    // Send the user a verificaiton email
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    const msg = {
        to: address, // Change to your recipient
        from: 'noreply@jakethesnake.ca', // Change to your verified sender
        subject: "Please Verify Your Email - Friendly Chat", // Subject line
        text: `Please Verify Your Email at ${BACKEND}/api/users/activate?token=${token}`,
        html: "<h1 style=\"text-align: center\">You're Almost There!</h1>" +
            `<p>Please verify your email <a href="${BACKEND}/api/users/activate/${token}">here</a> to continue</p>`,
    }
    try{
        let emailSent = await sgMail.send(msg)
        console.log('Email sent')
        console.log(emailSent)
    }catch (e) {
        console.error(e)
    }
}

module.exports = sendVerificationEmail