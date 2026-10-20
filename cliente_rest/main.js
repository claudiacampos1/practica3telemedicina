
/*contiene las funciones que van a hacer algo en el index, para conectar con el servidor
    eventos de botones, leer inputs, llamar a rest.js, pintar resultados
*/
var seccionActual = "login";
var gestorId = null;
var token = null; //guardará el token que envía el servidor al hacer login
//variable para el ws
var ws = null; //guarda la conexión ws del gestor
var id_area = 17;

var categorias = [];
var modelos = [];
var ubicaciones = [];
var recursos = [];

var recursoActual = null;

function cambiarSeccion(seccion){
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual=seccion;
}
//función para conectarse a WS
function conectarWSGestor(nombreGestor){
    //abre la conexión (mismo puerto que servidor_ws), y acepta protocolo avisos
    ws = new WebSocket("ws://localhost:4444/", "avisos");
    //cuando la conexión ya está abierta
    ws.onopen = function(){
        console.log("WebSocket gestor conectado");
        //el gestor se identifica 
        //esto es lo que va a recibir el servicor_ws como msg
        ws.send(JSON.stringify({
            operacion: "identificar",
            tipo:"gestor",
            id:gestorId,
            nombre: nombreGestor
        }));
    };
    ws.onmessage = function(event){
        var msg = JSON.parse(event.data);
        console.log("Mensaje WS recibido:", msg);
        /*
        if (msg.operacion === "aviso") {
            mostrarAvisoGestor(msg.texto);
        }
        */
        if (msg.operacion === "aviso") {
            mostrarAvisoGestor(msg);
        }
    };

    ws.onerror=function(error){
        console.log("Error en WebSocket gestor: " + error);
    }

    ws.onclose=function(){
        console.log("WebSocket gestor cerrado");
    }; 
}

function mostrarAvisoGestor(aviso){
    var tbody = document.querySelector("#tabla-avisos tbody");

    if(!tbody){
        alert("Aviso: " + aviso.texto);
        return;
    }

    var fila = document.createElement("tr");

    // aplica el color del aviso
    fila.className = aviso.color;

    fila.innerHTML =
        "<td>" + new Date(aviso.fecha).toLocaleString() + "</td>" +
        "<td>" + aviso.origen + "</td>" +
        "<td>" + aviso.texto + "</td>";

    tbody.appendChild(fila);
}

///// WS
function enviarAviso(aviso){
    if(ws && ws.readyState === WebSocket.OPEN){
        aviso.operacion = "aviso";
        ws.send(JSON.stringify(aviso));
    }
}

function entrar(){
    var usuario = document.getElementById("usuarioLogin").value;
    var contrasenya = document.getElementById("contrasenyaLogin").value;
    /**
     * "../api/gestor/login" --> llama al servidor y rest recibe respuesta y callback
     */
    rest.post("/api/gestores/login", {
        login: usuario, password: contrasenya
    }, function(estado, respuesta){
        //estado y respuesta del api del servidor
        if(estado===403){
            alert("Usuario o contraseña incorrectos");
            return;
        }
        if(estado===200){
            gestorId = respuesta.id;
            token = respuesta.token;
            cargarDesplegables();
            //respuesta del get en el servidor
            console.log(estado, "Login correcto", respuesta);
            //Pedir datos del gestor para poder mostrar la bienvenida con su nombre y apellidos
            rest.get("/api/gestores/" + gestorId, function(estado2, datos){
                if(estado2===200){
                    document.getElementById("bienvenida").textContent = "Bienvenido " + datos.nombre + " " + datos.apellidos;
                    //para identificar el gestor en WS con su nombre completo (antes solo se sabia el id)
                    conectarWSGestor(datos.nombre + " " + datos.apellidos);
                }
            });
            //cambia a menu-principal (clase del index.html)
            cambiarSeccion("menu-principal");
            //para llamar al get del ministerio y ver el ranking
            obtenerRankingMinisterio();
            return;
        }
        alert("Error inesperado: " + estado);
    })
}

