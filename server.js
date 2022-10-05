//Inclusión de bibliotecas
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const User = require("./Models/User");
const Article = require("./Models/Article"); 
const UserLike = require("./Models/UserLike"); 
const Comment = require("./Models/Comment"); 
const bcrypt = require("bcrypt");
const cors = require('cors')
const bodyParser = require("body-parser");
const schedule = require("node-schedule");

//Creación y configuración del servidor
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

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

//Configuración de peticiones
const corsOptions ={
    origin:'http://localhost:5500', 
    credentials:true,           
    optionSuccessStatus:200
}
app.use(cors(corsOptions));

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

//Job que actualiza el histórico de suscriptores de todos los autores
const job = schedule.scheduleJob({hour: 0, minute: 0}, async function(){
    await User.updateMany({},[{$set: {subsData: {$concatArrays: ["$subsData", [{x: Date.now(), y: "$subscribers"}]]}}}]);
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
    try {
        const articles = await Article.find().sort({creationDate: "desc"});
        return res.render("home", {articles: articles});
    } catch {
        return res.render("home", {articles: []});
    }
});

//Petición de vista de suscripciones del usuario
app.get("/subscriptions", checkAuthenticated, async (req, res) => {
    try {
        const user = await User.findOne({username: req.user.username});
        const articles = await Article.find({autor: {$in: user.subscribedTo}}).sort({creationDate: "desc"});
        return res.render("subsArticles", {articles: articles, subscriptions: user.subscribedTo});
    }
    catch {
        return res.redirect("/home");
    }
});

//Petición de estadísticas del usuario
app.get("/userStats", checkAuthenticated, async (req, res) => {
    try {
        const user = await User.findOne({username: req.user.username});
        const userStats = {subs: 0, articles: 0, likes: 0, dislikes: 0, views: 0, comments: 0}
        const statData = await Article.aggregate([{$match: {autor: req.user.username}}, {$group: {_id: null,
            views: {$sum: "$views"}, likes: {$sum: "$likes"}, dislikes: {$sum: "$dislikes"}, ids: {$addToSet: "$_id"}}},
            {"$unset": ["_id"]}]);
        const statsAv = statData.length > 0;
        const commentCount = await Comment.count({$in: {article: statData.ids}});
        const articleCount = await Article.count({autor: req.user.username});

        userStats.subs = user.subscribers;
        userStats.views = (statsAv) ? statData[0].views: 0;
        userStats.likes = (statsAv) ? statData[0].likes: 0;
        userStats.dislikes = (statsAv) ? statData[0].dislikes: 0;
        userStats.articles = articleCount;
        userStats.comments =  (statsAv) ? commentCount: 0;

        return res.render("userStats", {data: JSON.stringify(user.subsData), userStats: userStats, name: titleCase(user.name)});
    } catch (err) {
        console.log(err)
        return res.redirect("/home");
    }
});

//Petición de ventana de perfil del usuario
app.get("/userprofile", checkAuthenticated, async (req, res) => {
    try {
        var userData = await User.find({username: req.user.username});
        userData[0].name = titleCase(userData[0].name);
        const articles = await Article.find({autor: req.user.username});
        return res.render("userProfile", {userData: userData[0], articles: articles, amImyself: true});

    } catch {
        return res.render("home", {articles: []});     
    }
});

//Petición de ventana de perfil del usuario
app.get("/userprofile/:id", checkAuthenticated, async (req, res) => {
    try {
        if (req.user.username == req.params.id){
            return res.redirect("/userprofile");
        }
        var userData = await User.find({username: req.params.id});
        userData[0].name = titleCase(userData[0].name);
        const articles = await Article.find({autor: req.params.id});
        const isSubscribed = await User.findOne({username: req.user.username, subscribedTo: {$in: [req.params.id]}});
        var suscribed = (isSubscribed == null) ? false:true;
        return res.render("userProfile", {userData: userData[0], articles: articles, amImyself: false, suscribed: suscribed});

    } catch {
        return res.render("home", {articles: []});     
    }
});

