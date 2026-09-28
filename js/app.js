import { getBcvRate } from './services/bcv.js';
import { renderCarCard } from './components/carCard.js';
import { renderNav } from './components/nav.js';
import { renderFooter } from './components/footer.js';
import { renderHero } from './components/hero.js';
import { renderAuthModal } from './components/authModal.js';
import { renderCarModal } from './components/carModal.js';
import { renderWhatsAppButton } from './components/whatsappButton.js';
import { supabase } from './config/supabase.js';
import { showGridSkeleton } from './components/loader.js';

let currentCarsData = [];
let filteredCarsData = [];
let catalogOptionsData = [];
let currentBcvRate = 36.00;

// Variables de paginación
let currentPage = 1;
const ITEMS_PER_PAGE = 8;

const grid = document.getElementById('cars-grid');
const noResults = document.getElementById('no-results');

const activeFilterValues = {
    brand: '',
    model: '',
    year: '',
    condition: ''
};

async function initApp() {
    const { data: { user } } = await supabase.auth.getUser();
    renderNav(user);
    renderFooter();
    renderWhatsAppButton();

    // Mostrar tarjetas esqueleto mientras responde Supabase / BCV
    showGridSkeleton('cars-grid', 8);

    currentBcvRate = await getBcvRate();

    const [carsData, optionsData] = await Promise.all([
        getCarsFromSupabase(),
        getCatalogOptionsFromSupabase()
    ]);

    currentCarsData = carsData;
    filteredCarsData = [...currentCarsData];
    catalogOptionsData = optionsData;

    // Pasamos currentBcvRate al Hero para permitir la navegación fluida entre fotos y planes
    renderHero(currentCarsData, currentBcvRate);
    setupCatalogCustomFilters();
    renderGridWithPagination();
}

async function getCarsFromSupabase() {
    const { data, error } = await supabase
        .from('cars')
        .select('*, car_financing_plans(*)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al consultar carros:", error);
        return [];
    }
    return data || [];
}

async function getCatalogOptionsFromSupabase() {
    const { data, error } = await supabase
        .from('catalog_options')
        .select('*');

    if (error) {
        console.error("Error al consultar catalog_options:", error);
        return [];
    }
    return data || [];
}

function setupCatalogCustomFilters() {
    const dbBrands = catalogOptionsData
        .filter(o => o.type === 'brand')
        .map(o => o.value);
    const brands = ['Todos', ...new Set(dbBrands)].sort();

    const dbModels = catalogOptionsData
        .filter(o => o.type === 'model')
        .map(o => o.value);
    const models = ['Todos', ...new Set(dbModels)].sort();

    const carYears = currentCarsData.map(c => String(c.year)).filter(Boolean);
    const years = ['Todos', ...new Set(carYears)].sort((a, b) => b - a);

    bindFilterInput('filter-brand', 'dropdown-filter-brand', brands, 'brand');
    bindFilterInput('filter-model', 'dropdown-filter-model', models, 'model');
    bindFilterInput('filter-year', 'dropdown-filter-year', years, 'year');

    initStaticConditionFilter();

    document.addEventListener('click', closeAllDropdowns);
}

function bindFilterInput(inputId, dropdownId, optionsList, filterKey) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    const renderDropdown = () => {
        closeAllDropdowns();
        const query = input.value.trim().toLowerCase();

        const matches = (query && query !== 'todos')
            ? optionsList.filter(item => item.toLowerCase().includes(query))
            : optionsList;

        dropdown.innerHTML = '';

        if (matches.length > 0) {
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = `custom-select-option ${(input.value || 'Todos') === item ? 'selected' : ''}`;
                div.textContent = item;

                div.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = item === 'Todos' ? '' : item;
                    activeFilterValues[filterKey] = input.value;
                    dropdown.classList.add('hidden');
                    applyFilters();
                };
                dropdown.appendChild(div);
            });
        } else {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'custom-select-option text-muted italic cursor-default';
            emptyDiv.textContent = 'Sin opciones maestras...';
            dropdown.appendChild(emptyDiv);
        }

        dropdown.classList.remove('hidden');
    };

    input.onclick = (e) => { e.stopPropagation(); renderDropdown(); };
    input.onfocus = (e) => { e.stopPropagation(); renderDropdown(); };
    input.oninput = () => {
        activeFilterValues[filterKey] = input.value;
        renderDropdown();
        applyFilters();
    };
}

