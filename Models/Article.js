const mongoose = require("mongoose");

//Creación del esquema de un artículo
const Article = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    content: {type: String, required: true},
    creationDate: {type: Date, default: Date.now()},
    lastEditionDate: {type: Date},
    likes: {type: Number, default: 0},
    dislikes: {type: Number, default: 0},
    views: {type: Number, default: 0},
    autor: {type: String, required: true},
    viewDates: {type: Array, default: []}
});

module.exports = mongoose.model("Article", Article);