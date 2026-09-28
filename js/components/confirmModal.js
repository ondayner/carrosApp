import { companyConfig } from '../config/company.js';

/**
 * Muestra un modal de confirmación o aviso interactivo.
 */
export function showConfirmModal({
    title = '¿Estás seguro?',
    message = 'Esta acción no se puede deshacer.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger'
}) {
    return new Promise((resolve) => {
        let existingModal = document.getElementById('custom-confirm-modal');
        if (existingModal) existingModal.remove();

        const typeStyles = {
            danger: {
                badgeBg: 'bg-red-500/10 text-red-500 border-red-500/20',
                btnBg: 'bg-red-600 hover:bg-red-500 text-white',
                iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>`
            },
            warning: {
                badgeBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                btnBg: 'bg-amber-600 hover:bg-amber-500 text-white',
                iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`
            },
            info: {
                badgeBg: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                btnBg: 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white',
                iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`
            }
        };

        const currentStyle = typeStyles[type] || typeStyles.danger;

        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in';

        modal.innerHTML = `
            <div class="bg-surface border border-theme rounded-2xl max-w-sm w-full p-5 relative shadow-2xl flex flex-col items-center text-center my-auto">
                
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center border mb-3 ${currentStyle.badgeBg}">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${currentStyle.iconSvg}
                    </svg>
                </div>

                <span class="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">${companyConfig.name}</span>
                <h3 class="text-base font-extrabold text-main mb-1 leading-snug">${title}</h3>
                <p class="text-xs text-muted leading-relaxed mb-5">${message}</p>

                <div class="flex items-center gap-2.5 w-full">
                    ${cancelText ? `
                        <button id="modal-cancel-btn" type="button" class="w-1/2 py-2 text-xs font-bold rounded-xl border border-theme text-main hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer">
                            ${cancelText}
                        </button>
                    ` : ''}
                    <button id="modal-confirm-btn" type="button" class="${cancelText ? 'w-1/2' : 'w-full'} py-2 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer ${currentStyle.btnBg}">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        const cleanup = (value) => {
            document.body.classList.remove('modal-open');
            modal.remove();
            resolve(value);
        };

        const cancelBtn = modal.querySelector('#modal-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => cleanup(false));
        }

        modal.querySelector('#modal-confirm-btn').addEventListener('click', () => cleanup(true));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup(false);
        });
    });
}

/**
 * Muestra un modal interactivo con un campo de texto para ingresar datos (ej. motivo de rechazo).
 * @param {Object} options
 * @param {string} options.title - Título del modal
 * @param {string} options.message - Explicación
 * @param {string} [options.placeholder='Escribe aquí...'] - Texto de ayuda para el input
 * @param {string} [options.confirmText='Enviar'] - Texto botón confirmar
 * @param {string} [options.cancelText='Cancelar'] - Texto botón cancelar
 * @returns {Promise<string|null>} Retorna el texto ingresado o null si cancela
 */
export function showPromptModal({
    title = 'Ingrese un valor',
    message = 'Escriba la información requerida a continuación:',
    placeholder = 'Escribe aquí...',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar'
}) {
    return new Promise((resolve) => {
        let existingModal = document.getElementById('custom-prompt-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'custom-prompt-modal';
        modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in';

        modal.innerHTML = `
            <div class="bg-surface border border-theme rounded-2xl max-w-sm w-full p-5 relative shadow-2xl flex flex-col items-center text-center my-auto">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center border mb-3 bg-red-500/10 text-red-500 border-red-500/20">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>

                <span class="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">${companyConfig.name}</span>
                <h3 class="text-base font-extrabold text-main mb-1 leading-snug">${title}</h3>
                <p class="text-xs text-muted leading-relaxed mb-4">${message}</p>

                <textarea id="prompt-modal-input" rows="3" placeholder="${placeholder}" class="w-full p-3 rounded-xl bg-surface border border-theme text-main text-xs focus:outline-none focus:border-[var(--accent)] hover:bg-[var(--bg-surface-hover)] transition-all mb-4 resize-none"></textarea>

                <div class="flex items-center gap-2.5 w-full">
                    <button id="prompt-cancel-btn" type="button" class="w-1/2 py-2 text-xs font-bold rounded-xl border border-theme text-main hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer">
                        ${cancelText}
                    </button>
                    <button id="prompt-confirm-btn" type="button" class="w-1/2 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-md transition-all cursor-pointer">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        const inputEl = modal.querySelector('#prompt-modal-input');
        inputEl?.focus();

        const cleanup = (value) => {
            document.body.classList.remove('modal-open');
            modal.remove();
            resolve(value);
        };

        modal.querySelector('#prompt-cancel-btn').addEventListener('click', () => cleanup(null));
        modal.querySelector('#prompt-confirm-btn').addEventListener('click', () => {
            const val = inputEl ? inputEl.value.trim() : '';
            cleanup(val);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup(null);
        });
    });
}