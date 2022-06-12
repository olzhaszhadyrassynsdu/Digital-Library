var Book = require('../models/book');
var BookInstance = require('../models/bookinstance');
var SubscriberQueue = require('../models/subscriberQueue');
const mailer = require('../lib/mail');

var async = require('async');

exports.index = function (req, res) {

    async.parallel({
        book_count: function (callback) {
            Book.countDocuments({}, callback); // Pass an empty object as match condition to find all documents of this collection
        },
        book_list: function (callback) {
            Book.find({}, 'title author image')
                .sort({ title: 1 })
                .populate('author')
                .exec(callback);
        },
        book_instances: function (callback) {
            BookInstance.find()
                .populate('user')
                .populate('book')
                .exec(callback);
        }
    }, function (err, results) {
        let book_instances = results.book_instances;
        if (req.isAuthenticated()) {
            book_instances = book_instances.filter((instance) => {
                if (instance.user) {
                    const instanceUserId = instance.user._id.toString();
                    const userId = req.user._id.toString();
                    return instanceUserId === userId && instance.status === 'Loaned';
                }
                return false;
            })
        } else {
            book_instances = null;
        }

        const book_list = results.book_list.map(book => {
            book.instances = results.book_instances.filter(item => {
                return item.book._id.toString() === book._id.toString()
            });
            return book;
        })

        var messages = extractFlashMessages(req);
        res.render('index', {
            title: 'Local Library Home',
            error: err,
            book_list: book_list,
            showLogin: !!req.query.login,
            user: req.user,
            book_instances,
            authorized: req.isAuthenticated(),
            errors: messages.length > 0 ? messages : null
        });
    });
};

// Display list of all Books.
exports.book_list = function (req, res, next) {

    Book.find({}, 'title author')
        .sort({ title: 1 })
        .populate('author')
        .exec(function (err, list_books) {
            if (err) { return next(err); }
            //Successful, so render
            res.render('book_list', { title: 'Book List', book_list: list_books });
        });

};


// Display detail page for a specific book.
// Display detail page for a specific book.
exports.book_detail = function (req, res, next) {

    async.parallel({
        book: function (callback) {

            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback);
        },
        book_instance: function (callback) {

            BookInstance.find({ 'book': req.params.id })
                .populate('user')
                .exec(callback);
        },
        queue_instance: function (callback) {
            SubscriberQueue.find({ 'book': req.params.id })
                .populate('user_list')
                .populate('book')
                .exec(callback);
        },
    }, function (err, results) {
        if (err) { return next(err); }
        if (results.book == null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }

        const queue_list = (results.queue_instance && results.queue_instance.length)
            ? results.queue_instance[0].user_list : [];

        const userInQueue = queue_list.findIndex(item => {
            return item.id === req.user.id
        });
        const DAY = 1000 * 60 * 60 * 24;
        const queueDate = new Date(results.book_instance[0].due_back.getTime() + DAY * ((4 * userInQueue) + 1));
        // Successful, so render.
        res.render('book_detail', {
            title: results.book.title,
            book: results.book,
            book_instances: results.book_instance,
            queue_list: queue_list || [],
            user: req.user,
            userInQueue: userInQueue,
            queueDate,
        });
    });

};

exports.book_cancel = function (req, res, next) {
    async.parallel({
        book: function (callback) {

            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback);
        },
        book_instance: function (callback) {
            BookInstance.find({ 'book': req.params.id })
                .populate('user')
                .exec(callback);
        },
        queue_instance: function (callback) {
            SubscriberQueue.find({ 'book': req.params.id })
                .populate('user_list')
                .populate('book')
                .exec(callback);
        },
    }, function (err, results) {
        if (err) { return next(err); }
        if (results.book == null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }

        const queue_list = (results.queue_instance && results.queue_instance.length)
            ? results.queue_instance[0].user_list : [];

        if (!queue_list.length) {
            BookInstance.find({ 'book': req.params.id })
                .populate('book')
                .exec(function (err, bookinstance) {
                    if (err) { return next(err); }
                    bookinstance = bookinstance[0]
                    bookinstance.status = 'Available';
                    BookInstance.findByIdAndUpdate(bookinstance.id, bookinstance, {}, function (err, thebookinstance) {
                        if (err) { return next(err); }
                        // Successful - redirect to detail page.
                        res.redirect(bookinstance.book.url);
                    });
                })
        } else {
            // Successful, so render.
            res.render('book_cancel', {
                title: results.book.title,
                book: results.book,
                book_instances: results.book_instance,
                queue_list: queue_list || [],
                user: req.user,
            });
        }
    });
};

