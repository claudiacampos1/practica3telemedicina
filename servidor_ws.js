// Crear un servidor HTTP
var http = require("http");
var httpServer = http.createServer();


// exportamos el archivo dato para poder usar los arrays del servidor 
//var datos = require("./datos.js");
var conexionBD = require("./conexion_mysql.js");
// guardamos el array de reservas
// var reservas = datos.reserv;

var WebSocketServer = require("websocket").server; 

var wsServer = new WebSocketServer({
	httpServer: httpServer
});


// Iniciar el servidor HTTP en un puerto
var puerto = 4444;
httpServer.listen(puerto, function () {
	console.log("Servidor de WebSocket iniciado en puerto:", puerto);
});

var clientes = []; //array de los clientes que se conectan
// Esperar a clientes...
wsServer.on("request", function (request) { // este callback se ejecuta cuando llega una nueva conexión de un cliente
	var connection = request.accept("avisos", request.origin); // aceptar conexión
	var cliente = { // creo un nuevo cliente
		connection: connection,
		tipo: null, // "sanitario" o "gestor"
        id: null,
		nombre:null
	};
	clientes.push(cliente); // lo añado a la lista de clientes
	console.log("Cliente conectado. Ahora son:", clientes.length);

    //mandar mensajes 
    //HAY QUE MODIFICARLO CON NUESTROS CASOS DE MENSAJES
    connection.on("message", function (message) { // mensaje recibido del cliente
		if (message.type === "utf8") { // es un mensaje de texto
			console.log("Mensaje recibido: " + message.utf8Data);
			var msg = JSON.parse(message.utf8Data); // pasar de cadena a objeto (guarda lo que llega del cliente_rest)
			
			switch (msg.operacion) {
				//identificar es la peticion del cliente
				case "identificar": // se identifica un nuevo cliente
					cliente.tipo = msg.tipo;
					cliente.id = msg.id;
					cliente.nombre = msg.nombre;
					console.log("Se ha identificado:", cliente.tipo, cliente.id, cliente.nombre);
					connection.sendUTF(JSON.stringify({
						//identificado es la respuesta del servidor
						operacion: "identificado",
						texto: "Conectado como " + cliente.tipo
						//nombre: clientes[i].nombre
					}));
					break;

				case "aviso":
					var aviso = {
						operacion: "aviso",
						origen: cliente.nombre, // nombre del usuario que provoca el aviso
						texto: msg.texto,
						fecha: new Date(),
						color: msg.color,
						tipoAviso: msg.tipoAviso, // creacion_recurso, resenya, inicio_reserva o fin_reserva
						idRecurso: msg.idRecurso // recurso afectado para filtrar avisos rojos
					};

					if(msg.destino === "sanitarios_recurso"){
						enviarAvisoSanitariosConReservaActiva(msg.idRecurso, aviso); // filtra sanitarios con reserva activa
					}
					else{
						enviarAviso(msg.destino, aviso); // envío normal a gestores o sanitarios
					}

					break;
				}
			}
	});
    connection.on("close", function () { // conexión cerrada
		console.log("Cliente desconectado");
		for (var i=0;i<clientes.length;i++) { // busco el cliente
			if (clientes[i] === cliente) {
				clientes.splice(i, 1); // lo elimino
				for (var j=0;j<clientes.length;j++) { // notifico al resto
					clientes[j].connection.sendUTF(JSON.stringify({
						operacion: "salir",
						quien: cliente.nombre
					}));
				}
				break;
			}
		}
	});
});

//si msg.destino = gestor --> SOLO lo reciben los gestores
//si msg.destino = sanitario --> SOLO lo reciben los sanitarios
function enviarAviso(destino, aviso){
	for(var i = 0; i<clientes.length; i++){
		if(clientes[i].tipo == destino){
			clientes[i].connection.sendUTF(JSON.stringify(aviso));
		}
	}
}
/*
function enviarAvisoSanitariosConReservaActiva(idRecurso, aviso){
	// Recorremos todos los clientes conectados al WebSocket
	for(var i = 0; i < clientes.length; i++){

		// Solo nos interesan los clientes que sean sanitarios
		if(clientes[i].tipo === "sanitario"){

			// Al principio suponemos que este sanitario no tiene reserva activa
			var tieneReservaActiva = false;

			// Recorremos todas las reservas para comprobar si este sanitario tiene una activa
			for(var j = 0; j < reservas.length; j++){
				var r = reservas[j];

				// La reserva debe ser del mismo recurso, del mismo sanitario, estar iniciada y no finalizada
				if(r.recurso == idRecurso &&
				   r.sanitario == clientes[i].id &&
				   r.fecha_inicio != null &&
				   r.fecha_fin == null){

					// Si cumple todo, este sanitario sí debe recibir el aviso
					tieneReservaActiva = true;
					break;
				}
			}

			// Si el sanitario tiene reserva activa de ese recurso, se le envía el aviso
			if(tieneReservaActiva){
				clientes[i].connection.sendUTF(JSON.stringify(aviso));
			}
		}
	}
}
*/
function enviarAvisoSanitariosConReservaActiva(idRecurso, aviso){
	//buscar en la base de datos las reservas activas de ese recurso
	var sqlReservas = "SELECT sanitario FROM reservas WHERE recurso=? AND f_inicio IS NOT NULL AND f_fin IS NULL";
	conexionBD.query(sqlReservas, [idRecurso], function(error, reservas){
		if(error){
			console.log("Error al buscar las reservas activas: ", error);
			return;
		}
		else{
			//recorrer todos los clientes conectados al WS
			for(var i = 0; i < clientes.length; i++){
				// Solo nos interesan los clientes que sean sanitarios
				if(clientes[i].tipo === "sanitario"){
					// Al principio suponemos que este sanitario no tiene reserva activa
					var tieneReservaActiva = false;

					// Recorremos todas las reservas para comprobar si este sanitario tiene una activa
					for(var j = 0; j < reservas.length; j++){
						if(reservas[j].sanitario == clientes[i].id){
							tieneReservaActiva = true;
							break;
						}
					}
					//si tiene una reserva activa de ese recurso, se le manda el aviso
					if(tieneReservaActiva){
						clientes[i].connection.sendUTF(JSON.stringify(aviso));
					}
				}
			}
		}
	});
}

//en cliente_rest.js --> en main.js añadir conexion WebSocket del gestor, después de que el login Rest haya sido correcto
// (y función para mostrar avisos)
//  en ese index añadir tabla de avisos de los gestores
//en cliente_rpc --> en main.js añadir coneción WebSocket después del login correcto del sanitario
// (y función para mostrar avisos)
//  en ese index añadir tabla de avisos de sanitarios
// RESUMEN DE COMO DEBE QUEDAR LA ESTRUCTURA
/**
    servidor_ws.js
    → nuevo servidor WebSocket

    cliente_rest/index.html
    → añadir tabla de avisos para gestores

    cliente_rest/main.js
    → conectar WS como gestor y enviar aviso al crear recurso

    cliente_rpc/index.html
    → añadir tabla de avisos para sanitarios

    cliente_rpc/main.js
    → conectar WS como sanitario y enviar avisos de reseñas/reservas
 */