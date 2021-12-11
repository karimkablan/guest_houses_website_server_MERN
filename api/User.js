const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const User = require('./../models/User.models');

const UserVerification = require('./../models/UserVerification.models');

const Opinions = require('./../models/Opinion.models');

const Order = require('./../models/Order.models')

const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const bcrypt = require('bcrypt');
const path = require('path');

let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    }
})

transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
})

router.post('/signup', (req, res) => {
    let { name, email, password, dateOfBirth } = req.body;
    name = name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if (name == "" || email == "" || password == "" || dateOfBirth == "") {
        res.json({
            status: "FAILED",
            message: "Empty input fields!"
        });

    } else if (!/^[a-zA-Z ]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered"
        })
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email entered"
        })
    } else if (!new Date(dateOfBirth).getTime()) {
        res.json({
            status: "FAILED",
            message: "Invalid date of birth entered"
        })
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "password is too short!"
        })
    } else {
        User.find({ email }).then(result => {
            if (result.length) {
                res.json({
                    status: "FAILED",
                    message: "User with the provided email already exists"
                })
            } else {
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth,
                        verified: false
                    });
                    newUser.save().then(result => {
                        sendVerificationEmail(result, res);
                    })
                        .catch(err => {
                            res.json({
                                status: "FAILED",
                                message: "An error occurred while while saving user accont!"
                            })
                        })
                })
                    .catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "An error occurred while while hashing password!"
                        })
                    })
            }
        }).catch(err => {
            console.log(err);
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for existing user!"
            })
        })
    }
})

const sendVerificationEmail = ({ _id, email }, res) => {
    const currentUrl = "http://localHost:5000/";

    const uniqueSting = uuidv4() + _id;
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify You Email",
        html: `<p>Verify your email address to complete the signup and login into your account.</p><p>this link <b>expires in 6 hours</b>.</p><p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueSting
            }>here </a> to proceed.</p>`,
    };

    const saltRounds = 10;
    bcrypt
        .hash(uniqueSting, saltRounds)
        .then((hashedUniqueString) => {

            const newVerification = new UserVerification({
                userId: _id,
                uniqueSting: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000,
            });
            newVerification
                .save()
                .then(() => {
                    transporter
                        .sendMail(mailOptions)
                        .then(() => {
                            res.json({
                                status: "PENDING",
                                message: "Verification email sent",
                            })
                        })
                        .catch((error) => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Verification email failed",
                            });
                        })
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "Couldn't save verification email data!",
                    });
                })
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "An error occurred while hashing email data!",
            });
        })
};

router.get("/verify/:userId/:uniqueString", (req, res) => {
    let { userId, uniqueString } = req.params;

    UserVerification
        .find({ userId })
        .then((result) => {
            if (result.length > 0) {
                const { expiresAt } = result[0];
                const hashedUniqueString = result[0].uniqueSting;

                if (expiresAt < Date.now()) {
                    UserVerification
                        .deleteOne({ userId })
                        .then(result => {
                            User
                                .deleteOne({ _id: userId })
                                .then(() => {
                                    let message = "Link has expired. Please sign up again";
                                    res.redirect(`/user/verified/error=true&message=${message}`);
                                })
                                .catch(error => {
                                    let message = "Clearing user with expired unique string failed";
                                    res.redirect(`/user/verified/error=true&message=${message}`);
                                })
                        })
                        .catch((error) => {
                            console.log(error);
                            let message = "An error occurred while clearing expired user verification record";
                            res.redirect(`/user/verified/error=true&message=${message}`);
                        })
                } else {
                    bcrypt
                        .compare(uniqueString, hashedUniqueString)
                        .then(result => {
                            if (result) {

                                User
                                    .updateOne({ _id: userId }, { verified: true })
                                    .then(() => {
                                        UserVerification
                                            .deleteOne({ userId })
                                            .then(() => {
                                                res.sendFile(path.join(__dirname, "./../views/verified.html"));
                                            })
                                            .catch(error => {
                                                console.log(error);
                                                let message = "An error occurred while finalizing successful verification.";
                                                res.redirect(`/user/verified/error=true&message=${message}`);
                                            })
                                    })
                                    .catch(error => {
                                        console.log(error);
                                        let message = "An error occurred while updating user record to show verified.";
                                        res.redirect(`/user/verified/error=true&message=${message}`);
                                    })

                            } else {
                                let message = "Invalid verification datails passed. Check your inbox.";
                                res.redirect(`/user/verified/error=true&message=${message}`);
                            }
                        })
                        .catch(error => {
                            let message = "An error occurred while comparing unique strings.";
                            res.redirect(`/user/verified/error=true&message=${message}`);
                        })
                }
            } else {
                let message = "Account record doesn't exist or has been verified already. Please sign up or log in.";
                res.redirect(`/user/verified/error=true&message=${message}`);
            }
        })
        .catch((error) => {
            console.log(error);
            let message = "An error occurred while chking for existing user verification record";
            res.redirect(`/user/verified/error=true&message=${message}`);
        })

});

router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"))
})

