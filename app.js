var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Authentication Packages
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var User = require('./models/user');
var flash = require('express-flash');
var MongoStore = new require('connect-mongo')(session);

var auth = require('./lib/auth');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var catalogRouter = require('./routes/catalog');  //Import routes for "catalog" area of site
require('./schedulers');

var app = express();

//Set up mongoose connection
var mongoose = require('mongoose');
var mongoDB = 'mongodb+srv://localadmin:As4558as@cluster0.imirm.mongodb.net/local_library?retryWrites=true&w=majority';
mongoose.connect(mongoDB, { useNewUrlParser: true , useUnifiedTopology: true});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Configure the local strategy for use by Passport.
passport.use(
  new LocalStrategy(function(username, password, callback) {
    User.findOne({ username: username }, function(err, user) {
      if (err) {
        return callback(err);
      }
      if (!user) {
        return callback(null, false, { message: 'Incorrect username. ' });
      }
      if (!user.validatePassword(password)) {
        return callback(null, false, { message: 'Incorrect password.' });
      }
      return callback(null, user);
    });
  })
);

// Configure Passport authenticated session persistence.
passport.serializeUser(function(user, callback) {
  callback(null, user._id);
});

passport.deserializeUser(function(id, callback) {
  User.findById(id, function(err, user) {
    if (err) {
      return callback(err);
    }
    callback(null, user);
  });
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication related middleware.
app.use(flash());
app.use(
  session({
    secret: 'local-library-session-secret',
    resave: false,
    saveUninitialized: true,
    store: new MongoStore({
      url: mongoDB,
      ttl: 7 * 24 * 60 * 60 // 7 days. 14 Default.
    })
    // cookie: { secure: true }
  })
);

// Initialize Passport and restore authentication state, if any,
// from the session.
app.use(passport.initialize());
app.use(passport.session());

// Pass isAuthenticated and current_user to all views.
app.use(function(req, res, next) {
  res.locals.isAuthenticated = req.isAuthenticated();
  // Delete salt and hash fields from req.user object before passing it.
  var safeUser = req.user;
  if (safeUser) {
    delete safeUser._doc.salt;
    delete safeUser._doc.hash;
  }
  res.locals.current_user = safeUser;
  next();
});

// Use our Authentication and Authorization middleware.
app.use(auth);

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/catalog', catalogRouter);  // Add catalog routes to middleware chain.

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