//nuevo gestor
function registrarse(){
    //inicializa todos los datos vacíos para rellenarlos cuando se cambie la pantalla
    gestorId = null;
    document.getElementById("nombreDatos").value = "";
    document.getElementById("apellidosDatos").value = "";
    document.getElementById("usuarioDatos").value = "";
    document.getElementById("contrasenyaDatos").value = "";
    //cambia a pantalla para rellenar los datos para registrarse
    cambiarSeccion("datos-gestor");
}

//botón cancelar en datos-gestor
//si se ha llegado desde "registrarse", te lleva a la página de login
//si se ha llegado desde "editar datos", te lleva a la página de inicio
function cancelar(){
    if(gestorId){
        cambiarSeccion('menu-principal');
    }
    else{
        cambiarSeccion('login');
        document.getElementById("usuarioLogin").value = "";
        document.getElementById("contrasenyaLogin").value = "";
    }
}

//botón editar datos
function datosUsuario(){
    /*
    var usuario = document.getElementById("usuario").value;
    var nombre = document.getElementById("nombre").value;
    var apellidos = document.getElementById("apellidos").value;
    var contrasenya = document.getElementById("contrasenya").value;
    */
    if(!gestorId){
        alert("No hay sesión iniciada");
        return;
    }
    //no se puede poner /api/gestores/:id, por eso + gestorId, que se guarda el id de un gestor en el login
    rest.get("/api/gestores/" + gestorId, function(estado, respuesta){
        if(estado === 404){
            alert("EL gestor no existe");
            return;
        }
        if(estado === 200){
            //cambiar de sección a la
            cambiarSeccion("datos-gestor");
            console.log(estado, respuesta);
            document.getElementById("nombreDatos").value = respuesta.nombre;
            document.getElementById("apellidosDatos").value = respuesta.apellidos;
            document.getElementById("usuarioDatos").value = respuesta.usuario;
            return;
        }
        alert("Error inesperado: " + estado);
    });
}

//botón guardar (datos gestor)
function guardarDatos(){
    //.trim() elimina los espacios en blanco al principio y al final
    var nombre = document.getElementById("nombreDatos").value.trim();
    var apellidos = document.getElementById("apellidosDatos").value.trim();
    var usuario = document.getElementById("usuarioDatos").value.trim();
    var password = document.getElementById("contrasenyaDatos").value.trim();

    var datos = {nombre, apellidos, usuario, password};
    //comprobar que no haya campos vacíos
    if(!nombre||!apellidos||!usuario||!password){
        alert("No puede haber campos vacíos");
        return;
    }

    //si no existe gestor, se crea nuevo
    if(!gestorId){
        rest.post("/api/gestores", datos, function(estado, respuesta){
            //si hay algun campo vacío
            if(estado === 404){
                alert("No puede haber campos vacíos");
                return;
            }
            //si ya existe ese usuario 
            if(estado === 409){
                alert("Este usuario ya existe");
            }
            //si todo está correcto (no campos vacíos / no usuario igual)
            if(estado === 201){
                alert("Gestor creado con éxito");
                //va al inicio de sesión
                cambiarSeccion("login");
                //para que al cambiar al login ya aparezcan por defecto el usuario y contraseña que acaba de crear
                document.getElementById("usuarioLogin").value = respuesta.usuario;
                document.getElementById("contrasenyaLogin").value = respuesta.password;
                return;
            }
            alert("Error inesperado: " + estado);
        });
        return;
    }
    console.log("Guardando con gestorId =", gestorId, "datos =", datos);
    //si existe gestor, se actualizan los datos
    //no se puede poner /api/gestores/:id, por eso + gestorId, que se guarda el id de un gestor en el login
    rest.put("/api/gestores/" + gestorId, datos, function(estado, respuesta){
        if(estado === 404){
            alert("Gestor no existe");
            return;
        }

        if(estado === 409){
            alert("Este usuario ya existe");
            return;
        }

        if(estado === 200){
            alert("Datos actualizados");
            document.getElementById("bienvenida").textContent = "Bienvenido "+nombre + " "+ apellidos;
            cambiarSeccion("menu-principal");
            
            //document.getElementById("contrasenyaDatos") = respuesta.password;
            return;
        }
        alert("Error inesperado " + estado);
    });
}

