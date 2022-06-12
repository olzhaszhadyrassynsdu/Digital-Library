const SubscriberQueue = require('../models/subscriberQueue');


exports.index = function (req, res, next) {
  SubscriberQueue.find()
    .populate('book user_list')
    .exec(function (err, list_authors) {
      if (err) { return next(err); }
      res.send(list_authors);
    });
};