//Petición de los comentarios de un artículo
app.get("/getComments/:id", checkAuthenticated, async (req, res) => {
    const comments = await Comment.find({article: req.params.id, respondingTo: null}).sort({date: "desc"});
    const newComments = [];
    for (let i = 0; i < comments.length; i++){
        var comment = comments[i].toObject();
        if (comment.usersThatLiked.includes(req.user.username)){
            comment.isLiked = true;
        }
        if (comment.username == req.user.username){
            comment.amIauthor = true;
        }
        newComments.push(comment);
    }
    res.status(200); 
    res.send({comments: JSON.stringify(newComments)});
});


//Petición de las respuestas de un comentario
app.get("/getCommentReplies/:id", checkAuthenticated, async (req, res) => {
    const comments = await Comment.find({rootComment: req.params.id}).sort({date: "desc"});
    const newComments = [];
    for (let i = 0; i < comments.length; i++){
        var comment = comments[i].toObject();
        if (comment.usersThatLiked.includes(req.user.username)){
            comment.isLiked = true;
        }
        if (comment.username == req.user.username){
            comment.amIauthor = true;
        }
        const comm = await Comment.findById(comment.respondingTo);
        comment.author = comm.username;
        newComments.push(comment);
    }
    res.status(200);
    res.send({comments: JSON.stringify(newComments)});
});

//Petición de vista de creación de blog
app.get("/newarticle", checkAuthenticated, async (req, res) => {
    return res.render("newArticle");
});

//Petición de vista de artículos de un usuario
app.get("/userarticles", checkAuthenticated, async (req, res) => {
    try {
        const articles = await Article.find({autor: req.user.username});
        return res.render("userarticles", {articles: articles});
    } catch {
        return res.render("userarticles", {articles: []});
    }
});

//Petición de vista de artículos que el usuario ha dado like
app.get("/userlikes", checkAuthenticated, async (req, res) => {
    try {
        const favArticles = await UserLike.findOne({username: req.user.username});
        const articles = await Article.find({_id: {$in: favArticles.articlesLiked}});
        return res.render("userLikes", {articles: articles});
    } catch {
        return res.render("userLikes", {articles: []});
    }
});

//Petición de vista de edición de artículo
app.get("/editarticle/:id", checkAuthenticated, async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        return res.render("editArticle", {title: article.title, description: article.description, content: article.content, articleid: article.id});
    } catch {
        return res.redirect("/home");
    }
});

//Petición de eliminación de artículo
app.get("/deletearticle/:id", checkAuthenticated, async (req, res) => {
    try {
        await Article.deleteOne({_id: req.params.id});
        await UserLike.updateMany({},{$pull: {articlesLiked: req.params.id}});
        await UserLike.updateMany({},{$pull: {dislikes: req.params.id}});
        await Comment.deleteMany({article: req.params.id});
        return res.redirect("/userarticles");
    }
    catch {
        return res.redirect("/editarticle/" + req.params.id);
    }
});

//Estadísticas de vista de un artículo
app.get("/stats/:id", checkAuthenticated, async (req, res) => {

    const article = await Article.findById(req.params.id);
    const dates = article.viewDates;
    var dataPoints = [];

    for (let i = 0; i < dates.length; i++){
        var date = new Date(dates[i]);
        date.setHours(0,0,0,0);
        var index = -1;

        for(let j = 0; j < dataPoints.length; j++) {
            if(dataPoints[j].x.valueOf() === date.valueOf()) {
                dataPoints[j].y += 1;
                index = 0;
                break;
            }
        }
        if (index == -1){
            dataPoints.push({x: date, y: 1});
        } 
        
    }
    return res.render("articleStats", {data: JSON.stringify(dataPoints), articleid: req.params.id});
});

