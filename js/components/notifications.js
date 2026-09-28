/**
 * Muestra un aviso Flotante (Toast)
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'info'} [type='info'] - Tipo de notificación
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none';
        document.body.appendChild(container);
    }

    const typeStyles = {
        success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200',
        error: 'bg-red-950/90 border-red-500/50 text-red-200',
        info: 'bg-surface border-theme text-main'
    };

    const icons = {
        success: `<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
        error: `<svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
        info: `<svg class="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto border rounded-xl p-3 shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md transition-all duration-300 transform translate-y-[-10px] opacity-0 ${typeStyles[type] || typeStyles.info}`;
    
    toast.innerHTML = `
        ${icons[type] || icons.info}
        <span class="flex-grow leading-tight">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-[-10px]', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-10px]');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}