exports.book_join_queue = function (req, res, next) {
    async.parallel({
        book: function (callback) {

            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback);
        },
        book_instance: function (callback) {

            BookInstance.find({ 'book': req.params.id })
                .populate('user')
                .exec(callback);
        },
        queue_instance: function (callback) {
            SubscriberQueue.find({ 'book': req.params.id })
                .populate('user_list')
                .populate('book')
                .exec(callback);
        },
    }, function (err, results) {
        if (err) { return next(err); }
        if (results.book == null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }

        const queue_instance = results.queue_instance[0];
        queue_instance.user_list.push(req.user);

        SubscriberQueue.findByIdAndUpdate(queue_instance.id, queue_instance, {}, function (err, updated) {
            if (err) { return next(err); }
            // Successful - redirect to detail page.
            res.redirect(results.book.url);
        });

    });
};

exports.book_send_next = function (req, res, next) {
    async.parallel({
        book: function (callback) {

            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback);
        },
        book_instance: function (callback) {

            BookInstance.find({ 'book': req.params.id })
                .populate('user')
                .exec(callback);
        },
        queue_instance: function (callback) {
            SubscriberQueue.find({ 'book': req.params.id })
                .populate('user_list')
                .populate('book')
                .exec(callback);
        },
    }, function (err, results) {
        if (err) { return next(err); }
        if (results.book == null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }

        const queue_instance = results.queue_instance[0];
        const book_instance = results.book_instance[0];

        const nextUser = queue_instance.user_list[0];
        queue_instance.user_list.shift();

        book_instance.status = 'Loaned';

        // Add 3 days to the current date
        const currentTimeMs = Date.now();
        const currentTimeMs_plus_3_days_ms = currentTimeMs + (1000 * 60 * 60 * 24) * 3;
        const date = new Date(currentTimeMs_plus_3_days_ms);
        book_instance.due_back = date;
        book_instance.user = nextUser.id;

        BookInstance.findByIdAndUpdate(book_instance.id, book_instance, {}, function (err, updatedData) {
            if (err) { return next(err); }

            SubscriberQueue.findByIdAndUpdate(queue_instance.id, queue_instance, {}, function (err, updated) {
                if (err) { return next(err); }
                mailer.sendSubscribedEmail(nextUser.email, results.book);
                // Successful - redirect to detail page.
                res.redirect(results.book.url);
            });
        });
    })
};

// Display book create form on GET.
exports.book_create_get = function (req, res) {
    res.send('NOT IMPLEMENTED: Book create GET');
};

// Handle book create on POST.
exports.book_create_post = function (req, res) {
    res.send('NOT IMPLEMENTED: Book create POST');
};

// Display book delete form on GET.
exports.book_delete_get = function (req, res) {
    res.send('NOT IMPLEMENTED: Book delete GET');
};

// Handle book delete on POST.
exports.book_delete_post = function (req, res) {
    res.send('NOT IMPLEMENTED: Book delete POST');
};

// Display book update form on GET.
exports.book_update_get = function (req, res) {
    res.send('NOT IMPLEMENTED: Book update GET');
};

// Handle book update on POST.
exports.book_update_post = function (req, res) {
    res.send('NOT IMPLEMENTED: Book update POST');
};

// Extract flash messages from req.flash and return an array of messages.
function extractFlashMessages(req) {
    var messages = [];
    // Check if flash messages was sent. If so, populate them.
    var errorFlash = req.flash('error');
    var successFlash = req.flash('success');

    // Look for error flash.
    if (errorFlash && errorFlash.length) messages.push({ msg: errorFlash[0] });

    // Look for success flash.
    if (successFlash && successFlash.length) messages.push({ msg: successFlash[0] });

    return messages;
}
