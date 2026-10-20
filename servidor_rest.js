
var express = require("express");
var app = express();

//Importar el cliente de la supabase
const { createClient } = require('@supabase/supabase-js');

//Configurar la url y la Public Key
const supabaseUrl = 'https://bibviujhndtwkobefeqx.supabase.co';
const supabaseKey = 'sb_publishable_RpyJQA4xRGo0U5yxgmjX8g_U8vC5X7l';
const supabase = createClient(supabaseUrl, supabaseKey);

//para utilizar las funciones de la libreria jwt
var jwt = require("jwt-simple");
//clave que usa el servidor para firmar y verificar tokens 
var claveSecreta = "miSecretoMasOscuro";

//cuando alguien se conecta a /appCliente, se le manda lo que hay en la carpeta "cliente"
app.use("/appCliente", express.static("cliente_rest"));
app.use(express.json());

//servicios que no necesitan token (login y registro)
//Login del gestor, el cliente envía en el body el usuario y la contraseña
app.post("/api/gestores/login", function(req, res){
    //guardamos los datos que llegan desde el cliente
    // req.body.login = "ccg144"
    //req.boy.password = "144"
    var login = req.body.login;
    var password = req.body.password;
    
    //de la tabla de gestores hay que buscar el 
    // que coincida el usuario Y la contraseña que se pasa
    supabase.from("gestores").select("*").eq("usuario", login).eq("password", password).then(function(respuesta){
        var error = respuesta.error;
        var gestores = respuesta.data;

        if(error){
            console.log("Error al realizar el login: ", error);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            /**
             * siva no encuentra ningun gestor con ese usuario y contraseña, devuelve array vacío gestores=[]
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
                 * contenido - objeto que se guarda en el token
                 * id:gestores[0].id - pone el id del gestor dentro del token
                 * expira - indica cuando caducará el token
                 * 2*60*60*1000 - para pasar 1 hora a milisegundos
                 * jwt.encode() - crea token con el contenido y la clave secreta
                */
                var contenido = {
                    id:gestores[0].id,
                    expira: Date.now() + 60*60*1000
                };
                var token = jwt.encode(contenido, claveSecreta);
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
    supabase.from("gestores").select("*").eq("usuario", usuario).then(function(respuesta){
        var error = respuesta.error;
        var gestores = respuesta.data;

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
        //no aparece id porque lo crea la base de datos
        supabase.from("gestores").insert({
            nombre:nombre,
            apellidos:apellidos,
            usuario:usuario,
            password:password
        }).select().then(function(respuesta){
            var error=respuesta.error;
            var resultado = respuesta.data;

            if(error){
                console.log("Error al insertar gestor: ", error);
                res.status(500).json("Error al insertar gestor");
            }
            else{
                console.log("Gestor creado correctamente");
                res.status(201).json({
                    //para consultar el id que ha asignado supabase a este gestor
                    id:resultado[0].id,
                    nombre:nombre,
                    apellidos:apellidos,
                    usuario:usuario
                });
            }
        });
    });
});

//a partir de aqui los demas con token 
//para validar el token
app.use("/api", function(req, res, next){
    //obtener el token de la url
    var token = req.query.token;
    if (!token) { // no se ha pasado un token
        res.status(301).json("No se ha encontrado token");
        return;
    }

    // Decodificar el token
    try { // capturamos el error por si el token no es correcto
        var contenidoToken = jwt.decode(token, claveSecreta); // decodificamos el token para obtener su contenido con la misma clave que se codificó
    } catch (error) {
        res.status(301).json("El token es incorrecto");
        return;
    }
    console.log("El contenido del token es:", contenidoToken);

    // Validar el token
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.id) { // validamos el formato del token
        res.status(301).json("El formato del token no es adecuado")
        return;
    }

    // Comprobar la fecha de expiración
    if (contenidoToken.expira < Date.now()) {
        res.status(301).json("El token ha expirado");
        return
    }
    // Todo ha ido bien. con next hago que express continue con el procesado
    next();
    
});

//Obtener todas las filas de la tabla ubicaciones
app.get("/api/ubicaciones", function(req, res){
    //obtiene de supabase los datos de la tabla de ubicaciones
    supabase.from("ubicaciones").select("*").then(function(respuesta){
        var error = respuesta.error;
        var ubicaciones = respuesta.data;
        
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
    supabase.from("categorias").select("*").then(function(respuesta){
        var error = respuesta.error;
        var categorias = respuesta.data;
        
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
    supabase.from("modelos").select("*").then(function(respuesta){
        var error = respuesta.error;
        var modelos = respuesta.data;
        
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


//actualiza datos del gestor. Se pasa objeto con datos a actualizar (excepto id). login debe ser único
app.put("/api/gestores/:id", function(req,res){
    //primero hay que obtener de la url el id del gestor que se quiere modificar
    ///api/gestores/3 --> req.params.id es 3
    var id = Number(req.params.id);
    //comprobar que el gestor existe
    supabase.from("gestores").select("*").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var gestores = respuesta.data;

        //si hay algun problema al hacer la consulta
        if(error){
            console.log("Error al buscar el gestor: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        //si no se encuentra ningún gestor, devuleve []
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
        // neq("id", id) significa que el id sea distinto de el que se pasa como dato
        supabase.from("gestores").select("*").eq("usuario", usuario).neq("id", id).then(function(respuesta){
            var error = respuesta.error;
            var mismoUsuario = respuesta.data;
            
            if(error){
                console.log("Error al comprobar el usuario: ", error);
                return res.status(500).json("Error al realizar la consulta");
            }
            if(mismoUsuario.length>0){
                return res.status(409).json("Ese usuario ya existe");
            }
            //si no hay ningun problema y no existe otro gestor con el mismo usuario, hay que actualizar los datos
            //el WHERE id=? es para indicar de qué gestor se quieren modificar los datos
            supabase.from("gestores").update({
                nombre:nombre,
                apellidos:apellidos,
                usuario:usuario,
                password:password
            }).eq("id", id).then(function(respuesta){
                var error = respuesta.error;

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
    supabase.from("gestores").select("id, nombre, apellidos, usuario").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        //se crea una lista(gestores) con lo obtenido de la consulta 
        var gestores = respuesta.data;
    
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
    supabase.from("sanitarios").select("id, nombre, apellidos, usuario").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var sanitarios = respuesta.data;

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
     * la consulta inicial es sin filtros
     * modelos!inner(categorias) - relaciona recursos con sus modelos y consulta la categoria
     * 
     * un recurso tiene un modelo y un modelo pertenece a una categoria
     * recursos.modelo = modelos.id
     * si recurso.modelo = 3, modelos.id=3, y ese modelo tiene categoria=5
     */
    var consulta = supabase.from("recurso").select("*, modelos!inner(categoria)");
        
    //filtrar por modelo si se ha enviado (si existe y no está vacío se añade el filtro)
    if(idModelo && idModelo !==""){
        consulta = consulta.eq("modelo", idModelo);
    }
    //filtrar por ubicación si se ha enviado
    if(idUbicacion && idUbicacion!==""){
        consulta = consulta.eq("ubicacion", idUbicacion);
    }
    //filtrar por estado si se ha enviado
    //como el 0 es un estado válido, hay que comprobar que existe el parámetro y no está vacío
    if(idEstado!==undefined && idEstado!==""){
        consulta = consulta.eq("estado", idEstado);
    }
    if(idCategoria && idCategoria!==""){
        //se busca en la tabla modelos pq un recurso no tiene categoría directamente
        consulta = consulta.eq("modelos.categoria", idCategoria);
    }
    //ejecutar la consulta
    consulta.then(function(respuesta){
        var error = respuesta.error;
        var recursos = respuesta.data;

        if(error){
            console.log("Error al obtener los recursos: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        else{
            //quitar los datos del modelo para devolver solo las columnas del recurso
            recursos.forEach(function(recurso){
                delete recurso.modelos;
            });
            res.status(200).json(recursos);
        }
    });
});

//buscar recurso concreto por su id
app.get("/api/recursos/:id", function(req, res){
    //leer id del recurso que se quiere obtener datos
    var id = Number(req.params.id);
    supabase.from("recurso").select("*").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var recursos = respuesta.data;

        if(error){
            console.log("Error al obtener el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(recursos.length===0){
            return res.status(404).json("Recurso no encontrado");
        }
        //si se encuentra el recurso, como se está buscando por su id y este es único
        //la posicion del recurso en el array respuesta, será 0
        //devuelve todas las columnas de ese recurso (id, modelo, ubicacion, num_serie y estado)
        return res.status(200).json(recursos[0]);
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

    supabase.from("recurso").insert({
        modelo:modelo, 
        ubicacion:ubicacion,
        num_serie:num_serie,
        estado:estado
    }).select().then(function(respuesta){
        var error=respuesta.error;
        var recursos = respuesta.data;

        if(error){
            console.log("Error al crear el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        return res.status(201).json({
            id:recursos[0].id,
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
    supabase.from("recurso").select("*").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var rec = respuesta.data;

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
        //actualizar el recurso
        supabase.from("recurso").update({
            modelo:modelo, 
            ubicacion:ubicacion,
            num_serie:num_serie,
            estado:estado
        }).eq("id", id).then(function(respuesta){
            var error = respuesta.error;
            
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
    supabase.from("recurso").select("*").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var buscado = respuesta.data;
    
        if(error){
            console.log("Error al buscar el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(buscado.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //si el recurso existe, hay que eliminarlo
        supabase.from("recurso").delete().eq("id", id).then(function(respuesta){
            var error = respuesta.error;
        
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
    supabase.from("recurso").select("*").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var buscado = respuesta.data;
    
        if(error){
            console.log("Error al buscar el  recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(buscado.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //buscar todas las reservas de ese recurso
        //se quiere comparar la columna recurso de la tabla reservas con el id de la url
        supabase.from("reservas").select("*").eq("recurso", id).then(function(respuesta){
            var error = respuesta.error;
            var encontradas = respuesta.data;

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
    supabase.from("recurso").select("*").eq("id", id).then(function(respuesta){
        var error = respuesta.error;
        var encontrado = respuesta.data;
    
        if(error){
            console.log("Error al buscar el recurso: ", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(encontrado.length===0){
            return res.status(404).json("El recurso no existe");
        }
        //si el recurso existe
        supabase.from("resenyas").select("*").eq("recurso", id).then(function(respuesta){
            var error = respuesta.error;
            var encontradas = respuesta.data;
        
            if(error){
                console.log("Error al buscar las reseñas: ", error);
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json(encontradas);
        });
    });
});

//puerto por el que escucha, asi si se ejecuta de manera local se usa el 3000, pero el render usara el que le asigne la plataforma
var puerto = process.env.PORT || 3000;
app.listen(puerto);