//tras correcto inicio de sesión, para volver al acceso 
//para salir desde el inicio de la app al acceso
//se puede quitar esta función y directamente redirigir en el index.html
function salir(){
    //cerrar conexion
    if(ws){
        ws.close();
        ws=null;
    }
    // limpiamos la tabla de avisos al salir
    var tbodyAvisos = document.querySelector("#tabla-avisos tbody");
    if(tbodyAvisos){
        tbodyAvisos.innerHTML = "";
    }

    gestorId=null;
    token = null;
    cambiarSeccion("login");
    document.getElementById("usuarioLogin").value = "";
    document.getElementById("contrasenyaLogin").value = "";
}

//para mostrar el listado de recursos en función de los filtros elegidos

function cargarDesplegables() {
    // Solicitar categorías desde el servidor
    rest.get("/api/categorias", function(estado, datos) {
        if (estado === 200) {
            // Variables originales (Búsqueda) y Nuevas (Ficha)
            var selCategoria = document.getElementById("categoriaSelect");
            var selCategoriaRecurso = document.getElementById("categoriaRecurso");

            var contenidoBusqueda = "<option value=''>Todos</option>";
            var contenidoFicha = "<option value=''>Seleccione...</option>";

            datos.forEach(function(categoria) {
                var opt = "<option value='" + categoria.id + "'>" + categoria.nombre + "</option>";
                contenidoBusqueda += opt;
                contenidoFicha += opt;
            });

            if (selCategoria) selCategoria.innerHTML = contenidoBusqueda;
            if (selCategoriaRecurso) selCategoriaRecurso.innerHTML = contenidoFicha;
        }
    });

    // Solicitar ubicaciones desde el servidor
    rest.get("/api/ubicaciones", function(estado, datos) {
        if (estado === 200) {
            // Variables originales (Búsqueda) y Nuevas (Ficha)
            var selUbicacion = document.getElementById("ubicacionSelect");
            var selUbicacionRecurso = document.getElementById("ubicacionRecurso");

            var contenidoBusqueda = "<option value=''>Todos</option>";
            var contenidoFicha = "<option value=''>Seleccione...</option>";

            datos.forEach(function(ubicacion) {
                var opt = "<option value='" + ubicacion.id + "'>" + ubicacion.nombre + "</option>";
                contenidoBusqueda += opt;
                contenidoFicha += opt;
            });

            if (selUbicacion) selUbicacion.innerHTML = contenidoBusqueda;
            if (selUbicacionRecurso) selUbicacionRecurso.innerHTML = contenidoFicha;
        }
    });

    // Solicitar modelos 
    rest.get("/api/modelos", function(estado, datos) {
        if (estado === 200) {
            var selModelo = document.getElementById("modeloSelect");
            var contenidoBusqueda = "<option value=''>Todos</option>";
            datos.forEach(function(modelo) {
                contenidoBusqueda += "<option value='" + modelo.id + "'>" + modelo.nombre + "</option>";
            });
            if (selModelo) selModelo.innerHTML = contenidoBusqueda;

            // El modelo de la FICHA se queda esperando a la categoría
            var selModeloRecurso = document.getElementById("modeloRecurso");
            if (selModeloRecurso) {
                selModeloRecurso.innerHTML = "<option value=''>Seleccione categoría primero</option>";
            }
        }
    });

    // Solicitar estados (manual) para el filtro de búsqueda
    var selEstado = document.getElementById("estadoSelect");
    if (selEstado) {
        selEstado.innerHTML = "<option value=''>Todos</option>" +
                              "<option value='0'>Operativo</option>" +
                              "<option value='1'>Defectuoso</option>" +
                              "<option value='2'>En mantenimiento</option>";
    }
}

function buscar() {
    var idCat = document.getElementById("categoriaSelect").value;
    var idMod = document.getElementById("modeloSelect").value;
    var idUbi = document.getElementById("ubicacionSelect").value; // Este es Planta 1, Planta 2...
    var idEst = document.getElementById("estadoSelect").value;

    // Crea la url con los parámetros de búsqueda, solo añadiendo los que tengan valor
    var url = "/api/recursos?categoria=" + idCat + 
              "&modelo=" + idMod + 
              "&ubicacion=" + idUbi + 
              "&estado=" + idEst;

    console.log("Buscando en URL:", url); // Esto te dirá en la consola qué estás enviando

    rest.get(url, function(status, data) {
        console.log("Respuesta del servidor:", status, data); 
        if (status === 200) {
            pintarTabla(data);
        }
    });
}
// Función para pintar la tabla con los recursos obtenidos

