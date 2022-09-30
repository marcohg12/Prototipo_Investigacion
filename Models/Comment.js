const mongoose = require("mongoose");

//Creación del esquema de un comentario
const Comment = new mongoose.Schema({
    rootComment: {type: String, default: null},
    article: {type: String, required: true},
    username: {type: String, required: true},
    respondingTo: {type: String, default: null},
    content: {type: String, required: true},
    date: {type: Date, default: Date.now()},
    likes: {type: Number, default: 0},
    isDeleted: {type: Boolean, default: false},
    isEdited: {type: Boolean, default: false},
    usersThatLiked: {type: Array, default: []}
});

module.exports = mongoose.model("Comment", Comment);