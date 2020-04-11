const express = require('express'),
    { createLogger, format, transports } = require('winston'),
    { combine, timestamp, prettyPrint } = format,
    { check, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./config/config');

const SparkPost = require('sparkpost');
const client = new SparkPost('<API_KEY>');

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
    logger.error('Could not connect to the database. Exiting now : ' + err)
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
        check('email')
            .isEmail().normalizeEmail().withMessage('Email is not valid. '),
        check('password')
            .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$.!%*#?&])[A-Za-z\d@$.!%*#?&]{5,}$/)
            .withMessage('Password should contain at least one letter, one number and one special character ')
            .exists()
            .withMessage('Password should not be empty ')
            .isLength({ min: 5 })
            .withMessage('Password should be minimum five characters ')
            

    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let obj = errors.array();
            let errStr = '';
            obj.forEach(msg => {
                errStr += msg.msg;
            })
            res.render('signup', { message: errStr, status: 0 });
            return false;
        }

        let userExists = await checkUserExist(req.body.email);
        logger.info("userExists : " + userExists);
        if (!userExists) {
            let myData = new User(req.body);
            await myData.save()
                .then(async item => {
                    logger.info("Save item into database");
                    let s = await sendEmailSparkpost(item.email, item.firstname);
                    if (s) {
                        res.render('signup', { message: "Signup Successful!", status: 1 });
                    } else {
                        res.render('signup', { message: "Some technical error occured. Contact Admin.", status: 0 })
                    }
                })
                .catch(err => {
                    logger.error("catch error : " + err)
                    res.render('signup', { message: "Some technical error occured. Contact Admin.", status: 0 })
                });
        } else {
            res.render('signup', { message: "User already exists", status: 0 });
        }
    })

async function revertModule(email) {
    try {
        await User.deleteOne({ email: email });
        return true;
    } catch (e) {
        return false;
    }
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

async function sendEmailSparkpost(toEmail, firstname) {
    try {
        await client.transmissions.send({
            options: {
                sandbox: false
            },
            content: {
                from: '<FROM_EMAIL>',
                subject: 'Sign up successfully, Welcome!',
                html: `Hello ${firstname},\n You have successfully signed up! \n Thanks!`
            },
            recipients: [
                { address: toEmail }
            ]
        })
        logger.info("Email Success");
        return true;
    } catch (error) {
        logger.error("Email Failed: " + error);
        let revert = await revertModule(toEmail);
        if (revert) {
            logger.info("Revert Successfully");
        } else {
            logger.error("revert Failed ")
        }
        return false;
    }
}

app.listen(port, () => console.log(`app listening on port ${port}!`));