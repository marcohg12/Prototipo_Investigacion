const mongoose = require("mongoose");

//Creación del esquema de un usuario
const UserLike = new mongoose.Schema({
    username: {type: String, required: true},
    articlesLiked: {type: Array, default: []},
    dislikes: {type: Array, default: []}
});

module.exports = mongoose.model("UserLike", UserLike);