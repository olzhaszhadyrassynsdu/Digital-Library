const mailer = require('../lib/mail');
var BookInstance = require('../models/bookinstance');

function sendNotifications() {
  setInterval(async () => {
    try {
      const bookInstances = await BookInstance.find({status: 'Loaned'})
        .populate('book')
        .populate('user')
        .exec();

      const DAY = 1000 * 60 * 60 * 24;
      const dueTime = Date.now() + DAY;

      for (let instance of bookInstances) {
        if (instance.due_back < dueTime && !instance.email_sent) {
          try {
            instance.email_sent = true;
            console.log('Sending email to: ', instance.user.email);
            await mailer.sendReturnEmail(instance.user.email, instance.book);
            await BookInstance.findByIdAndUpdate(instance.id, instance);
          } catch(err) {
            console.log(err);
          }
        }
      }
    } catch(err) {
      console.log(err);
    }
  }, 10000);
}


sendNotifications();
