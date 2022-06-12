var express = require('express');
var router = express.Router();
var book_controller = require('../controllers/bookController');
const subscriberQueueController = require('../controllers/subscriberQueueController');

router.get('/', book_controller.index);
router.get('/queue', subscriberQueueController.index);

module.exports = router;
