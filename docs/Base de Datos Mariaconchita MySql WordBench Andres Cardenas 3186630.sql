CREATE DATABASE restaurante_MariaConchita;
USE restaurante_MariaConchita;

-- =========================
-- TABLA ROL
-- =========================
CREATE TABLE rol (
    idrol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- =========================
-- TABLA USUARIO
-- =========================
CREATE TABLE usuario (
    idusuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    contraseña VARCHAR(100) NOT NULL,
    idrol INT NOT NULL,
    FOREIGN KEY (idrol) REFERENCES rol(idrol)
);

-- =========================
-- TABLA CLIENTE
-- =========================
CREATE TABLE cliente (
    idcliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(150)
);

-- =========================
-- TABLA MESA
-- =========================
CREATE TABLE mesa (
    idmesa INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL,
    estado VARCHAR(20) NOT NULL
);

-- =========================
-- TABLA CATEGORIA
-- =========================
CREATE TABLE categoria (
    idcategoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

-- =========================
-- TABLA PRODUCTO
-- =========================
CREATE TABLE producto (
    idproducto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    descripcion VARCHAR(200),
    idcategoria INT NOT NULL,
    FOREIGN KEY (idcategoria) REFERENCES categoria(idcategoria)
);

-- =========================
-- TABLA INVENTARIO
-- =========================
CREATE TABLE inventario (
    idinventario INT AUTO_INCREMENT PRIMARY KEY,
    idproducto INT NOT NULL,
    stock INT NOT NULL,
    fecha_actualizacion DATE,
    FOREIGN KEY (idproducto) REFERENCES producto(idproducto)
);

-- =========================
-- TABLA PEDIDO
-- =========================
CREATE TABLE pedido (
    idpedido INT AUTO_INCREMENT PRIMARY KEY,
    idcliente INT NOT NULL,
    idmesa INT NOT NULL,
    fecha DATE NOT NULL,
    estado VARCHAR(30) NOT NULL,
    FOREIGN KEY (idcliente) REFERENCES cliente(idcliente),
    FOREIGN KEY (idmesa) REFERENCES mesa(idmesa)
);

-- =========================
-- TABLA DOMICILIO
-- =========================
CREATE TABLE domicilio (
    iddomicilio INT AUTO_INCREMENT PRIMARY KEY,
    idpedido INT NOT NULL,
    direccion VARCHAR(150) NOT NULL,
    estado VARCHAR(30),
    FOREIGN KEY (idpedido) REFERENCES pedido(idpedido)
);

-- =========================
-- TABLA FACTURA
-- =========================
CREATE TABLE factura (
    idfactura INT AUTO_INCREMENT PRIMARY KEY,
    idpedido INT NOT NULL,
    fecha DATE NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (idpedido) REFERENCES pedido(idpedido)
);

-- =========================
-- TABLA PAGO
-- =========================
CREATE TABLE pago (
    idpago INT AUTO_INCREMENT PRIMARY KEY,
    idfactura INT NOT NULL,
    metodo VARCHAR(30) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    fecha DATE NOT NULL,
    FOREIGN KEY (idfactura) REFERENCES factura(idfactura)
);

-- =========================
-- TABLA DETALLE_PEDIDO
-- =========================
CREATE TABLE detalle_pedido (
    iddetalle INT AUTO_INCREMENT PRIMARY KEY,
    idpedido INT NOT NULL,
    idproducto INT NOT NULL,
    cantidad INT NOT NULL,
    preciounitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (idpedido) REFERENCES pedido(idpedido),
    FOREIGN KEY (idproducto) REFERENCES producto(idproducto)
);

-- =========================
-- TABLA TURNO
-- =========================
CREATE TABLE turno (
    idturno INT AUTO_INCREMENT PRIMARY KEY,
    idusuario INT NOT NULL,
    horainicio TIME NOT NULL,
    horafin TIME NOT NULL,
    FOREIGN KEY (idusuario) REFERENCES usuario(idusuario)
);