function pintarTabla(listaRecursos) {
    console.log("Intentando pintar recursos:", listaRecursos);
    
    var tabla = document.getElementById("tabla-recursos");
    var tbody = tabla.querySelector("tbody");
    tbody.innerHTML = ""; 

    if (!listaRecursos || listaRecursos.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center'>Sin resultados</td></tr>";
        return;
    }

    rest.get("/api/modelos", function(s1, modelos) {
        rest.get("/api/categorias", function(s2, categorias) {
            rest.get("/api/ubicaciones", function(s3, ubicaciones) {
                
                if (s1 === 200 && s2 === 200 && s3 === 200) {
                    listaRecursos.forEach(function(r) {
                        var modObj = modelos.find(m => m.id == r.modelo) || { nombre: "Desconocido", categoria: "" };
                        var catObj = categorias.find(c => c.id == modObj.categoria) || { nombre: "Desconocido" };
                        var ubiObj = ubicaciones.find(u => u.id == r.ubicacion) || { nombre: "Desconocido" };
                        
                        var estados = ["Operativo", "Defectuoso", "En mantenimiento"];
                        var textoEstado = estados[r.estado] || "---";

                        // 1. Creamos la fila
                        var fila = document.createElement("tr");

                        // 2. Construimos el contenido sumando los trozos uno a uno
                        var contenido = "";
                        contenido += "<td>" + r.num_serie + "</td>";
                        contenido += "<td>" + catObj.nombre + "</td>";
                        contenido += "<td>" + modObj.nombre + "</td>";
                        contenido += "<td>" + ubiObj.nombre + "</td>";
                        contenido += "<td>" + textoEstado + "</td>";
                        contenido += "<td>";
                        
                        // Añadimos la celda con los dos botones
                        contenido +=   "<button onclick='abrirRecurso(" + r.id + ")'>Abrir</button>";
                        contenido +=   "<button onclick='borrarRecurso(" + r.id + ")'>Borrar</button>";
                        contenido += "</td>";

                        // 3. Metemos el texto dentro de la fila y la pegamos en la tabla
                        fila.innerHTML = contenido;
                        tbody.appendChild(fila);
                    });
                }
            });
        });
    });
}
var recursoActual = null;
function abrirRecurso(id) {
    if (!id) {
        // MODO AÑADIR
        recursoActual = null;
        document.getElementById("numSerieRecurso").value = "";
        document.getElementById("categoriaRecurso").value = "";
        document.getElementById("ubicacionRecurso").value = "";
        document.getElementById("estadoRecurso").value = "0";
        document.getElementById("modeloRecurso").innerHTML = "<option value=''>Seleccione categoría primero</option>";
        cambiarSeccion("nuevo-recurso");
    } else {
        // MODO EDITAR
        rest.get("/api/recursos/" + id, function(status, resp) {
            if (status === 200) {
                recursoActual = resp;
                document.getElementById("numSerieRecurso").value = resp.num_serie;
                document.getElementById("ubicacionRecurso").value = resp.ubicacion;
                document.getElementById("estadoRecurso").value = resp.estado;
                cargarReservasFicha(id); // Carga las reservas de este recurso en la ficha
                cargarResenyasFicha(id); 
                // Para cargar la categoría y el modelo correctamente:
                rest.get("/api/modelos", function(s, modelos) {
                    var mod = modelos.find(m => String(m.id) === String(resp.modelo));
                    if (mod) {
                        document.getElementById("categoriaRecurso").value = mod.categoria;
                        // Forzamos la carga de modelos de esa categoría
                        actualizarModelos(mod.categoria, "modeloRecurso");
                        // Esperamos a que se llene el select para marcar el modelo actual
                        setTimeout(() => { 
                            document.getElementById("modeloRecurso").value = resp.modelo; 
                        }, 200);
                    }
                });
                cambiarSeccion("nuevo-recurso");
            }
        });
    }
}
function actualizarModelos(idCategoria, idSelect) {
    var selectModelos = document.getElementById(idSelect);
    
    // Si no hay categoría seleccionada, mostramos el mensaje de aviso
    if (!idCategoria || idCategoria === "") {
        //si es el select de la búsqueda --> que salgan todos
        if(idSelect === "modeloSelect") {
            rest.get("/api/modelos", function(status, listaCompleta) {
                if (status === 200) {
                    var html = "<option value=''>Todos</option>";
                    listaCompleta.forEach(function(modelo) {
                        html += "<option value='" + modelo.id + "'>" + modelo.nombre + "</option>";
                    });
                    selectModelos.innerHTML = html;
                }
            });
            return;
        }
        // si es el de la ficha --> mensaje normal
        selectModelos.innerHTML = "<option value=''>Seleccione categoría primero</option>";
        return;
    }

    // Pedimos todos los modelos al servidor (ruta /api/modelos de tu app.js)
    rest.get("/api/modelos", function(status, listaCompleta) {
        if (status === 200) {
            // Filtramos los modelos que pertenecen a la categoría elegida
            var filtrados = listaCompleta.filter(function(m) {
                return String(m.categoria) === String(idCategoria);
            });

            // Generamos las opciones del desplegable
            var html = "<option value=''>Seleccione modelo</option>";
            filtrados.forEach(function(modelo) {
                html += "<option value='" + modelo.id + "'>" + modelo.nombre + "</option>";
            });
            
            selectModelos.innerHTML = html;
        }
    });
}