function initStaticConditionFilter() {
    const hiddenInput = document.getElementById('filter-condition');
    const trigger = document.getElementById('trigger-filter-condition');
    const dropdown = document.getElementById('dropdown-filter-condition');

    if (!hiddenInput || !trigger || !dropdown) return;

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        closeAllDropdowns();
        if (isHidden) {
            dropdown.classList.remove('hidden');
            trigger.classList.add('active');
        }
    };

    dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
        optEl.onclick = (e) => {
            e.stopPropagation();
            const val = optEl.getAttribute('data-value');
            const text = optEl.textContent.trim();

            hiddenInput.value = val;
            activeFilterValues.condition = val;
            trigger.querySelector('span').textContent = text;

            dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optEl.classList.add('selected');

            dropdown.classList.add('hidden');
            trigger.classList.remove('active');

            applyFilters();
        };
    });
}

function closeAllDropdowns() {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.custom-select-trigger').forEach(t => t.classList.remove('active'));
}

function applyFilters() {
    const brandVal = activeFilterValues.brand.trim().toLowerCase();
    const modelVal = activeFilterValues.model.trim().toLowerCase();
    const yearVal = activeFilterValues.year.trim().toLowerCase();
    const conditionVal = activeFilterValues.condition;

    filteredCarsData = currentCarsData.filter(car => {
        const matchesBrand = !brandVal || brandVal === 'todos' || car.brand.toLowerCase().includes(brandVal);
        const matchesModel = !modelVal || modelVal === 'todos' || car.model.toLowerCase().includes(modelVal);
        const matchesYear = !yearVal || yearVal === 'todos' || String(car.year).toLowerCase() === yearVal;
        const matchesCondition = !conditionVal || car.condition === conditionVal;

        return matchesBrand && matchesModel && matchesYear && matchesCondition;
    });

    currentPage = 1;
    renderGridWithPagination();
}

function renderGridWithPagination() {
    if (!grid) return;

    if (filteredCarsData.length === 0) {
        grid.innerHTML = '';
        if (noResults) noResults.classList.remove('hidden');
        renderPaginationControls(0);
        return;
    }

    if (noResults) noResults.classList.add('hidden');

    const totalPages = Math.ceil(filteredCarsData.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedSlice = filteredCarsData.slice(startIndex, endIndex);

    grid.innerHTML = paginatedSlice.map(car => renderCarCard(car)).join('');
    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    let paginationContainer = document.getElementById('catalog-pagination');
    
    if (!paginationContainer && grid) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'catalog-pagination';
        paginationContainer.className = 'flex justify-center items-center gap-3 mt-8 pb-6 col-span-full';
        grid.parentNode.insertBefore(paginationContainer, grid.nextSibling);
    }

    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button id="prev-page-btn" ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed border border-theme px-3.5 py-1.5 rounded-xl text-xs font-bold text-muted"' : 'class="border border-theme px-3.5 py-1.5 rounded-xl text-xs font-bold text-main hover:bg-surface-hover transition-all cursor-pointer bg-surface shadow-xs"'}>
            &laquo; Anterior
        </button>
        
        <span class="text-xs font-bold text-accent px-2">
            Página ${currentPage} de ${totalPages}
        </span>
        
        <button id="next-page-btn" ${currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed border border-theme px-3.5 py-1.5 rounded-xl text-xs font-bold text-muted"' : 'class="border border-theme px-3.5 py-1.5 rounded-xl text-xs font-bold text-main hover:bg-surface-hover transition-all cursor-pointer bg-surface shadow-xs"'}>
            Siguiente &raquo;
        </button>
    `;

    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderGridWithPagination();
            window.scrollTo({ top: grid.offsetTop - 100, behavior: 'smooth' });
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderGridWithPagination();
            window.scrollTo({ top: grid.offsetTop - 100, behavior: 'smooth' });
        }
    });
}

window.openAuthModal = () => renderAuthModal();
window.openCarModal = (carId) => {
    const selectedCar = currentCarsData.find(c => c.id === carId);
    if (selectedCar) renderCarModal(selectedCar, currentBcvRate);
};

document.addEventListener('DOMContentLoaded', initApp);