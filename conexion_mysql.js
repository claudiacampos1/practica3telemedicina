const mysql = require('mysql');
const database = {
    host : 'localhost',
    user : 'telemedicina2026',
    password : '2026telemedicina',
    database : 'practicas2026'
};

const conexion = mysql.createConnection(database);

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:',err);
        process.exit();
    }
});

module.exports = conexion;