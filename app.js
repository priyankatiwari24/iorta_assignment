const express = require('express'),
    { createLogger, format, transports } = require('winston'),
    { combine, timestamp, prettyPrint } = format;
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');

const app = express(),
    port = 4500;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

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
var User = mongoose.model('User', UserSchema)


app.get('/', (req, res) => {
    res.render('signup');
    logger.info("Sign Up page rendering");
})

app.post('/signup',
    //===========================validation starts ==========================
    [
        check('firstname')
            .notEmpty().withMessage('Name cannot be empty'),
        check('lastname')
            .notEmpty().withMessage('Name cannot be empty'),
        check('email', 'email is not valid')
            .isEmail().normalizeEmail(),
        check('password', 'The password must be 5+ chars long and contain a number')
            .not().isIn(['123', 'password', 'god']).withMessage('Do not use a common word as the password')
            .isLength({ min: 5 })
            .matches(/\d/)
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        //=================validation ends ==================================

        let userExists = await checkUserExist(req.body.email);
        console.log(userExists);
        if (!userExists) {
            let myData = new User(req.body);
            myData.save()
                .then(item => {
                    console.log("item :  === ", item);
                    sendEmail(req.body.email, req.body.firstname);
                    res.send("item saved to database");
                })
                .catch(err => {
                    res.status(400).send("unable to save to database");
                });
        } else {
            res.send("User already exists.");
        }
    })

function revertModule(email) {
    User.deleteMany({ email: email }, function (err, obj) {
        logger.log("Reverted " + obj.n + " entries form database")
    })
}

async function checkUserExist(email) {
    try {
        let response = await User.findOne({ email: email });
        if (response) {
            return true;
        }
        return false;
    } catch (e) {
        console.log("error in cathc : ", e);
    }
}

function sendEmail(toEmail, firstname) {
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
            revertModule(toEmail);
        }
    });
}

app.listen(port, () => console.log(`app listening on port ${port}!`));