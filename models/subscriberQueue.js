const { DateTime } = require("luxon");
  
var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var SubscriberQueueSchema = new Schema(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true }, //reference to the associated book
    user_list: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  }
);

//Export model
module.exports = mongoose.model('SubscriberQueue', SubscriberQueueSchema);
