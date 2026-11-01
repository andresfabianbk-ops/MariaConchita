// Configuración de la API: única fuente de verdad para todo el frontend.
// Si la página la sirve Express (puerto del backend o sin puerto), '/api' relativa funciona.
// Si se abre con otro servidor (Live Server de VS Code) o como archivo, se apunta al backend
// en el mismo equipo/host, puerto 3000. Para otro backend, cambie solo PUERTO_BACKEND o esta lógica.
const PUERTO_BACKEND = '3000';

const API_URL = (() => {
  if (location.protocol === 'file:') {
    return `http://localhost:${PUERTO_BACKEND}/api`;
  }
  if (location.port === PUERTO_BACKEND || location.port === '') {
    return '/api';
  }
  return `${location.protocol}//${location.hostname}:${PUERTO_BACKEND}/api`;
})();