function guardarRecurso() {
    // Recopilación de datos de la ficha
    var modelo = document.getElementById("modeloRecurso").value;
    var num_serie = document.getElementById("numSerieRecurso").value.trim();
    var ubicacion = document.getElementById("ubicacionRecurso").value;
    var estado = document.getElementById("estadoRecurso").value;

    // Validación básica
    if (!modelo || !num_serie || !ubicacion) {
        alert("Por favor, rellena los campos de modelo, serie y ubicación.");
        return;
    }

    var datos = {
        modelo: modelo,
        num_serie: num_serie,
        ubicacion: ubicacion,
        estado: estado
    };

    if (recursoActual) {
        // MODO EDITAR: Usamos el ID del recurso que abrimos
        rest.put("/api/recursos/" + recursoActual.id, datos, function(status) {
            if (status === 200) {
                alert("Recurso actualizado con éxito");
                cambiarSeccion("menu-principal");
                buscar(); // Refresca la tabla principal
            }
        });
    } else {
        // MODO CREAR: Nuevo recurso
        rest.post("/api/recursos", datos, function(status) {
            if (status === 201) {
                alert("Nuevo recurso creado");
                ///
                var categoriaSelect = document.getElementById("categoriaRecurso");
                var modeloSelect = document.getElementById("modeloRecurso");

                var nombreCategoria = categoriaSelect.options[categoriaSelect.selectedIndex].text;
                var nombreModelo = modeloSelect.options[modeloSelect.selectedIndex].text;

                enviarAviso({
                    tipoAviso: "creacion_recurso",
                    destino: "sanitario",
                    color: "aviso-azul",
                    texto: "SE HA CREADO UN NUEVO RECURSO " +
                        nombreCategoria.toUpperCase() +
                        " MODELO " + nombreModelo.toUpperCase() +
                        " CON CÓDIGO " + num_serie
                });

                //enviarAviso("sanitario", "El gestor ha creado un nuevo recurso");
                cambiarSeccion("menu-principal");
                buscar();
            }
            else if (status === 404){
                alert("Error al crear el recurso");
                }
        });
    }
}

function nuevoRecurso(){
    recursoActual = null; 

    // 1. Limpiamos los textos
    document.getElementById("numSerieRecurso").value = "";
    
    // 2. Reseteamos los selects a la primera opción ("Seleccione...")
    document.getElementById("categoriaRecurso").value = "";
    document.getElementById("ubicacionRecurso").value = "";
    document.getElementById("estadoRecurso").value = "0"; 

    // 3. Importante: Dejamos el de modelos vacío hasta que elijan categoría
    var selModelo = document.getElementById("modeloRecurso");
    selModelo.innerHTML = "<option value=''>Seleccione categoría primero</option>";
    selModelo.value = "";

    // 4. Cambiamos la vista
    cambiarSeccion("nuevo-recurso");
}