//Petición de vista de artículo
app.get("/viewarticle/:id", checkAuthenticated, async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        const validation = await UserLike.count({username: req.user.username, articlesLiked: {$in: [req.params.id]}});
        const validation2 = await UserLike.count({username: req.user.username, dislikes: {$in: [req.params.id]}});
        const author = await User.findOne({username: article.autor});
        const comments = await Comment.find({article: req.params.id, respondingTo: null}).sort({date: "desc"});

        //Si el usuario que visita el artículo no es el autor, se registra una vista
        if (article.autor != req.user.username){
            article.views = article.views + 1;
            article.viewDates.push(new Date().toISOString());
            await article.save();
        }

        const newComments = [];
        for (let i = 0; i < comments.length; i++){
            var comment = comments[i].toObject();
            if (comment.usersThatLiked.includes(req.user.username)){
                comment.isLiked = true;
            }
            if (comment.username == req.user.username){
                comment.amIauthor = true;
            }
            comment.id = comment._id;
            newComments.push(comment);
        }

        return res.render("viewArticle", {article: article, comments: newComments, amIauthor: article.autor == req.user.username, isLiked: validation == 1, isDisliked: validation2 == 1, author: titleCase(author.name)});
    } catch {
        res.redirect("/home");
    }
});

//Petición de artículos de un usuario con búsqueda
app.post("/searchuserarticle", checkAuthenticated, async (req, res) => {
    try {
        const articles = await Article.find({autor: req.user.username, title: { $regex: req.body.title + '.*', $options: 'i'}});
        return res.render("userarticles", {articles: articles, title: req.body.title});
    } catch {
        return res.render("userarticles", {articles: [], title: req.body.title});
    }  
});

//Petición de artículos con búsqueda
app.post("/searcharticle", checkAuthenticated, async (req, res) => {
    try {
        const articles = await Article.find({title: { $regex: req.body.title + '.*', $options: 'i'}});
        return res.render("home", {articles: articles, title: req.body.title});
    } catch {
        return res.render("home", {articles: [], title: req.body.title});
    }  
});

//Petición de artículos de un perfil de usuario con búsqueda
app.post("/searcharticlefromuser/:id", checkAuthenticated, async (req, res) => {
    try {
        var userData = await User.find({username: req.params.id});
        userData[0].name = titleCase(userData[0].name);
        const articles = await Article.find({title: { $regex: req.body.title + '.*', $options: 'i'}, autor: req.params.id});
        const isSubscribed = await User.findOne({username: req.user.username, subscribedTo: {$in: [req.params.id]}});
        var suscribed = (isSubscribed == null) ? false:true;
        return res.render("userProfile", {userData: userData[0], articles: articles, amImyself: false, title: req.body.title, suscribed: suscribed});

    } catch {
        return res.render("home", {articles: []});     
    }
});

//Petición de artículos de un perfil de usuario con búsqueda
app.post("/searcharticlefromuser", checkAuthenticated, async (req, res) => {
    try {
        var userData = await User.find({username: req.user.username});
        userData[0].name = titleCase(userData[0].name);
        const articles = await Article.find({title: { $regex: req.body.title + '.*', $options: 'i'}, autor: req.user.username});
        return res.render("userProfile", {userData: userData[0], articles: articles, amImyself: true, title: req.body.title});

    } catch {
        return res.render("home", {articles: []});     
    }
});

//Petición de artículos con likes con búsqueda
app.post("/searchfavarticle", checkAuthenticated, async (req, res) => {
    try {
        const favArticles = await UserLike.findOne({username: req.user.username});
        const articles = await Article.find({_id: {$in: favArticles.articlesLiked}, title: { $regex: req.body.title + '.*', $options: 'i'}});
        return res.render("userLikes", {articles: articles, title: req.body.title});
    } catch {
        return res.render("userLikes", {articles: [], title: req.body.title});
    }  
});

//Petición de registrar usuario
app.post("/register", checkNotAuthenticated, async (req, res) => {
    const name = titleCase(req.body.name);
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
            //Creación de lista de likes/dislikes
            const userLike = new UserLike();
            userLike.username = username;
            await userLike.save();
            return res.render("login");
        } 
        return res.render("register", {name: name, username: username, password: password, err: true});
    } catch {
        return res.render("register", {name: name, username: username, password: password});
    }
});

