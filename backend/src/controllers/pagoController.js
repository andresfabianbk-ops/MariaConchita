//Importa la logica de negocio
const { registrarPago, listarPagos } = require('../services/pagoService');

// Maneja la peticion HTTP para registrar un pago
const postPago = async (req, res) => {
    try {
        const pago = registrarPago(req.body);
        res.status(201).json(pago);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }  
};

// Maneja la peticion HTTP para listar pagos
const getPagos = async (req, res) => {
    try{
        const pagos = await listarPagos();
        res.status(200).json(pagos);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
   
}; 

module.exports = { postPago, getPagos };    

