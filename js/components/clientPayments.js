import { supabase } from '../config/supabase.js';
import { showToast } from './notifications.js';
import { getBcvRate } from '../services/bcv.js';
import { companyConfig } from '../config/company.js';
import { notifyAdminNewPayment } from '../services/notificationsPanel.js';
import { showFinancingSkeleton } from './loader.js';

let activeFilterStatus = 'todos'; 
let currentTab = 'activos';
const currentPageByFinancing = {};
let cachedFinancingsData = []; // Caché local en memoria para evitar peticiones redundantes
let cachedBcvRate = 36.00;

// MODAL DE REPORTAR PAGO
window.openPaymentModal = function(paymentId, amountUsd, bcvRate) {
    const existingModal = document.getElementById('payment-modal');
    if (existingModal) existingModal.remove();

    const numericAmount = Number(amountUsd) || 0;
    const amountBs = (numericAmount * bcvRate).toLocaleString('es-VE', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });

    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs overflow-y-auto';

    modal.innerHTML = `
        <div class="bg-surface border border-theme rounded-2xl max-w-xl w-full p-5 relative shadow-2xl space-y-4">
            <button id="close-pay-modal" class="absolute top-3 right-3 text-muted hover:text-main text-lg font-bold cursor-pointer">&times;</button>
            
            <div>
                <span class="text-[10px] font-bold text-accent uppercase tracking-wider block">Reportar Pago de Cuota</span>
                <h2 class="text-base font-extrabold text-main">Monto a pagar: $<span class="text-accent">${numericAmount} USD</span> (≈ ${amountBs} Bs)</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form id="submit-payment-form" class="space-y-3 bg-surface-hover p-3.5 rounded-xl border border-theme">
                    <input type="hidden" id="modal-payment-id" value="${paymentId}">
                    
                    <div>
                        <label class="block text-[11px] font-bold text-muted mb-1">Método de Pago *</label>
                        <select id="pay-method-select" required class="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-theme text-main text-xs focus:outline-none focus:border-[var(--accent)]">
                            <option value="">Elige una opción</option>
                            <option value="Pago Móvil">Pago Móvil (${companyConfig.pagoMovilData.banco})</option>
                            <option value="Binance">Binance (USDT)</option>
                            <option value="Cashea">Cashea</option>
                            <option value="Efectivo">Efectivo</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold text-muted mb-1">Nro. de Referencia o Detalles *</label>
                        <input type="text" id="pay-reference" required placeholder="Ej: 0412... o Ref 123456" class="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-theme text-main text-xs focus:outline-none focus:border-[var(--accent)]">
                    </div>

                    <button type="submit" id="submit-pay-btn" class="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs">
                        Enviar Comprobante al Admin
                    </button>
                </form>

                <div class="space-y-2.5">
                    <span class="text-[11px] font-bold text-muted block">Datos para realizar el pago:</span>
                    
                    <div class="p-2.5 rounded-xl bg-surface-hover border border-theme space-y-1">
                        <strong class="text-xs text-main">Pago Móvil ${companyConfig.pagoMovilData.banco}</strong>
                        <p class="text-[11px] text-muted leading-tight">Tel: ${companyConfig.pagoMovilData.telefono}<br>CI: ${companyConfig.pagoMovilData.cedula}</p>
                    </div>

                    <div class="p-2.5 rounded-xl bg-surface-hover border border-theme space-y-1">
                        <strong class="text-xs text-main">Binance (USDT)</strong>
                        <p class="text-[11px] text-muted leading-tight">Correo: ${companyConfig.binanceData.email}<br>PayID: ${companyConfig.binanceData.payId}</p>
                    </div>
                </div>
            </div>

            <div class="flex justify-end pt-2 border-t border-theme">
                <button type="button" id="cancel-pay-modal" class="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-theme text-muted hover:text-main cursor-pointer">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const closeModal = () => {
        document.body.classList.remove('modal-open');
        modal.remove();
    };

    document.getElementById('close-pay-modal').onclick = closeModal;
    document.getElementById('cancel-pay-modal').onclick = closeModal;

    document.getElementById('submit-payment-form').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-pay-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
        }

        const method = document.getElementById('pay-method-select').value;
        const ref = document.getElementById('pay-reference').value.trim();

        // CONGELAMOS LA TASA DEL DÍA Y EL CÁLCULO EN BS
        const currentRate = bcvRate || cachedBcvRate || 36.00;
        const staticAmountBs = Number((numericAmount * currentRate).toFixed(2));

        const { error } = await supabase
            .from('financing_payments')
            .update({
                status: 'en_revision',
                payment_method: method,
                reference_or_details: ref,
                bcv_rate_used: currentRate,
                amount_bs: staticAmountBs
            })
            .eq('id', paymentId);

        if (error) {
            showToast(error.message, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Comprobante al Admin';
            }
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('id', user.id)
                    .single();

                const userName = profileData?.first_name 
                    ? `${profileData.first_name} ${profileData.last_name || ''}`.trim() 
                    : (user.user_metadata?.first_name || user.email || 'Cliente');

                try {
                    await notifyAdminNewPayment(userName, paymentId, numericAmount, user.id);
                } catch (notifyErr) {
                    console.error("Error al notificar admin:", notifyErr);
                }
            }

            showToast('¡Pago reportado! El administrador verificará los datos.', 'success');
            closeModal();
            
            if (user) {
                renderClientPayments('client-payments-container', user.id, true);
            }
        }
    };
};

export async function renderClientPayments(containerId, userId, forceRefresh = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (forceRefresh || cachedFinancingsData.length === 0) {
        showFinancingSkeleton(containerId);

        const [bcvRes, finRes] = await Promise.all([
            getBcvRate(),
            supabase
                .from('user_car_financings')
                .select('*, cars(*), financing_payments(*)')
                .eq('user_id', userId)
        ]);

        cachedBcvRate = bcvRes || 36.00;

        const rawFinancings = finRes.data || [];
        cachedFinancingsData = rawFinancings.filter(fin => {
            const hasPayments = fin.financing_payments && fin.financing_payments.length > 0;
            return fin.status !== 'cancelado' || hasPayments;
        });
    }

    if (cachedFinancingsData.length === 0) {
        container.innerHTML = `
            <div class="bg-surface border border-theme rounded-2xl p-8 text-center shadow-sm">
                <p class="text-xs text-muted">No tienes vehículos asignados en modalidad de pago a cuotas actualmente.</p>
                <p class="text-[10px] text-muted mt-1">Una vez que el administrador formalice una compra financiada, verás tus cuotas aquí.</p>
            </div>
        `;
        return;
    }

    const activeFinancings = [];
    const completedFinancings = [];

    cachedFinancingsData.forEach(fin => {
        const payments = fin.financing_payments || [];
        const isCompleted = (payments.length > 0 && payments.every(p => p.status === 'aprobado')) || fin.status === 'cancelado';
        if (isCompleted) {
            completedFinancings.push(fin);
        } else {
            activeFinancings.push(fin);
        }
    });

    const displayList = currentTab === 'completados' ? completedFinancings : activeFinancings;

    let htmlContent = '<div class="space-y-6">';

    htmlContent += `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-theme">
            <div class="flex items-center gap-2">
                <button onclick="window.switchFinancingTab('activos', '${containerId}', '${userId}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'activos' ? 'bg-accent text-white shadow-md' : 'bg-surface text-muted border border-theme hover:text-main'}">
                    Financiamientos Activos (${activeFinancings.length})
                </button>
                <button onclick="window.switchFinancingTab('completados', '${containerId}', '${userId}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'completados' ? 'bg-emerald-600 text-white shadow-md' : 'bg-surface text-muted border border-theme hover:text-main'}">
                    Vehículos Pagados / Historial (${completedFinancings.length})
                </button>
            </div>

            <div class="flex items-center gap-1.5 text-xs">
                <span class="font-bold text-muted mr-1">Cuotas:</span>
                <button onclick="window.setPaymentFilter('todos', '${containerId}', '${userId}')" class="px-2.5 py-1 rounded-lg font-bold border border-theme cursor-pointer ${activeFilterStatus === 'todos' ? 'bg-surface-hover text-main' : 'text-muted'}">Todas</button>
                <button onclick="window.setPaymentFilter('pagados', '${containerId}', '${userId}')" class="px-2.5 py-1 rounded-lg font-bold border border-theme cursor-pointer ${activeFilterStatus === 'pagados' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'text-muted'}">Pagadas</button>
                <button onclick="window.setPaymentFilter('no_pagados', '${containerId}', '${userId}')" class="px-2.5 py-1 rounded-lg font-bold border border-theme cursor-pointer ${activeFilterStatus === 'no_pagados' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'text-muted'}">Pendientes</button>
            </div>
        </div>
    `;

    if (displayList.length === 0) {
        htmlContent += `
            <div class="bg-surface border border-theme rounded-2xl p-8 text-center text-xs text-muted">
                ${currentTab === 'completados' ? 'Aún no tienes historial de vehículos pagados o desanclados.' : 'No tienes financiamientos activos pendientes.'}
            </div>
        </div>`;
        container.innerHTML = htmlContent;
        setupTabGlobalHandlers();
        return;
    }

    displayList.forEach((fin, idx) => {
        const brand = fin.cars?.brand || '';
        const model = fin.cars?.model || '';
        const year = fin.cars?.year || '';
        const isCancelled = fin.status === 'cancelado';
        const isFullyPaid = currentTab === 'completados';

        let badgeLabel = `Financiamiento Activo #${idx + 1}`;
        let badgeStyle = 'text-accent';

        if (isCancelled) {
            badgeLabel = 'Financiamiento Desanclado / Historial';
            badgeStyle = 'text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20';
        } else if (isFullyPaid) {
            badgeLabel = 'Vehículo Totalmente Pagado';
            badgeStyle = 'text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20';
        }

        htmlContent += `
            <div class="bg-surface border border-theme rounded-2xl p-4 sm:p-6 shadow-sm" id="financing-card-${fin.id}">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-theme">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold ${badgeStyle} uppercase tracking-wider block">
                                ${badgeLabel}
                            </span>
                        </div>
                        <h3 class="text-base font-extrabold text-main mt-0.5">${brand} ${model} (${year})</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-muted bg-surface-hover px-3 py-1.5 rounded-xl border border-theme">Total Cuotas: ${fin.total_installments}</span>
                        <button onclick="window.toggleCollapseFinancing('${fin.id}')" class="px-3 py-1.5 text-xs font-bold rounded-xl border border-theme text-main hover:bg-surface-hover cursor-pointer transition-colors">Minimizar</button>
                    </div>
                </div>

                <div id="installments-grid-${fin.id}" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
                <div id="pagination-controls-${fin.id}" class="mt-4 pt-3 border-t border-theme flex items-center justify-between text-xs"></div>
            </div>
        `;
    });

    htmlContent += '</div>';
    container.innerHTML = htmlContent;

    setupTabGlobalHandlers();

    displayList.forEach(fin => {
        renderPaginatedInstallmentsSync(fin.id, fin.financing_payments || [], cachedBcvRate);
    });
}

