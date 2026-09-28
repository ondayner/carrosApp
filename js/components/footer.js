import { companyConfig } from '../config/company.js';

export function renderFooter() {
    const footerContainer = document.getElementById('footer-container');
    if (!footerContainer) return;

    // Detectar si la vista actual está dentro de la carpeta /views/
    const isInViews = window.location.pathname.includes('/views/');
    const pathToViews = isInViews ? './' : './views/';

    // Enlaces de contacto nativos usando company.js
    const whatsappUrl = `https://wa.me/${companyConfig.whatsappGlobal}?text=${encodeURIComponent('Hola, me gustaría recibir más información sobre el catálogo de vehículos.')}`;
    const mailtoUrl = `mailto:${companyConfig.email}?subject=${encodeURIComponent('Consulta de Vehículo / Crédito')}`;

    footerContainer.innerHTML = `
        <footer id="footer" class="bg-surface border-t border-theme text-muted py-10 transition-colors">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
                
                <!-- Columna 1: Información de la empresa -->
                <div class="flex flex-col items-start space-y-3 md:col-span-1">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-black text-white text-sm shadow-md">
                            ${companyConfig.logoLetter || 'CV'}
                        </div>
                        <h3 class="text-main font-extrabold text-base tracking-tight">${companyConfig.name}</h3>
                    </div>
                    <p class="text-xs text-muted leading-relaxed">${companyConfig.address}</p>
                </div>

                <!-- Columna 2: Contacto Directo (Enlaces interactivos con data de company.js) -->
                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-3">Contacto Directo</h4>
                    <ul class="space-y-2 text-xs">
                        <li>
                            <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-accent transition-colors flex items-center gap-1.5 text-main font-semibold">
                                <span>WhatsApp:</span> <span class="text-muted font-normal">${companyConfig.phone}</span>
                            </a>
                        </li>
                        <li>
                            <a href="${mailtoUrl}" class="hover:text-accent transition-colors flex items-center gap-1.5 text-main font-semibold">
                                <span>Email:</span> <span class="text-muted font-normal">${companyConfig.email}</span>
                            </a>
                        </li>
                    </ul>
                </div>

                <!-- Columna 3: Información BCV / Legales en nueva pestaña -->
                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-3">Legales y Términos</h4>
                    <ul class="space-y-2 text-xs">
                        <li>
                            <a href="${pathToViews}terms.html" target="_blank" rel="noopener noreferrer" class="hover:text-accent transition-colors text-muted">
                                Términos y Condiciones
                            </a>
                        </li>
                        <li>
                            <a href="${pathToViews}terms.html" target="_blank" rel="noopener noreferrer" class="hover:text-accent transition-colors text-muted">
                                Políticas de Privacidad
                            </a>
                        </li>
                    </ul>
                </div>

                <!-- Columna 4: Tasa Oficial BCV -->
                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-3">Tasa Oficial</h4>
                    <p class="text-xs text-muted leading-relaxed">
                        Precios e impresiones de cuotas sincronizados automáticamente con la tasa oficial del Banco Central de Venezuela (BCV).
                    </p>
                </div>

            </div>

            <!-- Copyright inferior con créditos a OndarDev -->
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 mt-8 border-t border-theme flex flex-col sm:flex-row items-center justify-between text-xs text-muted text-center sm:text-left gap-2">
                <p>&copy; ${new Date().getFullYear()} ${companyConfig.name}. Todos los derechos reservados.</p>
                <p class="flex items-center gap-1 font-medium">
                    Desarrollado por 
                    <a href="https://ondayner.github.io/ondardev" target="_blank" rel="noopener noreferrer" class="font-extrabold text-main hover:text-accent transition-colors underline decoration-accent/40">
                        OndarDev
                    </a>
                </p>
            </div>
        </footer>
    `;
}