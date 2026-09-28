export function renderCarCard(car) {
    const formattedPrice = Number(car.price_usd).toLocaleString('en-US');
    const condition = car.condition || 'Usado';
    const isFinanced = car.payment_type === 'cuotas';

    return `
        <div onclick="window.openCarModal('${car.id}')" 
             class="relative rounded-2xl overflow-hidden cursor-pointer group h-52 w-full bg-surface transition-all hover:border-[var(--accent)] border border-theme shadow-sm">
            
            <!-- Badge Sutil de Financiamiento / Ver Planes -->
            <div class="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                <span class="px-2 py-1 rounded-lg text-[10px] font-bold tracking-tight backdrop-blur-md transition-all group-hover:scale-105 flex items-center gap-1 ${
                    isFinanced 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs' 
                        : 'bg-black/40 text-muted border border-white/10'
                }">
                    <svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    ${isFinanced ? 'Ver planes a cuotas' : 'Ver detalle'}
                </span>
            </div>

            <!-- Imagen de fondo -->
            <img src="${car.image_url}" 
                 onerror="this.onerror=null; this.src='https://dummyimage.com/600x400/121214/ffffff&text=${encodeURIComponent(car.brand + ' ' + car.model)}';"
                 alt="${car.brand} ${car.model}" 
                 loading="lazy"
                 class="absolute opacity-100 dark:opacity-45 inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                 
            <!-- Gradiente inferior -->
            <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-transparent block dark:hidden pointer-events-none" style="background-image: linear-gradient(to top, var(--bg-surface) 0%, var(--bg-surface) 35%, transparent 85%);"></div>
                
            <!-- Contenido de texto superpuesto -->
            <div class="absolute bottom-0 left-0 w-full p-4 flex flex-col justify-end pointer-events-none z-10">
                <h3 class="text-main font-bold text-base leading-tight mb-1">
                    ${car.brand} ${car.model}
                </h3>
                
                <div class="flex items-center text-xs text-muted mb-1">
                    <span>${car.year}</span>
                    <span class="mx-1.5">&middot;</span>
                    <span>${condition}</span>
                </div>
                
                <div class="text-muted text-xs font-medium">
                    Precio: <strong class="text-main">$${formattedPrice}</strong>
                </div>
            </div>
        </div>
    `;
}