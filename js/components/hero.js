// js/components/hero.js
import { renderGalleryModal } from './galleryModal.js';
import { renderCarModal } from './carModal.js';

export function renderHero(carsArray, bcvRate = 36.00) {
    const heroContainer = document.getElementById('hero-container');
    if (!heroContainer || !carsArray || carsArray.length === 0) return;

    const shuffled = [...carsArray].sort(() => 0.5 - Math.random());
    const randomSlides = shuffled.slice(0, 3);

    heroContainer.innerHTML = `
        <div class="relative w-full h-[calc(100vh-80px)] bg-[var(--bg-main)] flex items-center justify-center overflow-hidden py-0 dark:py-8">
            <div class="relative w-full max-w-5xl h-full dark:h-[80vh] dark:rounded-3xl overflow-hidden dynamic-shadow dark:mx-4">
                
                <div id="hero-slider" class="absolute inset-0 flex transition-transform duration-700 ease-in-out h-full">
                    ${randomSlides.map((car) => `
                        <div class="min-w-full h-full relative flex-shrink-0">
                            <img src="${car.image_url}" alt="${car.brand}${car.model}" class="absolute inset-0 w-full h-full object-cover">
                            
                            <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent" style="background-image: linear-gradient(to top, var(--bg-main) 0%, var(--bg-main) 20%, transparent 60%);"></div>
                            <div class="absolute inset-0 bg-gradient-to-r from-[var(--bg-main)] via-transparent to-[var(--bg-main)] opacity-70 hidden dark:block"></div>

                            <!-- Información y Botón Ver Fotos -->
                            <div class="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 text-center w-full px-4 z-10 flex flex-col items-center">
                                <span class="text-main text-xs sm:text-sm font-bold tracking-widest uppercase mb-1 block drop-shadow-md opacity-80">${car.brand}</span>
                                <h1 class="text-3xl sm:text-6xl font-extrabold text-accent tracking-tight drop-shadow-lg mb-3">${car.model}</h1>
                                
                                <!-- Botón Ver Fotos directo en Hero -->
                                <button type="button" data-hero-car-id="${car.id}" class="open-hero-gallery-btn px-4 py-2 rounded-xl bg-black/60 hover:bg-black/80 text-white font-bold text-xs border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg flex items-center gap-2">
                                    <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    Ver fotos
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20" id="hero-dots">
                    ${randomSlides.map((_, i) => `
                        <button data-index="${i}" class="hero-dot w-2.5 h-2.5 rounded-full bg-[var(--text-main)]/30 hover:bg-[var(--text-main)]/60 transition-all cursor-pointer ${i === 0 ? 'bg-accent w-6' : ''}"></button>
                    `).join('')}
                </div>

            </div>
        </div>
    `;

    let currentIndex = 0;
    const slider = document.getElementById('hero-slider');
    const dots = document.querySelectorAll('.hero-dot');

    function updateSlide(index) {
        if (!slider) return;
        slider.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('bg-accent', 'w-6');
                dot.classList.remove('bg-[var(--text-main)]/30', 'w-2.5');
            } else {
                dot.classList.remove('bg-accent', 'w-6');
                dot.classList.add('bg-[var(--text-main)]/30', 'w-2.5');
            }
        });
    }

    setInterval(() => {
        currentIndex = (currentIndex + 1) % randomSlides.length;
        updateSlide(currentIndex);
    }, 5000);

    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            currentIndex = Number(e.target.dataset.index);
            updateSlide(currentIndex);
        });
    });

    // Event listeners para los botones Ver Fotos
    document.querySelectorAll('.open-hero-gallery-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const carId = btn.dataset.heroCarId;
            const selectedCar = carsArray.find(c => c.id === carId);
            if (selectedCar) renderGalleryModal(selectedCar, bcvRate);
        });
    });
}