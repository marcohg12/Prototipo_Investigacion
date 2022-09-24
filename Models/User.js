const mongoose = require("mongoose");

//Creación del esquema de un usuario
const User = new mongoose.Schema({
    username: {type: String, required: true},
    name: {type: String, required: true},
    password: {type: String, required: true}
});

module.exports = mongoose.model("User", User);