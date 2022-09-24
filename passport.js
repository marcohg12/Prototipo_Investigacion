//Importación de bibliotecas
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

function initialize(passport, getUser){

    const authenticateUser = async (username, password, done) => {
        const user = await getUser(username);
        if (user == null){
            return done (null, false, {message: "Usuario o contraseña incorrectos"});
        }

        try {
            if (await bcrypt.compare(password, user.password)){
                return done (null, user);
            } else {
                return done (null, false, {message: "Usuario o contraseña incorrectos"});
            }
        } catch (err) {
            return done (err);
        }
    }

    passport.use(new LocalStrategy({usernameField: "username"}, authenticateUser));
    passport.serializeUser((user, done) => done (null, user.username));
    passport.deserializeUser(async (username, done) => {
       return done(null, await getUser(username));
    });
}

module.exports = initialize;