function borrarRecurso(id) {
    // 1. Pedimos confirmación para evitar sustos
    if (confirm("¿Estás seguro de que quieres borrar este recurso?")) {
        // 2. Llamamos a la ruta DELETE que tienes en tu servidor
        rest.delete("/api/recursos/" + id, function(status, respuesta) {
            if (status === 200) {
                alert("Recurso borrado correctamente");
                // 3. Volvemos a buscar para que la tabla se actualice sola
                buscar(); 
            } else {
                alert("Error al borrar el recurso");
            }
        });
    }
}

function cargarReservasFicha(idRecurso) {
    // Buscar cuerpo de la tabla en el HTML para limpiarlo
    var tabla = document.getElementById("tabla-reservas");
    var tbody = tabla.querySelector("tbody");
    tbody.innerHTML = ""; // limpia la tabla antes de cargar los datos 

    // Se pide al servidor las reservas de este recurso específico
    rest.get("/api/recursos/" + idRecurso + "/reservas", function(status, reservas) {
        if (status === 200) {
            // recorrer cada reserva recibida en la lista de reservas
            reservas.forEach(function(r) {
                // Se obtiene el ID del sanitario de la reserva 
                var idSan = r.sanitario;

                // Se pide al servidor los datos de ese sanitario
                rest.get("/api/sanitarios/" + idSan, function(s, sanitario) {
                    var nombreSanitario;
                    if (s === 200) {
                        nombreSanitario = sanitario.nombre + " " + sanitario.apellidos;
                    } else {
                        nombreSanitario = "Sanitario desconocido";
                    }

                    // COLORES 
                    var claseColor = "";
                    var ahora = new Date();
                    var fInicio = new Date(r.f_inicio);

                    if (r.f_fin !== null && r.f_fin !== "") {
                        // Blanco --> reserva finalizada (tiene fecha fin)
                        claseColor = "reserva-blanca";
                    } 
                    //si no tiene fecha de inicio - VERDE
                    else if(r.f_inicio === null || r.f_inicio ===""){
                        claseColor = "reserva-verde";
                    }
                    //si tiene fecha de inicio pero no fecha de fin
                    else if (ahora >= fInicio) {
                        // Recurso ya está en uso (ya ha pasado la fecha de inicio)
                        var miliseg = ahora - fInicio;
                        var horasTranscurridas = miliseg / (1000 * 60 * 60);

                        if (horasTranscurridas > parseFloat(r.h_estimadas)) {
                            // Rojo: en uso y superadas las horas
                            claseColor = "reserva-roja";
                        } else {
                            // Azul: en uso dentro del tiempo
                            claseColor = "reserva-azul";
                        }
                    } 
                    else {
                        // Verde: la fecha de inicio es futura
                        claseColor = "reserva-verde";
                    }

                    // Se construye la fila (tr) con los datos 
                    var fila = document.createElement("tr");
                    fila.className = claseColor; 

                    // IMPORTANTE: Al usar createElement("tr"), el innerHTML NO debe llevar etiquetas <tr> interiores
                    fila.innerHTML = 
                        "<td>" + nombreSanitario + "</td>" +        
                        "<td>" + r.h_estimadas + "</td>" +       
                        "<td>" + r.f_peticion.replace('T', ' ') + "</td>" + 
                        //si r.f_inicio tiene valor, hace r.f_inicio.replace..., sino usa ---
                        "<td>" + (r.f_inicio ? r.f_inicio.replace('T', ' ') : "---") + "</td>" +   
                        "<td>" + (r.f_fin ? r.f_fin.replace('T', ' ') : "---") + "</td>";

                    // Se añade la fila al cuerpo de la tabla
                    tbody.appendChild(fila);
                }); // Cierre del rest.get de sanitarios
            }); // Cierre del forEach
        } else {
            tbody.innerHTML = "<tr><td colspan='5'>No se han podido cargar las reservas</td></tr>";
        }
    });
}

