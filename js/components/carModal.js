// js/components/carModal.js
import { companyConfig } from '../config/company.js';
import { renderGalleryModal } from './galleryModal.js';

export function renderCarModal(car, bcvRate) {
    let modal = document.getElementById('car-modal');
    if (modal) modal.remove();

    document.body.classList.add('modal-open');

    modal = document.createElement('div');
    modal.id = 'car-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-hidden';

    const formattedPriceUsd = Number(car.price_usd).toLocaleString('en-US');
    const priceBs = (car.price_usd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let plans = [];
    if (car.payment_type === 'cuotas' && car.car_financing_plans && car.car_financing_plans.length > 0) {
        plans = car.car_financing_plans.map(p => ({
            count: p.installments_count,
            frequency: p.frequency
        }));
    }

    const closeModal = () => {
        document.body.classList.remove('modal-open');
        const modalEl = document.getElementById('car-modal');
        if (modalEl) modalEl.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handleKeyDown);

    modal.innerHTML = `
        <div class="bg-surface border border-theme rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl flex flex-col my-auto max-h-[95vh]" onclick="event.stopPropagation()">
            
            <button id="close-car-modal" type="button" class="absolute top-2.5 right-2.5 z-30 bg-black/70 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold transition-all cursor-pointer shadow-lg border border-white/20 text-sm">&times;</button>
            
            <!-- Imagen compacta con botón de Galería superpuesto -->
            <div class="relative h-40 sm:h-42 w-full flex-shrink-0">
                <img src="${car.image_url}" alt="${car.brand} ${car.model}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-transparent to-transparent"></div>
                
                <button type="button" id="open-gallery-from-car-modal" class="absolute bottom-2 right-2 z-20 px-3 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold border border-white/20 flex items-center gap-1.5 cursor-pointer backdrop-blur-md transition-all">
                    <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    Galería de Fotos
                </button>
            </div>

            <!-- Contenedor principal -->
            <div class="p-4 -mt-5 relative z-10 flex flex-col gap-2.5 overflow-hidden">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-accent">${car.condition || 'Usado'}</span>
                        <h2 class="text-lg sm:text-xl font-extrabold text-main leading-tight">${car.brand} ${car.model}</h2>
                        <p class="text-[11px] text-muted">Año ${car.year}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg sm:text-xl font-black text-main">$${formattedPriceUsd}</span>
                        <p class="text-[10px] text-emerald-500 font-semibold">Bs. ${priceBs} <span class="text-[9px] text-muted">(BCV)</span></p>
                    </div>
                </div>

                ${car.payment_type === 'cuotas' && plans.length > 0 ? `
                    <div class="p-2.5 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 space-y-2">
                        <h4 class="text-[10px] font-bold uppercase text-accent tracking-wide">Planes de Financiamiento Disponibles</h4>
                        
                        <div class="flex flex-wrap gap-1" id="plan-buttons-container">
                            ${plans.map((p, idx) => `
                                <button type="button" data-index="${idx}" class="plan-btn px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${idx === 0 ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-surface text-main border-theme hover:bg-[var(--bg-surface-hover)]'}">
                                    ${p.count} cuotas (${p.frequency})
                                </button>
                            `).join('')}
                        </div>

                        <div class="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-theme/50">
                            <div>
                                <span class="text-muted text-[9px] block leading-none mb-0.5">Pago por cuota:</span>
                                <p class="text-accent font-extrabold text-xs sm:text-sm leading-tight" id="display-installment-usd"></p>
                            </div>
                            <div>
                                <span class="text-muted text-[9px] block leading-none mb-0.5">Equivalente en Bolívares:</span>
                                <p class="text-emerald-500 font-bold text-xs leading-tight" id="display-installment-bs"></p>
                            </div>
                        </div>

                        <div id="modal-installments-preview" class="pt-1.5 border-t border-theme/40"></div>
                    </div>
                ` : `
                    <div class="p-2 rounded-xl bg-surface-hover border border-theme text-[11px] text-muted">
                        Disponible únicamente para <strong class="text-main">Pago Único de Contado</strong>.
                    </div>
                `}

                <p class="text-[11px] text-muted leading-snug line-clamp-2">
                    ${car.description || 'Vehículo inspeccionado y garantizado. Contáctanos directamente para agendar una cita.'}
                </p>

                <div>
                    <a id="whatsapp-contact-link" href="#" target="_blank" class="w-full py-2 text-center block bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-xs shadow-sm">
                        Contactar Asesor (WhatsApp)
                    </a>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Evento para abrir la galería
    document.getElementById('open-gallery-from-car-modal')?.addEventListener('click', () => {
        closeModal();
        renderGalleryModal(car, bcvRate);
    });

    const closeBtn = document.getElementById('close-car-modal');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeModal(); };
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    function calculateDueDate(installmentIndex, frequency) {
        const date = new Date();
        const freq = (frequency || '').toLowerCase();

        if (freq.includes('semanal') && !freq.includes('quincenal')) {
            date.setDate(date.getDate() + (installmentIndex * 7));
        } else if (freq.includes('quincenal')) {
            date.setDate(date.getDate() + (installmentIndex * 15));
        } else if (freq.includes('trimestral')) {
            date.setMonth(date.getMonth() + (installmentIndex * 3));
        } else if (freq.includes('semestral')) {
            date.setMonth(date.getMonth() + (installmentIndex * 6));
        } else if (freq.includes('anual')) {
            date.setFullYear(date.getFullYear() + installmentIndex);
        } else {
            date.setMonth(date.getMonth() + installmentIndex);
        }

        return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    if (car.payment_type === 'cuotas' && plans.length > 0) {
        let currentModalPage = 1;

        const updatePlanDisplay = (planIndex) => {
            const selectedPlan = plans[planIndex] || plans[0];
            const installmentAmountUsd = (car.price_usd / selectedPlan.count).toFixed(2);
            const installmentAmountBs = (installmentAmountUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            document.getElementById('display-installment-usd').textContent = `$${Number(installmentAmountUsd).toLocaleString('en-US')} / ${selectedPlan.frequency}`;
            document.getElementById('display-installment-bs').textContent = `Bs. ${installmentAmountBs}`;

            renderModalPaginatedPreview(selectedPlan, installmentAmountUsd, currentModalPage);

            const waMsg = `Hola, estoy interesado en el ${car.brand} ${car.model} con el plan de ${selectedPlan.count} cuotas ${selectedPlan.frequency}s.`;
            document.getElementById('whatsapp-contact-link').href = `https://wa.me/${companyConfig.whatsappGlobal}?text=${encodeURIComponent(waMsg)}`;

            document.querySelectorAll('.plan-btn').forEach((btn, idx) => {
                if (idx === planIndex) {
                    btn.className = 'plan-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--accent)] text-white border border-transparent cursor-pointer shadow-xs';
                } else {
                    btn.className = 'plan-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface text-main border border-theme hover:bg-[var(--bg-surface-hover)] cursor-pointer';
                }
            });
        };

        const renderModalPaginatedPreview = (plan, amountUsd, page) => {
            const previewContainer = document.getElementById('modal-installments-preview');
            if (!previewContainer) return;

            const itemsPerPage = 4;
            const totalPages = Math.ceil(plan.count / itemsPerPage);
            const start = (page - 1) * itemsPerPage;
            const end = Math.min(start + itemsPerPage, plan.count);

            let previewHtml = `<div class="flex justify-between items-center mb-1 text-[10px] font-bold text-muted"><span>Proyección (Cuotas ${start + 1} a ${end} de ${plan.count}):</span><span class="text-accent">${plan.frequency}</span></div>`;
            previewHtml += `<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">`;

            for (let i = start + 1; i <= end; i++) {
                const estimatedDate = calculateDueDate(i, plan.frequency);
                previewHtml += `
                    <div class="p-1.5 rounded-lg bg-surface border border-theme text-center">
                        <span class="text-muted block text-[9px] font-semibold">Cuota ${i}</span>
                        <strong class="text-main font-extrabold text-[11px] block">$${amountUsd}</strong>
                        <span class="text-[9px] text-emerald-500/90 font-medium block leading-none mt-0.5">${estimatedDate}</span>
                    </div>
                `;
            }

            previewHtml += `</div>`;

            if (totalPages > 1) {
                previewHtml += `
                    <div class="flex items-center justify-between pt-1.5 text-[10px]">
                        <button type="button" id="modal-prev-page" ${page === 1 ? 'disabled class="opacity-30 text-muted cursor-not-allowed"' : 'class="text-accent font-bold cursor-pointer hover:underline"'}>&laquo; Anteriores</button>
                        <span class="text-muted font-bold">${page} / ${totalPages}</span>
                        <button type="button" id="modal-next-page" ${page === totalPages ? 'disabled class="opacity-30 text-muted cursor-not-allowed"' : 'class="text-accent font-bold cursor-pointer hover:underline"'}>Siguientes &raquo;</button>
                    </div>
                `;
            }

            previewContainer.innerHTML = previewHtml;

            document.getElementById('modal-prev-page')?.addEventListener('click', () => {
                if (currentModalPage > 1) {
                    currentModalPage--;
                    renderModalPaginatedPreview(plan, amountUsd, currentModalPage);
                }
            });

            document.getElementById('modal-next-page')?.addEventListener('click', () => {
                if (currentModalPage < totalPages) {
                    currentModalPage++;
                    renderModalPaginatedPreview(plan, amountUsd, currentModalPage);
                }
            });
        };

        document.querySelectorAll('.plan-btn').forEach(btn => {
            btn.onclick = () => {
                currentModalPage = 1;
                updatePlanDisplay(Number(btn.dataset.index));
            };
        });

        updatePlanDisplay(0);
    }
}