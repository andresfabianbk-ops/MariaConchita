-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: mariaconchita_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categoria`
--

DROP TABLE IF EXISTS `categoria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categoria` (
  `id_categoria` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id_categoria`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cliente`
--

DROP TABLE IF EXISTS `cliente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cliente` (
  `id_cliente` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `telefono` varchar(20) NOT NULL,
  PRIMARY KEY (`id_cliente`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `detalleingredienteexcluido`
--

DROP TABLE IF EXISTS `detalleingredienteexcluido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalleingredienteexcluido` (
  `id_detalle` int NOT NULL,
  `id_insumo` int NOT NULL,
  PRIMARY KEY (`id_detalle`,`id_insumo`),
  KEY `fk_excluido_insumo` (`id_insumo`),
  CONSTRAINT `fk_excluido_detalle` FOREIGN KEY (`id_detalle`) REFERENCES `detallepedido` (`id_detalle`),
  CONSTRAINT `fk_excluido_insumo` FOREIGN KEY (`id_insumo`) REFERENCES `insumo` (`id_insumo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `detallepedido`
--

DROP TABLE IF EXISTS `detallepedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detallepedido` (
  `id_detalle` int NOT NULL AUTO_INCREMENT,
  `id_pedido` int NOT NULL,
  `id_producto` int NOT NULL,
  `cantidad` int NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_detalle`),
  KEY `fk_detalle_pedido` (`id_pedido`),
  KEY `fk_detalle_producto` (`id_producto`),
  CONSTRAINT `fk_detalle_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`),
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`id_producto`) REFERENCES `producto` (`id_producto`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `domicilio`
--

DROP TABLE IF EXISTS `domicilio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `domicilio` (
  `id_domicilio` int NOT NULL AUTO_INCREMENT,
  `id_pedido` int NOT NULL,
  `direccion` varchar(150) NOT NULL,
  `estado` enum('En camino','Entregado') NOT NULL DEFAULT 'En camino',
  PRIMARY KEY (`id_domicilio`),
  UNIQUE KEY `id_pedido` (`id_pedido`),
  CONSTRAINT `fk_domicilio_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `factura`
--

DROP TABLE IF EXISTS `factura`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `factura` (
  `id_factura` int NOT NULL AUTO_INCREMENT,
  `id_pedido` int NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_factura`),
  UNIQUE KEY `id_pedido` (`id_pedido`),
  CONSTRAINT `fk_factura_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `insumo`
--

DROP TABLE IF EXISTS `insumo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insumo` (
  `id_insumo` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `unidad_medida` enum('kg','g','litro','ml','unidad') NOT NULL,
  `stock_actual` decimal(10,3) NOT NULL DEFAULT '0.000',
  `stock_minimo` decimal(10,3) NOT NULL DEFAULT '0.000',
  `costo_unitario` decimal(10,2) DEFAULT NULL,
  `fecha_actualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_insumo`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mesa`
--

DROP TABLE IF EXISTS `mesa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mesa` (
  `id_mesa` int NOT NULL AUTO_INCREMENT,
  `numero` int NOT NULL,
  `estado` enum('Libre','Ocupada') NOT NULL DEFAULT 'Libre',
  PRIMARY KEY (`id_mesa`),
  UNIQUE KEY `numero` (`numero`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `movimientoinventario`
--

DROP TABLE IF EXISTS `movimientoinventario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientoinventario` (
  `id_movimiento` int NOT NULL AUTO_INCREMENT,
  `id_insumo` int NOT NULL,
  `tipo` enum('Entrada','Salida por venta','Salida por merma') NOT NULL,
  `cantidad` decimal(10,3) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `motivo` varchar(150) DEFAULT NULL,
  `id_pedido` int DEFAULT NULL,
  PRIMARY KEY (`id_movimiento`),
  KEY `fk_movimiento_insumo` (`id_insumo`),
  KEY `fk_movimiento_pedido` (`id_pedido`),
  CONSTRAINT `fk_movimiento_insumo` FOREIGN KEY (`id_insumo`) REFERENCES `insumo` (`id_insumo`),
  CONSTRAINT `fk_movimiento_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pago`
--

DROP TABLE IF EXISTS `pago`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pago` (
  `id_pago` int NOT NULL AUTO_INCREMENT,
  `id_factura` int NOT NULL,
  `metodo` enum('Efectivo','Nequi','Daviplata','Tarjeta') NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pago`),
  KEY `fk_pago_factura` (`id_factura`),
  CONSTRAINT `fk_pago_factura` FOREIGN KEY (`id_factura`) REFERENCES `factura` (`id_factura`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pedido`
--

DROP TABLE IF EXISTS `pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedido` (
  `id_pedido` int NOT NULL AUTO_INCREMENT,
  `id_cliente` int DEFAULT NULL,
  `id_mesa` int DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('Pendiente','En preparación','Listo','Entregado') NOT NULL DEFAULT 'Pendiente',
  `pagado` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_pedido`),
  KEY `fk_pedido_cliente` (`id_cliente`),
  KEY `fk_pedido_mesa` (`id_mesa`),
  CONSTRAINT `fk_pedido_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `fk_pedido_mesa` FOREIGN KEY (`id_mesa`) REFERENCES `mesa` (`id_mesa`),
  CONSTRAINT `chk_pedido_origen` CHECK ((((`id_cliente` is not null) and (`id_mesa` is null)) or ((`id_cliente` is null) and (`id_mesa` is not null))))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `producto`
--

DROP TABLE IF EXISTS `producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto` (
  `id_producto` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `precio` decimal(10,2) NOT NULL,
  `id_categoria` int NOT NULL,
  `disponible` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_producto`),
  KEY `fk_producto_categoria` (`id_categoria`),
  CONSTRAINT `fk_producto_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categoria` (`id_categoria`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recetaproducto`
--

DROP TABLE IF EXISTS `recetaproducto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recetaproducto` (
  `id_producto` int NOT NULL,
  `id_insumo` int NOT NULL,
  `cantidad_requerida` decimal(10,3) NOT NULL,
  `es_excluible` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_producto`,`id_insumo`),
  KEY `fk_receta_insumo` (`id_insumo`),
  CONSTRAINT `fk_receta_insumo` FOREIGN KEY (`id_insumo`) REFERENCES `insumo` (`id_insumo`),
  CONSTRAINT `fk_receta_producto` FOREIGN KEY (`id_producto`) REFERENCES `producto` (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rol`
--

DROP TABLE IF EXISTS `rol`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rol` (
  `id_rol` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `turno`
--

DROP TABLE IF EXISTS `turno`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `turno` (
  `id_turno` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `hora_inicio` datetime NOT NULL,
  `hora_fin` datetime DEFAULT NULL,
  PRIMARY KEY (`id_turno`),
  KEY `fk_turno_usuario` (`id_usuario`),
  CONSTRAINT `fk_turno_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `tipo_documento` enum('CC','TI','PPT','PEP') NOT NULL,
  `numero_documento` varchar(10) NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `fecha_nacimiento` date NOT NULL,
  `correo` varchar(100) NOT NULL,
  `celular` varchar(20) DEFAULT NULL,
  `contrasena` varchar(255) NOT NULL,
  `id_rol` int NOT NULL,
  `estado` enum('Activo','Inactivo','Bloqueado') NOT NULL DEFAULT 'Activo',
  `cierres_vacios` int NOT NULL DEFAULT '0',
  `mes_cierres_vacios` char(7) DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `numero_documento` (`numero_documento`),
  UNIQUE KEY `correo` (`correo`),
  KEY `fk_usuario_rol` (`id_rol`),
  CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`id_rol`) REFERENCES `rol` (`id_rol`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-18 13:49:55
