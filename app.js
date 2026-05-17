//1 DEPENDENCIES
const express = require("express");
const expressSession = require("express-session")
const path = require("path")
const mongoose = require('mongoose');

const passport = require('passport');

require('dotenv').config();
const connectDB = require('./config/db')
const MongoStore = require('connect-mongo').default
//Import user model
const Signup = require("./models/signup");
//2 INSTANTIANTIONS
const app = express();
const port = 3000;

//3 CONFIGURATIONS
connectDB();
//set templating engine to pug
app.set("view engine", "pug");
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname,'public')))

//4 MIDDLEWARE
app.use(express.static(path.join(__dirname, "public")))


app.use(express.urlencoded({ extended: false }));
//express session configuration
app.use(expressSession({
  secret:"SSsshhh",
  resave: false,
  saveUnintialized: false,
  store:MongoStore.create({
  mongoUrl:process.env.DATABASE,
  collectionName:"sessionStorage"
  }),
  cookie:{
    maxAge:1000*60*60*2 //2 HOURS LIFE FOR A LOGIN SESSION
  }
}))
//passport configurations
app.use(passport.initialize())
app.use(passport.session());

passport.use(Signup.createStrategy());
passport.serializeUser(Signup.serializeUser());
passport.deserializeUser(Signup.deserializeUser());

//Global variable to make the logged in user available to all pug templates
app.use((req,res,next)=>{
  res.locals.user = req.user || null
  next();
})
//5 ROUTE
app.use('/', require('./routes/customerRoutes'))
app.use('/', require('./routes/authRoutes'))
app.use('/', require('./routes/depositRoutes'))
app.use('/', require('./routes/inventoryRoutes'))
app.use('/', require('./routes/paymentRoutes'))
app.use('/', require('./routes/reportRoutes'))
app.use('/',require('./routes/saleRoutes'))
app.use('/',require('./routes/settingRoutes'))
app.use('/',require('./routes/signupRoutes'))
app.use('/',require('./routes/stockRoutes'))



//This code should be the second last chunk of code
app.use((req, res)=>{
  res.status(404).send('Oops! Route not found.');
})

//6 BOOTSTRAPPING SERVER
//This should be the last line of code
app.listen(port, () => console.log(`listening on port ${port}`)); // new