function setupTabGlobalHandlers() {
    window.switchFinancingTab = (tab, cId, uId) => {
        currentTab = tab;
        renderClientPayments(cId, uId, false);
    };

    window.setPaymentFilter = (status, cId, uId) => {
        activeFilterStatus = status;
        renderClientPayments(cId, uId, false);
    };

    window.toggleCollapseFinancing = (finId) => {
        const grid = document.getElementById(`installments-grid-${finId}`);
        const paginator = document.getElementById(`pagination-controls-${finId}`);
        if (grid) grid.classList.toggle('hidden');
        if (paginator) paginator.classList.toggle('hidden');
    };
}

function renderPaginatedInstallmentsSync(financingId, rawPayments, bcvRate) {
    const gridContainer = document.getElementById(`installments-grid-${financingId}`);
    const paginationContainer = document.getElementById(`pagination-controls-${financingId}`);
    if (!gridContainer) return;

    const payments = [...rawPayments].sort((a, b) => a.installment_number - b.installment_number);

    const filteredPayments = payments.filter(pay => {
        if (activeFilterStatus === 'pagados') return pay.status === 'aprobado';
        if (activeFilterStatus === 'no_pagados') return pay.status !== 'aprobado';
        return true;
    });

    if (filteredPayments.length === 0) {
        gridContainer.innerHTML = '<p class="text-xs text-muted col-span-full text-center py-4">No hay cuotas que coincidan con este filtro.</p>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const itemsPerPage = 6;
    if (!currentPageByFinancing[financingId]) {
        currentPageByFinancing[financingId] = 1;
    }

    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    let currentPage = currentPageByFinancing[financingId];

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSlice = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

    let gridHtml = '';

    paginatedSlice.forEach(pay => {
        const isApproved = pay.status === 'aprobado';
        const isUnderReview = pay.status === 'en_revision';
        const isLocked = isApproved || isUnderReview;
        
        let badgeColor = 'bg-surface-hover text-muted border-theme';
        let badgeText = 'SIN PAGAR';
        if (isApproved) {
            badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            badgeText = 'APROBADO';
        } else if (isUnderReview) {
            badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            badgeText = 'EN REVISIÓN';
        }

        const numericAmount = Number(pay.amount_usd) || 0;
        
        // CONDICIONAL DE MONTO ESTÁTICO VS DINÁMICO
        const displayRate = (isLocked && pay.bcv_rate_used) ? Number(pay.bcv_rate_used) : bcvRate;
        const displayAmountBs = (isLocked && pay.amount_bs)
            ? Number(pay.amount_bs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : (numericAmount * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const formattedUsd = numericAmount.toLocaleString('en-US');

        let actionButtonHtml = '';
        if (isApproved) {
            actionButtonHtml = '<div class="w-full py-1.5 text-center text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Pagado con éxito</div>';
        } else if (isUnderReview) {
            const whatsappMsg = encodeURIComponent(`Hola Admin, reporté el pago de la Cuota ${pay.installment_number} por $${numericAmount} USD.`);
            actionButtonHtml = `
                <div class="space-y-1.5">
                    <div class="w-full py-1 text-center text-[11px] font-bold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">Verificando pago...</div>
                    <a href="https://wa.me/${companyConfig.whatsappGlobal}?text=${whatsappMsg}" target="_blank" class="flex items-center justify-center gap-1 w-full py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs">
                        Avisar por WhatsApp
                    </a>
                </div>
            `;
        } else {
            actionButtonHtml = `<button onclick="window.openPaymentModal('${pay.id}', ${numericAmount}, ${bcvRate})" class="w-full py-1.5 text-xs font-bold rounded-lg bg-[var(--bg-main)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] text-main transition-all cursor-pointer shadow-xs">Pagar Cuota</button>`;
        }

        const methodHtml = pay.payment_method ? `<div class="text-[10px] text-accent font-semibold pt-1">Método: ${pay.payment_method}</div>` : '';

        gridHtml += `
            <div id="payment-card-${pay.id}" class="bg-surface-hover border border-theme rounded-xl p-3.5 flex flex-col justify-between gap-3 relative shadow-xs transition-all">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-main">Cuota ${pay.installment_number}</span>
                    <span class="text-[10px] font-semibold text-muted">${pay.due_date}</span>
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${badgeColor}">${badgeText}</span>
                </div>

                <div class="bg-surface p-3 rounded-lg border border-theme space-y-1">
                    <div class="text-sm font-extrabold text-main">$${formattedUsd} USD</div>
                    <div class="text-[11px] text-muted">
                        ≈ ${displayAmountBs} Bs <span class="text-[9px] font-semibold">(${isLocked ? 'Tasa fijada:' : 'Tasa:'} ${displayRate})</span>
                    </div>
                    ${methodHtml}
                </div>

                <div>${actionButtonHtml}</div>
            </div>
        `;
    });

    gridContainer.innerHTML = gridHtml;

    if (paginationContainer && totalPages > 1) {
        paginationContainer.innerHTML = `
            <span class="text-muted font-semibold">Mostrando cuotas ${startIndex + 1}-${Math.min(startIndex + itemsPerPage, filteredPayments.length)} de ${filteredPayments.length}</span>
            <div class="flex items-center gap-1.5">
                <button ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg border border-theme text-muted"' : `onclick="window.changeFinancingPage('${financingId}',${currentPage - 1})"`} class="px-2.5 py-1 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer">
                    &laquo; Anterior
                </button>
                <span class="px-2 font-bold text-accent">${currentPage} / ${totalPages}</span>
                <button ${currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg border border-theme text-muted"' : `onclick="window.changeFinancingPage('${financingId}',${currentPage + 1})"`} class="px-2.5 py-1 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer">
                    Siguiente &raquo;
                </button>
            </div>
        `;

        window.changeFinancingPage = (fId, newPage) => {
            currentPageByFinancing[fId] = newPage;
            renderPaginatedInstallmentsSync(fId, rawPayments, bcvRate);
        };
    } else if (paginationContainer) {
        paginationContainer.innerHTML = `<span class="text-muted font-semibold">Total: ${filteredPayments.length} cuota(s)</span>`;
    }
}