//Petición de registrar artículo
app.post("/newarticle", checkAuthenticated, async (req, res) => {
    const article = new Article();
    article.title = req.body.title;
    article.description = req.body.description;
    article.content = req.body.content;
    article.autor = req.user.username;
    try {
        await article.save();
        return res.redirect("/userarticles");
    } catch {
        return res.render("newArticle", {title: req.body.title, description: req.body.description, content: req.body.content});
    }
});

//Petición de editar artículo
app.post("/editarticle/:id", checkAuthenticated, async (req, res) => {
    const article = await Article.findById(req.params.id);
    article.title = req.body.title;
    article.description = req.body.description;
    article.content = req.body.content;
    article.autor = req.user.username;
    article.lastEditionDate = Date.now();
    try {
        await article.save();
        return res.redirect("/userarticles");
    } catch {
        return res.render("editArticle", {title: req.body.title, description: req.body.description, content: req.body.content});
    }
});

//Petición de dar like a un artículo
app.post("/like/:id", checkAuthenticated, async (req, res) => {
    try {
        const validation = await UserLike.count({username: req.user.username, articlesLiked: {$in: [req.params.id]}});
        const validation2 = await UserLike.count({username: req.user.username, dislikes: {$in: [req.params.id]}});

        //Si el artículo no tenía el like
        if (validation == 0){
            const article = await Article.findById(req.params.id);
            //Si estaba en dislike, se elimina el dislike
            if (validation2 == 1){
                article.dislikes = article.dislikes - 1;
                await UserLike.updateOne(
                    {username: req.user.username},
                    { $pull: {dislikes: req.params.id} });   
                res.status(210);           
            } else {
                res.status(200);
            }
            //Se agrega el like
            article.likes = article.likes + 1; 
            await article.save();
            await UserLike.updateOne(
                {username: req.user.username},
                { $push: {articlesLiked: req.params.id} });
            
        } else {
            const article = await Article.findById(req.params.id);
            article.likes = article.likes - 1; 
            await article.save();
            await UserLike.updateOne(
                {username: req.user.username},
                { $pull: {articlesLiked: req.params.id} });
            res.status(220);
        }
        res.send();
    } catch {
        res.status(300);
        res.send();
    }
});

//Petición de dar dislike a un artículo
app.post("/dislike/:id", checkAuthenticated, async (req, res) => {
    try {
        const validation = await UserLike.count({username: req.user.username, articlesLiked: {$in: [req.params.id]}});
        const validation2 = await UserLike.count({username: req.user.username, dislikes: {$in: [req.params.id]}});

        //Si el artículo no tenía el dislike
        if (validation2 == 0){
            const article = await Article.findById(req.params.id);
            //Si el artículo tenía like, se elimina
            if (validation == 1){
                article.likes = article.likes - 1;
                await UserLike.updateOne(
                    {username: req.user.username},
                    { $pull: {articlesLiked: req.params.id} });
                res.status(230);
            } else {
                res.status(240);
            }
            //Se agrega el dislike
            article.dislikes = article.dislikes + 1; 
            await article.save();
            await UserLike.updateOne(
                {username: req.user.username},
                { $push: {dislikes: req.params.id} });
        } else {
            const article = await Article.findById(req.params.id);
            article.dislikes = article.dislikes - 1; 
            await article.save();
            await UserLike.updateOne(
                {username: req.user.username},
                { $pull: {dislikes: req.params.id} });
            res.status(250);
        }
        res.send();
    } catch {
        res.status(300);
        res.send();
    }
});

//Petición de enviar un comentario en un artículo
app.post("/sendcomment/:id", checkAuthenticated, async (req, res) => {
    try {
        const comment = new Comment();
        comment.article = req.params.id;
        comment.username = req.user.username;
        comment.content = req.body.comment;
        await comment.save();
        res.status(200);
        res.send();
    } catch {
        res.status(400);
        res.send();
    }
});

