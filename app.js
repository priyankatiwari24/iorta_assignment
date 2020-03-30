const express = require('express'),
    { createLogger, format, transports } = require('winston'),
    { combine, timestamp, prettyPrint } = format,
    { check, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./config/config');

const app = express(),
    port = config.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

//logging module 
const logger = createLogger({
    format: combine(
        timestamp(),
        prettyPrint()
    ),
    transports: [new transports.Console(),
    new transports.File({ filename: 'combined.log' })]
})

const url = "mongodb://localhost:27017/profile";

// Connecting to the database
mongoose.connect(url, {
    useNewUrlParser: true
}).then(() => {
    console.log("Successfully connected to the database");
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});

var UserSchema = new mongoose.Schema(
    {
        'firstname': String,
        'lastname': String,
        'email': String,
        'password': String
    }
)
var User = mongoose.model('user', UserSchema)

app.get('/', (req, res) => {
    res.render('signup', { message: 'signup page', status: 2 });
    logger.info("Sign Up page rendering");
})

app.get('/signup', (req, res) => {
    res.render('signup', { message: 'signup page', status: 2 });
    logger.info("Sign Up page rendering");
})


app.post('/signup',
    [
        check('firstname')
            .notEmpty().withMessage('Name cannot be empty.')
            .isAlpha().withMessage('Firstname must be in String Only.'),
        check('lastname')
            .notEmpty().withMessage('Name cannot be empty.')
            .isAlpha().withMessage('Lastname must be in String Only.'),
        check('email', 'email is not valid')
            .isEmail().normalizeEmail(),
        check('password', 'The password must be 5+ chars long and contain a number.')
            .not().isIn(['123', 'password', 'god']).withMessage('Do not use a common word as the password.')
            .isLength({ min: 5 })
            .matches(/\d/)
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // return res.status(422).json({ errors: errors.array() });
            let obj = errors.array();
            let errStr = '';
            obj.forEach(msg => {
                errStr += msg.msg;
            })
            res.render('signup', { message: errStr, status: 0 })
        }

        let userExists = await checkUserExist(req.body.email);
        logger.info("userExists : " + userExists);
        if (!userExists) {
            let myData = new User(req.body);
            myData.save()
                .then(item => {
                    logger.info("Save item into database : " + item);
                    sendEmail(item.email, item.firstname);
                    res.render('signup', { message: "Signup Successful!", status: 1 });
                })
                .catch(err => {
                    logger.error("catch error : " + err)
                    // res.status(400).send("unable to save to database");
                    res.render('signup', { message: "Some technical error occured. Contact Admin.", status: 0 })
                });
        } else {
            res.render('signup', { message: "User already exists", status: 0 });
        }
    })

function revertModule(email) {
    User.deleteMany({ email: email }, function (err, obj) {
        logger.info("inside revert module : === result of delete query :  " + obj.n);
        logger.error("inside revert module : === error of delete query : " + err);
    })
}

async function checkUserExist(email) {
    try {
        let response = await User.findOne({ email: email });
        logger.info("User exists : " + email);
        if (response) {
            return true;
        }
        return false;
    } catch (e) {
        logger.error("UserExist in catch : " + e);
    }
}

function sendEmail(toEmail, firstname) {
    logger.info("Inside sendEmail === Email assuming username : " + toEmail);
    var API_KEY = '8a4cd44754fb35a060c681ee3ff44dba-ed4dc7c4-02cba843';
    var DOMAIN = 'sandbox6facdd9cf25c4167b390b123189e4412.mailgun.org';
    var mailgun = require('mailgun-js')({ apiKey: API_KEY, domain: DOMAIN });

    const data = {
        from: 'Priyanka Upadhyay <me@sandbox6facdd9cf25c4167b390b123189e4412.mailgun.org>',
        to: toEmail,
        subject: 'Sign up successfully, Welcome!',
        text: 'Hello ' + firstname + ',\n You have successfully signed up! \n Thanks!'
    };

    mailgun.messages().send(data, (error, body) => {
        if (error) {
            logger.error("Inside send === error from mailgun : " + error);
            revertModule(toEmail);
        }
    });
}

app.listen(port, () => console.log(`app listening on port ${port}!`));