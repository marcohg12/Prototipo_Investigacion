//Inclusión de bibliotecas
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const User = require("./Models/User");
const Article = require("./Models/Article"); 
const bcrypt = require("bcrypt");

//Creación y configuración del servidor
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname));

//Configuración de sesión de usuario
app.use(flash());
app.use(session ({
    secret: "ki354DFBdsjASIU342ACH3E4",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
const initializePassport = require("./passport");

//Conexión a Mongo
mongoose.connect("mongodb://localhost/blogData", {useNewUrlParser : true});

//Verifica que un usuario no esté autenticado
function checkNotAuthenticated(req, res, next){
    if (req.isAuthenticated()){
        return res.redirect("/home");
    } else {
        return next();
    }
}

//Verifica que un usuario esté autenticado
function checkAuthenticated(req, res, next){
    if (req.isAuthenticated()){
        return next();
    } else {
        res.redirect("/");
    }
}

//Función de autenticación de usuario
initializePassport(passport, async (username) => {
    try {
        const user = await User.findOne({username: username});
        if (user == null){
            return null
        } else {
            return {username: user.username, password: user.password, name: user.name};
        }
    } catch {
        return null;
    }
});
//Funciones de servidor

//Petición de vista de login
app.get("/", checkNotAuthenticated, async (req, res) => {
    return res.render("login");
});

//Petición de vista de registro
app.get("/register", checkNotAuthenticated, async (req, res) => {
    return res.render("register");
});

//Petición de vista del menú principal
app.get("/home", checkAuthenticated, async (req, res) => {
    return res.render("home");
});

//Petición de vista de creación de blog
app.get("/newarticle", checkAuthenticated, async (req, res) => {});

//Petición de vista de edición de blog
app.get("/editarticle/:id", checkAuthenticated, async (req, res) => {});

//Petición de vista de blog
app.get("/viewarticle/:id", checkAuthenticated, async (req, res) => {});

//Petición de registrar usuario
app.post("/register", checkNotAuthenticated, async (req, res) => {
    const name = req.body.name;
    const username = (req.body.username).toLowerCase();
    const password = req.body.password;
    try {
        //Validación del username
        const validation = await User.findOne({username: username});
        if (validation == null){
            //Creación del usuario
            const salt = await bcrypt.genSalt();
            const hashedPassword = await bcrypt.hash(password, salt);
            const user = new User();
            user.name = name; 
            user.username = username;
            user.password = hashedPassword;
            await user.save();
            return res.render("login");
        } 
        return res.render("register", {name: name, username: username, password: password, err: true});
    } catch {
        return res.render("register", {name: name, username: username, password: password});
    }
});

//Petición de inicio de sesión
app.post("/home", checkNotAuthenticated, passport.authenticate("local", { 
    successRedirect: "/home", 
    failureRedirect: "/",
    failureFlash: true
}));

//Configuración de puerto
app.listen(5500);
