// js/components/galleryModal.js
import { renderCarModal } from './carModal.js';

export function renderGalleryModal(car, bcvRate) {
    closeAllActiveModals();

    document.body.classList.add('modal-open');

    // Construcción de la lista unificada (Foto Principal + Fotos Secundarias)
    const gallerySecondary = car.gallery_urls || [];
    const images = [
        car.image_url,
        ...gallerySecondary.filter(url => url !== car.image_url)
    ].filter(Boolean);

    let currentIndex = 0;

    const modal = document.createElement('div');
    modal.id = 'gallery-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md overflow-hidden';

    const formattedPriceUsd = Number(car.price_usd).toLocaleString('en-US');

    modal.innerHTML = `
        <div class="bg-surface border border-theme rounded-2xl w-full max-w-2xl overflow-hidden relative shadow-2xl flex flex-col my-auto max-h-[95vh]" onclick="event.stopPropagation()">
            
            <!-- Botón Cerrar -->
            <button id="close-gallery-modal" type="button" class="absolute top-3 right-3 z-30 bg-black/70 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold transition-all cursor-pointer shadow-lg border border-white/20 text-sm">&times;</button>

            <!-- Visor Principal de Foto -->
            <div class="relative h-64 sm:h-80 w-full bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img id="gallery-main-img" src="${images[0]}" alt="${car.brand} ${car.model}" class="w-full h-full object-contain transition-all duration-300">

                ${images.length > 1 ? `
                    <button id="prev-photo-btn" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full border border-white/20 cursor-pointer transition-all">
                        &laquo;
                    </button>
                    <button id="next-photo-btn" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full border border-white/20 cursor-pointer transition-all">
                        &raquo;
                    </button>
                ` : ''}

                <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-md border border-white/10 font-bold" id="photo-counter">
                    1 / ${images.length}
                </div>
            </div>

            <!-- Header e Interacción -->
            <div class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-theme bg-surface">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-accent">${car.condition || 'Usado'} &middot; ${car.year}</span>
                    <h2 class="text-lg font-extrabold text-main leading-tight">${car.brand} ${car.model}</h2>
                    <p class="text-xs font-black text-main">$${formattedPriceUsd}</p>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <button id="switch-to-plans-btn" type="button" class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Ver Planes de Cuotas
                    </button>
                </div>
            </div>

            <!-- Miniaturas -->
            ${images.length > 1 ? `
                <div class="p-3 bg-surface-hover border-t border-theme flex items-center gap-2 overflow-x-auto">
                    ${images.map((img, idx) => `
                        <img src="${img}" data-idx="${idx}" class="thumb-img w-12 h-12 rounded-lg object-cover cursor-pointer border-2 transition-all ${idx === 0 ? 'border-[var(--accent)] scale-105' : 'border-transparent opacity-70 hover:opacity-100'}">
                    `).join('')}
                </div>
            ` : ''}

        </div>
    `;

    document.body.appendChild(modal);

    const mainImg = document.getElementById('gallery-main-img');
    const counter = document.getElementById('photo-counter');

    const updatePhoto = (index) => {
        currentIndex = index;
        if (mainImg) mainImg.src = images[currentIndex];
        if (counter) counter.textContent = `${currentIndex + 1} / ${images.length}`;

        document.querySelectorAll('.thumb-img').forEach((thumb, idx) => {
            if (idx === currentIndex) {
                thumb.className = 'thumb-img w-12 h-12 rounded-lg object-cover cursor-pointer border-2 border-[var(--accent)] scale-105 transition-all';
            } else {
                thumb.className = 'thumb-img w-12 h-12 rounded-lg object-cover cursor-pointer border-2 border-transparent opacity-70 hover:opacity-100 transition-all';
            }
        });
    };

    document.getElementById('prev-photo-btn')?.addEventListener('click', () => {
        const newIdx = (currentIndex - 1 + images.length) % images.length;
        updatePhoto(newIdx);
    });

    document.getElementById('next-photo-btn')?.addEventListener('click', () => {
        const newIdx = (currentIndex + 1) % images.length;
        updatePhoto(newIdx);
    });

    document.querySelectorAll('.thumb-img').forEach(thumb => {
        thumb.addEventListener('click', () => updatePhoto(Number(thumb.dataset.idx)));
    });

    document.getElementById('switch-to-plans-btn')?.addEventListener('click', () => {
        closeGalleryModal();
        renderCarModal(car, bcvRate);
    });

    const closeGalleryModal = () => {
        document.body.classList.remove('modal-open');
        modal.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') closeGalleryModal();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.getElementById('close-gallery-modal').onclick = closeGalleryModal;
    modal.onclick = (e) => { if (e.target === modal) closeGalleryModal(); };
}

function closeAllActiveModals() {
    ['car-modal', 'gallery-modal', 'auth-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    document.body.classList.remove('modal-open');
}