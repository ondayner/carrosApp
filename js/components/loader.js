/**
 * Componente modular ultra-ligero para estados de carga y Skeletons UI.
 */

// 1. SKELETON PARA EL CATALOGO / INVENTARIO (GRID DE TARJETAS)
export function showGridSkeleton(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="animate-pulse bg-surface border border-theme rounded-2xl h-52 w-full p-4 flex flex-col justify-end space-y-2 relative overflow-hidden">
                <div class="absolute inset-0 bg-surface-hover/60"></div>
                <div class="h-4 bg-theme/60 rounded-md w-3/4 z-10"></div>
                <div class="h-3 bg-theme/40 rounded-md w-1/2 z-10"></div>
                <div class="h-3 bg-theme/40 rounded-md w-1/3 z-10"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// 2. SKELETON PARA TABLAS (PANEL DE ADMINISTRACIÓN)
export function showTableSkeleton(tbodyId, columnsCount = 5, rowsCount = 4) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    let html = '';
    for (let r = 0; r < rowsCount; r++) {
        html += `<tr class="animate-pulse">`;
        for (let c = 0; c < columnsCount; c++) {
            html += `
                <td class="p-3">
                    <div class="h-4 bg-surface-hover rounded-md w-full"></div>
                </td>
            `;
        }
        html += `</tr>`;
    }
    tbody.innerHTML = html;
}

// 3. SKELETON PARA SECCIÓN DE MIS PAGOS / FINANCIAMIENTO
export function showFinancingSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="space-y-4 animate-pulse">
            <div class="h-10 bg-surface border border-theme rounded-xl w-full max-w-md"></div>
            <div class="bg-surface border border-theme rounded-2xl p-6 space-y-4">
                <div class="h-5 bg-surface-hover rounded-md w-1/3"></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    <div class="h-28 bg-surface-hover rounded-xl"></div>
                    <div class="h-28 bg-surface-hover rounded-xl"></div>
                    <div class="h-28 bg-surface-hover rounded-xl"></div>
                </div>
            </div>
        </div>
    `;
}

// 4. SPINNER / ESTADO DE CARGA PARA BOTONES (Acciones de guardado/envío)
export function setButtonLoading(buttonId, isLoading, originalText = 'Guardar') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-wait');
        btn.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando...</span>
            </div>
        `;
    } else {
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-wait');
        btn.innerHTML = btn.dataset.originalText || originalText;
    }
}