const mongoose = require("mongoose");

//Creación del esquema de un artículo
const Article = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    content: {type: String, required: true},
    creationDate: {type: Date, default: Date.now()},
    lastEditionDate: {type: Date},
    likes: {type: Array, default: []},
    dislikes: {type: Array, default: []}
});

module.exports = mongoose.model("Article", Article);