function cargarResenyasFicha(idRecurso) {
    // Buscar cuerpo de la tabla en el HTML para limpiarlo
    var tabla = document.getElementById("tabla-resenyas");
    var tbody = tabla.querySelector("tbody");
    tbody.innerHTML = ""; // limpia la tabla antes de cargar los datos 

    // Se pide al servidor las reseñas de este recurso específico
    rest.get("/api/recursos/" + idRecurso + "/resenyas", function(status, resenyas) {
        console.log("URL reseñas:", "/api/recursos/" + idRecurso + "/resenyas", "status:", status, "data:", resenyas);
        if (status === 200) {
            // recorrer cada reseña recibida en la lista
            resenyas.forEach(function(res) {
                // Se obtiene el ID del sanitario de la reseña
                var idSan = res.sanitario;

                // Se pide al servidor los datos de ese sanitario
                rest.get("/api/sanitarios/" + idSan, function(s, sanitario) {
                    var nombreSanitario;
                    if (s === 200) {
                        nombreSanitario = sanitario.nombre + " " + sanitario.apellidos;
                    } else {
                        nombreSanitario = "Sanitario desconocido";
                    }

                    // Se construye la fila (tr) con los datos exactos de tu datos.js
                    var fila = document.createElement("tr");

                    // Rellenamos las 4 columnas: Fecha, Sanitario, Valoración y Comentario
                    // Usamos res.descripcion para el comentario según tu datos.js
                    fila.innerHTML = 
                        "<td>" + res.fecha.replace('T', ' ') + "</td>" +        
                        "<td>" + nombreSanitario + "</td>" +       
                        "<td>" + res.valor + "</td>" + 
                        "<td>" + res.descripcion + "</td>";

                    // Se añade la fila al cuerpo de la tabla
                    tbody.appendChild(fila);
                }); // Cierre rest.get sanitario
            }); // Cierre forEach
        } else {
            // Si no hay o falla, mensaje de error en las 4 columnas
            tbody.innerHTML = "<tr><td colspan='4'>No se han podido cargar las reseñas</td></tr>";
        }
    });
}

var nombresAreas = ["", "Alergología", "Anestesiología", "Cardiología", "Cirugía general", "Dermatología", "Aparato Digestivo", "Endocrinología", "Ginecología", "Hematología", "Medicina Interna", "Neumología", "Neurología", "Oftalmología", "Oncología", "Pediatría", "Psiquiatría", "Traumatología", "Urología"];
//PRACTICA 3 - integración en servidor externo
function enviarDatosMinisterio(){
    var datos = [];
    var totalRecursos = 0;
    var recursosProcesados=0;
    var sanitariosPendientes=0;

    rest.get("/api/modelos", function(status, modelos){
        //solo sirve para guardar la lista de modelos
        rest.get("/api/categorias", function(status, categorias){
            //solo sirve para guardar la lista de categorias
            rest.get("/api/recursos", function(status, recursos){
                totalRecursos = recursos.length;
                //recorrer los recursos y buscar las reservas de cada recurso
                for(var i=0; i<recursos.length;i++){
                    //variables con let para que sigan igual en cada vuelta del for y no se cambien antes de que se usen abajo
                    let idRec = recursos[i].id;
                    let nombre_categoria = "";
                    //buscar el modelo del recurso
                    for(var k=0; k<modelos.length;k++){
                        if(modelos[k].id == recursos[i].modelo){
                            for(var m=0; m<categorias.length;m++){
                                if(categorias[m].id == modelos[k].categoria){
                                    nombre_categoria = categorias[m].nombre;
                                }
                            }
                        }
                    }
                    rest.get("/api/recursos/" + idRec + "/reservas", function(status, reservas){
                        console.log(reservas);
                        for(var j=0;j<reservas.length;j++){
                            let reserva = reservas[j];
                            if(reserva.sanitario!=null && reserva.sanitario!="" && reserva.f_peticion!= null && reserva.f_peticion != "" && horas_estimadas >= 0){
                                //estas reservas SÍ interesan
                                var idSan = reserva.sanitario;
                                sanitariosPendientes++;
                                rest.get("/api/sanitarios/" + idSan, function(status, sanitario){
                                    console.log(sanitario);
                                    //añadir los datos necesarios al array de datos
                                    //se crea un objeto con todo lo necesario 
                                    var dato = {
                                        nombre: sanitario.nombre,
                                        apellidos: sanitario.apellidos,
                                        categoría: nombre_categoria,
                                        horas_estimadas: reserva.h_estimadas,
                                        fec_pet: reserva.f_peticion,
                                        fec_ini: reserva.f_inicio,
                                        fecha_fin: reserva.f_fin
                                    }
                                    //se añade el objeto al array de datos
                                    datos.push(dato);
                                    console.log("Datos de las reservas", datos);
                                    //para comprobar cuantos sanitarios quedan antes de mandar los datos
                                    sanitariosPendientes--;
                                    //se comprueba que no queda nada pendiente, si está completo, se envían los datos al servidor del Ministerio
                                    if(comprobarDatos(totalRecursos, recursosProcesados, sanitariosPendientes)){
                                        enviarDatos(datos);
                                    }
                                });
                            }
                        }
                        recursosProcesados++;
                        if(comprobarDatos(totalRecursos, recursosProcesados, sanitariosPendientes)){
                            enviarDatos(datos);
                        }
                    });
                }
            });
        });
    });
}
//comprobar que los datos estan completos para enviar
function comprobarDatos(totalRecursos, recursosProcesados,sanitariosPendientes){
    var listo = false;
    if(recursosProcesados == totalRecursos && sanitariosPendientes == 0){
        listo = true;
    }
    return listo;
}

