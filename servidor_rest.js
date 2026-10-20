var conexion = require("./conexion_mysql.js");
var express = require("express");
var app = express();
//para utilizar las funciones de la libreria jwt
var jwt = require("jsonwebtoken");
//clave que usa el servidor para firmar y verificar tokens 
var claveSecreta = process.env.JWT_SECRET;

if(!claveSecreta){
    throw new Error("No se ha configurado la clave JWT");
}

//verificar el token de las peticiones
function verificarToken(req, res, next){
    //obtener la cabecera 
    var autorizacion = req.headers.authorization;
    //comprobar que se ha enviado la cabecera
    if(!autorizacion){
        return res.status(401).json("No se ha enviado ningún token");
    }
    //extraer el token (es la segunda posicion de la cabecera)
    var token = autorizacion.split(" ")[1];
    //verificar el token
    try{
        var datos =jwt.verify(token, claveSecreta);
        next();
    }
    catch(error){
        res.status(403).json("Token no válido o caducado");
    }
}

//cuando alguien se conecta a /appCliente, se le manda lo que hay en la carpeta "cliente"
app.use("/appCliente", express.static("cliente_rest"));
app.use(express.json());
//para indicar que servicios rest se quieren proteger
/**
 * app.use("/api", function(req, res, next){ - para que se ejecute antes de procesar las peticiones 
 * req.path === "/gestores/login" - pq para el login no hay que tener token (se genera ahí)
 * (req.path === "/gestores" && req.method === "POST") - para que al crear un gestor nuevo tampoco requiera un token
 */
app.use("/api", function(req, res, next){
    if(req.path === "/gestores/login" || (req.path === "/gestores" && req.method === "POST")){
        next();
    }
    else{
        //para el resto de peticiones se verifica el token
        verificarToken(req,res,next);
    }
});

//Obtener todas las filas de la tabla ubicaciones
app.get("/api/ubicaciones", function(req, res){
    var sql = "SELECT * FROM ubicaciones";
    //envia la consulta a mysql, espera la respuesta y ejecuta una funcion con el resultado
    conexion.query(sql, function(error, ubicaciones){
        if(error){
            console.log("Error al obtener ubicaciones", error);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            console.log("Ubicaciones: ", ubicaciones);
            res.status(200).json(ubicaciones);
        }
    });
});

//obtener todas las filas de la tabla categorias
app.get("/api/categorias", function(req, res){
    var sql = "SELECT * FROM categorias";
    conexion.query(sql, function(error, categorias){
        if(error){
            console.log("Error al obtener las categorías");
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            console.log("Categorías: ", categorias);
            res.status(200).json(categorias);
        }
    });
});

//obtener todas las filas de la tabla modelos
app.get("/api/modelos", function(req, res){
    var sql = "SELECT * FROM modelos";
    conexion.query(sql, function(error, modelos){
        if(error){
            console.log("Error al obtener los modelos");
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            console.log("Modelos: ", modelos);
            res.status(200).json(modelos);
        }
    });
});

//Login del gestor, el cliente envía en el body el usuario y la contraseña
app.post("/api/gestores/login", function(req, res){
    //guardamos los datos que llegan desde el cliente
    // req.body.login = "ccg144"
    //req.boy.password = "144"
    var login = req.body.login;
    var password = req.body.password;
    
    //de la tabla de gestores hay que buscar el 
    // que coincida el usuario Y la contraseña que se pasa
    var sql = "SELECT * FROM gestores WHERE usuario = ? AND password = ?";
    
    //[login, password] rellena los ? en orden 
    //primer ? --> login, segundo ? --> password
    //"gestores" será un array con los resultados encontrados
    conexion.query(sql,[login, password], function(error, gestores){
        if(error){
            console.log("Error al realizar el login: ", error);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            /**
             * si mysql no encuentra ningun gestor con ese usuario y contraseña, devuelve array vacío gestores=[]
             */
            if(gestores.length===0){
                res.status(403).json("Autenticación incorrecta");
            }
            /**
             * si se encuentra un gestor que coincide con el usuario y contraseña, se devuelve un array con el resultado
             * gestores=[{id:2, nombre:"Claudia", usuario:"ccg144", password:"144"}]
             */
            else{
                /**
                 * gestores[0] es el primergestor encontrado
                 * gestores[0].id es el id, que es lo que se devuelve al cliente
                 */
                /**
                 * si el usuario y la contraseña son correctos, generar token 
                 * jwt.sign - genera un token
                 * id:gestores[0].id - pone el id del gestor dentro del token
                 * claveSecreta - clave con la q el servidor firma el token
                 * {expiresIn: "2h"} - hace que el token caduque después de 2h
                */

                var token = jwt.sign({id:gestores[0].id}, claveSecreta, {expiresIn: "2h"});
                res.status(200).json({id:gestores[0].id, token:token});
            }
        }
    });
});

