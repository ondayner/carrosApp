export async function getBcvRate() {
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        return data.promedio || 36.00;
    } catch (error) {
        console.error("Error al consultar tasa BCV:", error);
        return 36.00; // Valor de respaldo seguro en caso de falla de red
    }
}