router.post('/signin', (req, res) => {
    let { email, password } = req.body;
    email = email.trim();
    password = password.trim();

    if (email == "" || password == "") {
        res.json({
            status: "FAILED",
            message: "Empty credentials supplied"
        })
    } else {
        User.find({ email })
            .then(data => {
                if (data.length) {

                    if (!data[0].verified) {
                        res.json({
                            status: "FAILED",
                            message: "Email hasn't been verified yet. Check your inbox.",
                        })
                    } else {
                        const hashedPassword = data[0].password;
                        bcrypt.compare(password, hashedPassword).then(result => {
                            if (result) {
                                res.status(201).json({
                                    status: "SUCCESS",
                                    message: "Signin successful",
                                    data: data
                                })
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password entered",
                                });
                            }
                        })
                            .catch(err => {
                                res.json({
                                    status: "FAILED",
                                    message: "An error occurred while comparing passwords",
                                })
                            })
                    }

                } else {
                    res.json({
                        status: "FAILED",
                        message: "Invalid credentials entered!",
                    })
                }
            })
            .catch(err => {
                res.json({
                    status: "FAILED",
                    message: "An error occurred while checking for existing user",
                })
            })
    }
})

router.post('/email', (req, res) => {

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.AUTH_EMAIL,
            pass: process.env.AUTH_PASS
        }
    });



    let mailOptions = {
        from: 'kremkablan@gmail.com',
        to: req.body.email,
        cc: 'kremkablan@gmail.com',
        subject: `You received an email Algermak 2000 from ${req.body.name}`,
        html: `<p style="color:#21574a;font-weight:bold">Name = ${req.body.name}<br>Phone Number = ${req.body.number}<br>The Email = ${req.body.email}<br>The message = ${req.body.messageText} </p>`
    };



    transporter.sendMail(mailOptions, (err, data) => {
        if (err) {
            res.status(400).send("Error Occurs")
            console.log('Error Occurs');
        } else {
            res.status(200).send('Email sent ')
            console.log('Email sent ');
        }
    });
})




router.get('/Order', (req, res) => {
    Order.find({}).populate("userId", 'name email').exec((err, data) => {
        if (err) {
            res.status(400).send("error")
        } if (data) {
            res.status(200).send(data)
        }
    })
})

router.get('/Order/:id', (req, res) => {
    const { id } = req.params;
    Order.find({userId:id}).exec((err, data) => {
        if (err) {
            res.status(400).send("error")
        } if (data) {
            res.status(200).send(data)
        }
    })
})

router.delete('/Order/:id',(req, res) => {
    const { id } = req.params;
    Order.findByIdAndDelete(id, (err, data) => {
        if (err) return res.status(404).send(err);
        return res.status(200).send(data);
    });
})


router.post('/Order', (req, res) => {
    let { userEmail,userId, name, phoneNumber, check_in, check_out, Email, special_requests, price, numberOrder } = req.body;
    const newOrder = new Order({
        userId,
        name,
        phoneNumber,
        check_in,
        check_out,
        Email,
        special_requests,
        price,
        numberOrder
    });
    newOrder.save((err, data) => {
        if (err) {
            res.status(400).send("error")
        } if (data) {
            res.status(201).send(data)
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.AUTH_EMAIL,
                    pass: process.env.AUTH_PASS
                }
            });



            let mailOptions = {
                from: 'kremkablan@gmail.com',
                to: `${Email}, ${userEmail}`,
                cc: 'kremkablan@gmail.com',
                subject: `New order from Algermak 2000 >> ${name}`,
                html: `<p style="color:#21574a;font-weight:bold">Name = ${name}<br>Phone Number = ${phoneNumber}<br>The Email = ${Email}<br>Order Number= ${numberOrder}<br>Check in = ${check_in} ---- Check out = ${check_out}<br>Special Requests = ${special_requests}<br>Order Price = ${price}
                <br><span style="color:red;font-weight:bold">You can update or cancel an order 7 days before the chick in</span><br>
                <span style="color:#21574a;font-weight:bold">For any questions, call 0526674766</span></p>`
            };



            transporter.sendMail(mailOptions, (err, data) => {
                if (err) {
                    res.status(400).send("Error Occurs")
                    console.log('Error Occurs');
                } else {
                    res.status(200).send('Email sent ')
                    console.log('Email sent');
                }
            });
        }
    })

})

router.post('/Opinion', (req, res) => {
    let { name, numberOrder, rating, createdAt, createdAt2, textOpinion } = req.body;
    Order.findOne({numberOrder: +numberOrder }, function (err, data) {
        if (!data) {
            return res.status(400).send("error")
        }
        else {
            const newOpinion = new Opinions({
                textOpinion,
                name,
                numberOrder,
                rating,
                createdAt,
                createdAt2
            });
            newOpinion.save((err, data) => {
                if (err) {
                    res.status(400).send("error")
                } if (data) {
                    res.status(201).send(data)
                }
            })
        }
    })


})

router.get('/Opinion', (req, res) => {
    Opinions.find({}).exec((err, data) => {
        if (err) {
            res.status(400).send("error")
        } if (data) {
            res.status(200).send(data)
        }
    })
})

router.delete('/Opinion/:id',(req, res) => {
    const { id } = req.params;
    Opinions.findByIdAndDelete(id, (err, data) => {
        if (err) return res.status(404).send(err);
        return res.status(200).send(data);
    });
})




module.exports = router;
