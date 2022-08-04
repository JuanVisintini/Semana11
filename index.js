const express = require('express');
const util = require('util');
const { engine } = require('express-handlebars');

require('dotenv').config();
const app = express();
const port = process.env.PORT || 8080;

//FAKER 
const { productos } = require('./faker/faker');

const elegirContenedor = require('./daos/index');

const { Server: HttpServer } = require('http');
const { Server: IoServer } = require('socket.io');
const httpServer = new HttpServer(app);
const io = new IoServer(httpServer);

//Normalizr
const normalizr = require('normalizr');

const autorSchema = new normalizr.schema.Entity('autor', {}, { idAttribute: 'mail' });
const mensajeSchema = new normalizr.schema.Entity('mensaje', {
    autor: autorSchema,
});

//Midlleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

//View
app.engine("hbs", engine({
    extname: "hbs",
    defaultLayout: "main-layout",
    layoutsDir: __dirname + "/views/layouts",
    partialsDir: __dirname + "/views/partials",
}));

function print(data) {
    console.log(util.inspect(data, false, 12, true));
}

app.set("view engine", "hbs");
app.set("views", "./views");

app.get("/", (req, res) => {
    res.redirect("/api/productos");
});

app.get("/api/productos", (req, res) => {
    res.render("formProductos");
});

app.get("/api/productos-test", (req, res) => {
    res.render("listaProductosTest", { products: productos(5) })

});

//Socket
io.on('connection', async (socket) => {
    console.log(`se conecto el usuario: ${socket.id}`)

    const contendorProductos = await elegirContenedor("products");
    const contendorMensajes = await elegirContenedor("message");
    

    const mensajeNormalizado = normalizr.normalize(await contendorMensajes.getAll(), [mensajeSchema]);

    socket.emit('leerProducto', await contendorProductos.getAll());
    socket.emit('leerMensaje', mensajeNormalizado);

    socket.on('nuevoProducto', async (productoInfo) => {
      const idProducto = await contendorProductos.create(productoInfo);
      if(idProducto){
        const productos = await contendorProductos.getAll();
        io.emit('leerProducto', productos)
      }else{
        console.log("No se pudo crear el producto");
      }
    })

    socket.on('nuevoMensaje', async (messageInfo) => {
        const idMensaje = await contendorMensajes.create(messageInfo);
        if(idMensaje){
        const mensajesNormalizado = normalizr.normalize(await contendorMensajes.getAll(), [mensajeSchema]);
        console.log("MENSAJE NNORMALIZADO", mensajesNormalizado) ;
        io.emit('leerMensaje', mensajesNormalizado)
        console.log("paso")
        }
        else{
            console.log("No se pudo crear el mensaje");
        }
        
    })
})

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