//Petición de responder un comentario
app.post("/replycomment/:id", checkAuthenticated, async (req, res) => {
    try {
        const comment = new Comment();
        comment.article = req.body.articleid;
        comment.respondingTo = req.params.id;
        comment.username = req.user.username;
        comment.content = req.body.comment;

        var rootCommentid = null;
        var commentid = req.params.id;
        while (rootCommentid == null){
            const comment = await Comment.findById(commentid);
            if (comment.respondingTo == null){
                rootCommentid = comment.id;
            } else {
                commentid = comment.respondingTo;
            }
        }
        comment.rootComment = rootCommentid;
        await comment.save();
        res.status(200);
        res.send(rootCommentid);
    } catch {
        res.status(400);
        res.send();
    }
});

//Petición de dar o quitar like a un comentario
app.post("/likecomment/:id", checkAuthenticated, async (req, res) => {
    try {
        const isLiked = await Comment.findOne({_id: req.params.id, usersThatLiked: {$in: [req.user.username]} });
        //Se verifica si el usuario ya ha dado like al comentario
        if (isLiked){
            //Si tiene el like, se le quita
            await Comment.updateOne({_id: req.params.id}, {$pull: {usersThatLiked: req.user.username}, $inc: {likes: -1}});
            res.status(210);
        } else{
            await Comment.updateOne({_id: req.params.id}, {$push: {usersThatLiked: req.user.username}, $inc: {likes: 1}});
            res.status(200);
        }
        const result = await Comment.findById(req.params.id);
        res.send(JSON.stringify({likes: result.likes}));
    } catch {
        res.status(400);
        res.send();
    }
});

//Petición de editar un comentario
app.post("/editComment/:id", checkAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        comment.isEdited = true;
        comment.content = req.body.newcomment;
        await comment.save();

        var isRoot = false;
        if (comment.respondingTo == null){
            isRoot = true;
        }

        res.status(200);
        res.send(JSON.stringify({isRoot: isRoot, rootComment: comment.rootComment}));
    } catch (err) {
        console.log(err)
        res.status(400);
        res.send();
    }
});

//Petición de eliminar un comentario
app.post("/deleteComment/:id", checkAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        comment.isDeleted = true;
        await comment.save();

        var isRoot = false;
        if (comment.respondingTo == null){
            isRoot = true;
        }

        res.status(200);
        res.send(JSON.stringify({isRoot: isRoot, rootComment: comment.rootComment}));
    } catch {
        res.status(400);
        res.send();
    }
});

//Petición de suscribirse a un usuario
app.post("/subscribe/:id", checkAuthenticated, async (req, res) => {
    try {
        const isSubscribed = await User.findOne({username: req.user.username, subscribedTo: {$in: [req.params.id]}});
        const user = await User.findOne({username: req.params.id});
        var subs;

        //Si el usuario ya está suscrito, se desuscribe
        if (isSubscribed){
            await User.updateOne({username: req.user.username}, {$pull: {subscribedTo: req.params.id}});
            await User.updateOne({username: req.params.id}, {$inc: {subscribers: -1}});
            res.status(210);
            subs = user.subscribers -1;
        } else {
            await User.updateOne({username: req.user.username}, {$push: {subscribedTo: req.params.id}});
            await User.updateOne({username: req.params.id}, {$inc: {subscribers: 1}});
            subs = user.subscribers +1;
            res.status(200);
        }
        res.send(`${subs}`);
    }
    catch {
        return res.redirect("/userprofile/" + req.params.id);
    }
});

//Petición de inicio de sesión
app.post("/home", checkNotAuthenticated, passport.authenticate("local", { 
    successRedirect: "/home", 
    failureRedirect: "/",
    failureFlash: true
}));

//Petición de cierre de sesión
app.post("/logout", checkAuthenticated, async (req, res, next) =>{
    req.logOut(function(err) {
        if (err) { return next(err); }
        else {res.redirect("/");}
    });
});

//Formatea string para mostrar todas las letras minúsculas menos la primera letra de cada palabra
function titleCase(str) {
    return str.split(' ').map(item => 
    item.charAt(0).toUpperCase() + item.slice(1).toLowerCase()).join(' ');
}

//Configuración de puerto
app.listen(5500);