function enviarDatos(datos){
    //[0] para quitar la hora de la fecha, pq solo interesa dia, mes y año
    var fecha = new Date().toISOString().split("T")[0];
    var datos_completos = {
        id_area: id_area,
        fecha:fecha,
        datos: datos
    };
    console.log(datos_completos);

    //hacer post de los datos al ministerio
    rest.post("https://undefined.ua.es/telemedicina/api/datos", datos_completos, function(status, respuesta){
        console.log(status);
        console.log(respuesta);
    });
}

function obtenerRankingMinisterio(){
    rest.get("https://undefined.ua.es/telemedicina/api/datos", function(status, respuesta){
        var ranking = {};
        var rankingOrdenado = [];
        for(var i=0; i<respuesta.length;i++){
            var idArea = respuesta[i].id_area;
            var reservas = respuesta[i].datos;
            if(idArea >=1 && idArea <=18){
                for(var j=0; j<reservas.length;j++){
                    //comprobar si la reserva es válida
                    if(typeof reservas[j].nombre == "string" && reservas[j].nombre != "" &&
                        typeof reservas[j].apellidos == "string" && reservas[j].apellidos != "" &&
                        typeof reservas[j]["categoría"] == "string" && reservas[j]["categoría"] != "" &&
                        reservas[j].horas_estimadas != null && reservas[j].horas_estimadas != null &&
                        reservas[j].horas_estimadas >=0 &&
                        reservas[j].fec_pet != null &&
                        reservas[j].fec_pet != "" &&
                        !isNaN(new Date(reservas[j].fec_pet))){
                        if(ranking[idArea] == undefined){
                            ranking[idArea] = 1;
                        }
                        else{
                            ranking[idArea]++;
                        }
                    }
                }
            }
            
        }
        console.log(ranking);
        for(var area in ranking){
            //id del area y el numero de reservas que tiene ese area
            var datoRanking = {
                id_area: area,
                reservas: ranking[area]
            };
            rankingOrdenado.push(datoRanking);
            //para ordenar según la cantidad de reservas de cada area
            rankingOrdenado.sort(function(a,b){
                var orden = b.reservas - a.reservas;
                return orden;
            });
        }
        console.log(rankingOrdenado);
        //tabla del ranking
        var tabla = document.getElementById("tabla-ranking");
        var tbody = tabla.querySelector("tbody");
        //vaciar la tabla antes de pintarla
        tbody.innerHTML="";
        //recorrer el ranking ya ordenado
        for(var k=0; k<rankingOrdenado.length;k++){
            var nombreArea = nombresAreas[rankingOrdenado[k].id_area];
            var fila = document.createElement("tr");
            fila.innerHTML = "<td>" + (k+1) + "</td>" + "<td>" + nombreArea + "</td>" + "<td>" + rankingOrdenado[k].reservas + "</td>";
            tbody.appendChild(fila);
        }

    });
}
/*
document.addEventListener("DOMContentLoaded", function(){
    cargarDesplegables();
});
*/