//crear nuevo gestor (registro). Se le pasa objeto con datos de gestor (menos id). Login debe ser único
app.post("/api/gestores", function(req, res){
    //se lee el body
    console.log(req.body);
    var nombre = req.body.nombre;
    var apellidos = req.body.apellidos;
    var usuario = req.body.usuario;
    var password = req.body.password;

    //comprobar si hay campos vacíos
    if(!nombre || !apellidos||!usuario||!password){
        return res.status(404).json("No puede haber campos vacíos");
    }
    //comprobar que el gestor NO existe
    var sqlBuscar = "SELECT * FROM gestores WHERE usuario = ?";
    //si el usuario introducido es "claudia", el ? se sustituye por "claudia"
    conexion.query(sqlBuscar, [usuario], function(error, gestores){
        if(error){
            console.log("Error al comprobar el gestor", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        //si se encuentra un gestor ya creado con ese usuario (el usuario debe ser único)
        if(gestores.length>0){
            return res.status(409).json("Usuario ya existe");
        }
        //si no existe, se crea (inserta)
        //se inserta una nueva fila en la tabla de gestores, (columnas que se van a rellenar), los ? son los valores que introduciré
        //no aparece id porque lo crea mysql 
        var sqlInsert = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
        //lo que hay entre [] es un array con los valores para rellenar los ? en orden
        conexion.query(sqlInsert,[nombre, apellidos, usuario, password], function(error, resultado){
            if(error){
                console.log("Error al insertar gestor: ", error);
                res.status(500).json("Error al insertar gestor");
            }
            else{
                console.log("Gestor creado correctamente");
                res.status(201).json({
                    //para consultar el id que ha asignado mysql a este gestor
                    id:resultado.insertId,
                    nombre:nombre,
                    apellidos:apellidos,
                    usuario:usuario
                });
            }
        });
    });
});

//actualiza datos del gestor. Se pasa objeto con datos a actualizar (excepto id). login debe ser único
app.put("/api/gestores/:id", function(req,res){
    //primero hay que obtener de la url el id del gestor que se quiere modificar
    ///api/gestores/3 --> req.params.id es 3
    var id = Number(req.params.id);
    //comprobar que el gestor existe
    var sqlBuscar = "SELECT * FROM gestores WHERE id=?";
    conexion.query(sqlBuscar, [id], function(error, gestores){
        //si hay algun problema al hacer la consulta
        if(error){
            console.log("Error al buscar el gestor: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        //si no se encuentra ningún gestor, mysql devuleve []
        if(gestores.length===0){
            return res.status(404).json("El gestor no existe");
        }
        //si el gestor existe, hay que leer los nuevos datos
        var nombre=req.body.nombre;
        var apellidos = req.body.apellidos;
        var usuario = req.body.usuario;
        var password = req.body.password;
        //comprobar que no hay datos vacíos
        if(!nombre||!apellidos||!usuario||!password){
            return res.status(404).json("No puede haber campos vacíos");
        }
        //comprobar que no exista otro gestor con ese usuario
        // id<>? significa que el id sea distinto de el que se pasa como dato
        var sqlUsuario = "SELECT * FROM gestores WHERE usuario =? AND id<>?";
        conexion.query(sqlUsuario, [usuario, id], function(error, mismoUsuario){
            if(error){
                console.log("Error al comprobar el usuario: ", error);
                return res.status(500).json("Error al realizar la consulta");
            }
            if(mismoUsuario.length>0){
                return res.status(409).json("Ese usuario ya existe");
            }
            //si no hay ningun problema y no existe otro gestor con el mismo usuario, hay que actualizar los datos
            //el WHERE id=? es para indicar de qué gestor se quieren modificar los datos
            var sqlActualizar = "UPDATE gestores SET nombre =?, apellidos =?, usuario=?, password=? WHERE id=?";
            conexion.query(sqlActualizar, [nombre, apellidos, usuario, password, id], function(error, resultado){
                if(error){
                    console.log("Error al actualizar los datos del gestor: ", error);
                    res.status(500).json("Error al actualizar el gestor");
                }
                else{
                    res.status(200).json("Datos actualizados correctamente");
                }
            });
        });
    });
});

//Obtener los datos de un gestor (no devolver la contraseña)
app.get("/api/gestores/:id", function(req, res){
    //leer el id del gestor que se quiere consultar
    var id = Number(req.params.id);
    //buscar id en la tabla de gestores
    var sqlGestor="SELECT * FROM gestores WHERE id=?";
    /* otra forma de hacer la consulta (sin la contraseña pq no interesa)
        var sqlGestor="SELECT id, nombre, apellidos, usuario WHERE id=?";
        conexion.sql(sqlGestor, [id], .....);
        ...
        return res.status(200).json(gestores[0])
        devuelve los datos SIN la contraseña pq no se ha pedido
    */
    //se crea una lista(gestores) con lo obtenido de la consulta 
    conexion.query(sqlGestor, [id], function(error, gestores){
        if(error){
            console.log("Error al buscar el gestor: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(gestores.length===0){
            return res.status(404).json("El gestor no existe");
        }
        //si se ha encontrado el gestor con ese id, se devuelven los datos del gestor de la lista
        return res.status(200).json({
            id:gestores[0].id,
            nombre:gestores[0].nombre,
            apellidos:gestores[0].apellidos,
            usuario:gestores[0].usuario
        });
    });
});

//obtiene un objeto con los datos de un sanitario (NO devolver código de acceso)
app.get("/api/sanitarios/:id", function(req, res){
    var id=Number(req.params.id);
    var sqlSanitario = "SELECT * FROM sanitarios WHERE id=?";
    conexion.query(sqlSanitario, [id], function(error, sanitarios){
        if(error){
            console.log("Error al buscar el sanitario: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(sanitarios.length===0){
            return res.status(404).json("El sanitario no existe");
        }
        return res.status(200).json({
            id:sanitarios[0].id,
            nombre:sanitarios[0].nombre,
            apellidos:sanitarios[0].apellidos,
            usuario:sanitarios[0].usuario
        });
    });
});

//obtener la tabla de recursos
//segun lo que el usuario marca hay que filtrar
//url filtros - /api/recursos?categoria=1
app.get("/api/recursos", function(req, res){
    /**si la url es /api/recursos?modelo=2&ubicacion=3
     * /api/recursos --> es la ruta
     * lo de después de ? es query string (parámetros de consulta)
     * si modelo=2, req.query.modelo será 2
     * la url entonces se leerá como "dame los recursos cuyo modelo sea 2 y cuya ubicación sea 3"
     */
    
    //1. leer los filtros / se sacan los filtros de la url
    var idCategoria = req.query.categoria;
    var idModelo = req.query.modelo;
    var idUbicacion = req.query.ubicacion;
    var idEstado = req.query.estado;
    /**
     * se seleccionan los datos de recursos que interesan
     * INNER JOIN relaciona la tabla recurso con la tabla modelos (en recurso no hay categoria)
     * un recurso tiene un modelo y un modelo pertenece a una categoria
     * recursos.modelo = modelos.id
     * si recurso.modelo = 3, modelos.id=3, y ese modelo tiene categoria=5
     */
    //la consulta inicial es sin filtros
    /**
     * si pusiese SELECT * FROM recurso, devuelve todas las columnas de recurso,
     * pero queremos usar 2 tablas, y hay un JOIN
     * si se pone solo *, se obtienen todas las columnas de todas las tablas que participan en la consulta
     * por eso recurso.*, son todas las columnas de recurso
     * ON dice a mysql cómo se relacionan las tablas que se relacionan con el INNER JOIN
     * (el modelo de la tabla recurso = el id en la tabla modelos)
     * WHERE 1=1 es para que los siguientes filtros se puedan añadir con AND
     */
    var sqlRecurso = "SELECT recurso.* FROM recurso " + "INNER JOIN modelos ON recurso.modelo = modelos.id " + "WHERE 1=1";
    //aquí se guardan los valores que sustituirán a ?, si el usuario no pone filtros, queda vacío
    var valores = [];
    //filtrar por modelo si se ha enviado (si existe y no está vacío se añade el filtro)
    if(idModelo && idModelo !==""){
        sqlRecurso += " AND recurso.modelo = ?";
        //añade elemento al final del array "valores"
        valores.push(idModelo);
    }
    //filtrar por ubicación si se ha enviado
    if(idUbicacion && idUbicacion!==""){
        sqlRecurso += " AND recurso.ubicacion = ?";
        valores.push(idUbicacion);
    }
    //filtrar por estado si se ha enviado
    //como el 0 es un estado válido, hay que comprobar que existe el parámetro y no está vacío
    if(idEstado!==undefined && idEstado!==""){
        sqlRecurso += " AND recurso.estado =?";
        valores.push(idEstado);
    }
    if(idCategoria && idCategoria!==""){
        //se busca en la tabla modelos pq un recurso no tiene categoría directamente
        sqlRecurso += " AND modelos.categoria =?";
        valores.push(idCategoria);
    }
    //recursos será el array de filas que ha encontrado mysql
    conexion.query(sqlRecurso, valores, function(error, recursos){
        if(error){
            console.log("Error al obtener los recursos: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        else{
            res.status(200).json(recursos);
        }
    });
});

//buscar recurso concreto por su id
app.get("/api/recursos/:id", function(req, res){
    //leer id del recurso que se quiere obtener datos
    var id = Number(req.params.id);
    var sql = "SELECT * FROM recurso WHERE id=?";
    conexion.query(sql, [id], function(error, respuesta){
        if(error){
            console.log("Error al obtener el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(respuesta.length===0){
            return res.status(404).json("Recurso no encontrado");
        }
        //si se encuentra el recurso, como se está buscando por su id y este es único
        //la posicion del recurso en el array respuesta, será 0
        //devuelve todas las columnas de ese recurso (id, modelo, ubicacion, num_serie y estado)
        return res.status(200).json(respuesta[0]);
    });
});

//crear recurso
app.post("/api/recursos", function(req, res){
    //leer los datos del body
    var modelo = req.body.modelo;
    var ubicacion = req.body.ubicacion;
    var num_serie = req.body.num_serie;
    var estado = req.body.estado;

    //comprobar que no hay campos vacíos
    if(!modelo || !ubicacion || !num_serie || estado===undefined){
        return res.status(404).json("No puede haber campos vacíos");
    }

    var sqlRecurso = "INSERT INTO recurso (modelo, ubicacion, num_serie, estado) VALUES (?, ?, ?, ?)";
    //en este caso, respuesta no es un array, porque la consulta no es un SELECT, sino un INSERT
    conexion.query(sqlRecurso, [modelo, ubicacion, num_serie, estado], function(error, respuesta){
        if(error){
            console.log("Error al crear el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        return res.status(201).json({
            id:respuesta.insertId,
            modelo:modelo,
            ubicacion:ubicacion,
            num_serie:num_serie,
            estado:estado
        });
    });
});

//actualizar un recurso
app.put("/api/recursos/:id", function(req,res){
    var id = Number(req.params.id);
    //buscar el recurso que se quiere actualizar
    var sqlBuscar = "SELECT * FROM recurso WHERE id=?";
    conexion.query(sqlBuscar, [id], function(error, rec){
        if(error){
            console.log("Error al buscar el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(rec.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //si el recurso existe, hay que leer los datos
        var modelo = req.body.modelo;
        var ubicacion = req.body.ubicacion;
        var num_serie = req.body.num_serie;
        var estado = req.body.estado;

        //comprobar que no hay campos vacíos
        if(!modelo || !ubicacion || !num_serie || estado===undefined){
            return res.status(404).json("No puede haber campos vacíos");
        }
        var sqlActualizar = "UPDATE recurso SET modelo =?, ubicacion=?, num_serie=?, estado=? WHERE id=?";
        conexion.query(sqlActualizar, [modelo, ubicacion, num_serie, estado, id], function(error, respuesta){
            if(error){
                console.log("Error al actualizar el recurso");
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json("Recurso actualizado correctamente");
        });
    })
});

//borrar un recurso
app.delete("/api/recursos/:id", function(req, res){
    var id= Number(req.params.id);
    //comprobar que existe el recurso
    var sqlBuscar = "SELECT * FROM recurso WHERE id=?";
    conexion.query(sqlBuscar, [id], function(error, buscado){
        if(error){
            console.log("Error al buscar el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(buscado.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //si el recurso existe, hay que eliminarlo
        var sqlBorrar = "DELETE FROM recurso WHERE id=?";
        conexion.query(sqlBorrar, [id], function(error, borrado){
            if(error){
                console.log("Error al borrar el recurso: ", error);
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json("Recurso borrado correctamente");
        });
    });
});

//obtener las reservas de un recurso
app.get("/api/recursos/:id/reservas", function(req, res){
    var id=Number(req.params.id);
    //comprobar que el recurso existe
    var sqlBuscar = "SELECT * FROM recurso WHERE id=?";
    conexion.query(sqlBuscar, [id], function(error, buscado){
        if(error){
            console.log("Error al buscar el  recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(buscado.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //buscar todas las reservas de ese recurso
        //se quiere comparar la columna recurso de la tabla reservas con el id de la url
        var sqlReserva = "SELECT * FROM reservas WHERE recurso=?";
        //el array encontradas tiene dentro todas las reservas de ese recurso
        conexion.query(sqlReserva,[id], function(error, encontradas){
            if(error){
                console.log("Error al buscar la reserva: ", error);
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json(encontradas);
        });
    });
});

//obtener todas las reseñas de un recurso
app.get("/api/recursos/:id/resenyas", function(req, res){
    var id=Number(req.params.id);
    var sqlBuscar = "SELECT * FROM recurso WHERE id=?";
    conexion.query(sqlBuscar, [id], function(error, encontrado){
        if(error){
            console.log("Error al buscar el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(encontrado.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //si el recurso existe
        var sqlResenyas = "SELECT * FROM resenyas WHERE recurso=?";
        conexion.query(sqlResenyas, [id], function(error, respuesta){
            if(error){
                console.log("Error al buscar las reseñas: ", error);
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json(respuesta);
        });
    });
});

//puerto por el que escucha
app.listen(3000); 
