const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'olzhas.zhadirasin@gmail.com',
    pass: 'longbrain14'
  }
});

async function sendSubscribedEmail(toEmail, book) {
  const mailOptions = {
    from: 'olzhas.zhadirasin@gmail.com',
    to: toEmail,
    subject: 'You received a book',
    text: 'You received a book: ' + book.title
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        reject(error)
      } else {
        resolve(info);
      }
    });
  })
}


async function sendReturnEmail(toEmail, book) {
  const mailOptions = {
    from: 'olzhas.zhadirasin@gmail.com',
    to: toEmail,
    subject: 'You need to return a book',
    text: 'You need to return a book: ' + book.title
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        reject(error)
      } else {
        resolve(info);
      }
    });
  })
}

module.exports = {
  sendSubscribedEmail,
  sendReturnEmail,
}
