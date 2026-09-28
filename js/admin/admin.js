import { supabase } from '../config/supabase.js';
import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { showConfirmModal, showPromptModal } from '../components/confirmModal.js';
import { showToast } from '../components/notifications.js';
import { showTableSkeleton, setButtonLoading } from '../components/loader.js';
import { protectAdminRoute } from '../utils/authGuard.js';
import { 
    notifyClientPaymentApproved, 
    notifyClientCreditAssigned, 
    notifyClientPaymentRejected 
} from '../services/notificationsPanel.js';

let allCars = [];
let allUsers = [];
let catalogOptions = [];
let currentAdminUser = null;
let currentAdminEmpresaId = null;
let currentVehiclePlans = [];

// Estado de paginación
let currentCarsPage = 1;
const CARS_PER_PAGE = 5;
let currentUsersPage = 1;
const USERS_PER_PAGE = 6;

const adminFinancingPages = {};
const adminPaymentsCache = {}; 

// Variables para imágenes comprimidas y galería
let pendingMainImageBlob = null;
let pendingGalleryBlobs = [];
let existingGalleryUrls = [];

const URL_REGEX = /^https?:\/\/.+/i;
const YEAR_REGEX = /^(19[0-9]{2}|20[0-2][0-9]|2030)$/;
const PRICE_REGEX = /^[1-9]\d*(\.\d{1,2})?$/;

let brandValidation = false;
let modelValidation = false;
let yearValidation = false;
let priceValidation = false;
let imageValidation = false;

/**
 * Comprime una imagen y la convierte directamente a un objeto Blob
 */
function compressImageToBlob(file, maxWidth = 900, maxHeight = 900, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Error al generar el archivo comprimido.'));
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Sube un Blob de imagen al Storage de Supabase y retorna la URL pública
 */
async function uploadCarImageToStorage(imageBlob) {
    const fileName = `car_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const filePath = `cars/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('vehiculos')
        .upload(filePath, imageBlob, {
            contentType: 'image/jpeg',
            upsert: true
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
        .from('vehiculos')
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

document.addEventListener('DOMContentLoaded', async () => {
    await protectAdminRoute();

    const { data: { user } } = await supabase.auth.getUser();
    currentAdminUser = user || null;

    if (currentAdminUser) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('empresa_id')
            .eq('id', currentAdminUser.id)
            .single();
            
        currentAdminEmpresaId = profile?.empresa_id || null;
    }

    renderNav(user);
    renderFooter();

    setupStaticCustomSelects();
    setupEventListeners();
    setupCarFormValidationListeners();
    setupGlobalModalCloseEvents();
    
    await Promise.all([
        loadMasterOptions(),
        loadInventory()
    ]);

    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');
    const targetPayId = urlParams.get('payId');

    if (targetUserId && targetPayId) {
        window.history.replaceState({}, document.title, window.location.pathname);

        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', targetUserId)
            .single();

        const clientName = profile?.first_name 
            ? `${profile.first_name} ${profile.last_name || ''}`.trim() 
            : (profile?.email || 'Cliente');

        await window.openManageUserFinancing(targetUserId, clientName);

        setTimeout(() => {
            const targetElement = document.getElementById(`admin-pay-card-${targetPayId}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.classList.add('ring-2', 'ring-amber-400', 'border-amber-400', 'shadow-lg');
                setTimeout(() => {
                    targetElement.classList.remove('ring-2', 'ring-amber-400', 'border-amber-400', 'shadow-lg', 'shadow-amber-500/20');
                }, 4000);
            }
        }, 600);
    }
});

function setupGlobalModalCloseEvents() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeActiveModal();
    });

    document.addEventListener('click', (e) => {
        const activeModals = [
            document.getElementById('car-modal'),
            document.getElementById('users-modal'),
            document.getElementById('options-modal'),
            document.getElementById('admin-financing-modal')
        ];

        activeModals.forEach(modal => {
            if (modal && !modal.classList.contains('hidden') && e.target === modal) {
                if (modal.id === 'admin-financing-modal') {
                    modal.remove();
                    document.body.classList.remove('modal-open');
                } else {
                    modal.classList.add('hidden');
                    document.body.classList.remove('modal-open');
                }
            }
        });
    });
}

function closeActiveModal() {
    const financingModal = document.getElementById('admin-financing-modal');
    if (financingModal) {
        financingModal.remove();
        document.body.classList.remove('modal-open');
        return;
    }

    ['car-modal', 'users-modal', 'options-modal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
    });
}

function validateField(inputElement, isValid, errorSpanId) {
    const errorSpan = errorSpanId ? document.getElementById(errorSpanId) : null;

    if (isValid) {
        inputElement?.classList.add('border-emerald-500');
        inputElement?.classList.remove('border-red-500');
        if (errorSpan) errorSpan.classList.add('hidden');
    } else {
        inputElement?.classList.add('border-red-500');
        inputElement?.classList.remove('border-emerald-500');
        if (errorSpan) errorSpan.classList.remove('hidden');
    }

    checkCarFormGlobalValidity();
}

function checkCarFormGlobalValidity() {
    const submitBtn = document.getElementById('submit-car-form-btn');
    const isFormValid = brandValidation && modelValidation && yearValidation && priceValidation && imageValidation;
    
    if (submitBtn) {
        submitBtn.disabled = !isFormValid;
        if (!isFormValid) {
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

function setupCarFormValidationListeners() {
    const brandInput = document.getElementById('form-brand');
    const modelInput = document.getElementById('form-model');
    const yearInput = document.getElementById('form-year');
    const priceInput = document.getElementById('form-price');
    const imageInput = document.getElementById('form-image-url');
    const imageFileInput = document.getElementById('form-image-file');
    const galleryFileInput = document.getElementById('form-gallery-files');
    const imagePreview = document.getElementById('form-image-preview');
    const imageFileInfo = document.getElementById('image-file-info');

    brandInput?.addEventListener('input', (e) => {
        brandValidation = e.target.value.trim().length >= 2;
        validateField(e.target, brandValidation, 'error-form-brand');
    });

    modelInput?.addEventListener('input', (e) => {
        modelValidation = e.target.value.trim().length >= 1;
        validateField(e.target, modelValidation, 'error-form-model');
    });

    yearInput?.addEventListener('input', (e) => {
        yearValidation = YEAR_REGEX.test(e.target.value.trim());
        validateField(e.target, yearValidation, 'error-form-year');
    });

    priceInput?.addEventListener('input', (e) => {
        priceValidation = PRICE_REGEX.test(e.target.value.trim());
        validateField(e.target, priceValidation, 'error-form-price');
    });

    imageInput?.addEventListener('input', (e) => {
        const urlVal = e.target.value.trim();
        pendingMainImageBlob = null;
        imageValidation = URL_REGEX.test(urlVal);

        if (imageValidation && imagePreview) {
            imagePreview.src = urlVal;
            imagePreview.classList.remove('hidden');
        } else if (!urlVal && imagePreview) {
            imagePreview.src = '';
            imagePreview.classList.add('hidden');
        }

        validateField(e.target, imageValidation, 'error-form-image');
    });

    imageFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (imageFileInfo) imageFileInfo.textContent = 'Optimizando foto...';
            pendingMainImageBlob = await compressImageToBlob(file, 900, 900, 0.75);
            
            const previewUrl = URL.createObjectURL(pendingMainImageBlob);
            if (imagePreview) {
                imagePreview.src = previewUrl;
                imagePreview.classList.remove('hidden');
            }

            if (imageInput) imageInput.value = '';
            imageValidation = true;
            validateField(imageInput, true, 'error-form-image');
            if (imageFileInfo) imageFileInfo.textContent = '¡Foto principal lista!';
        } catch (err) {
            console.error("Error al procesar la foto:", err);
            showToast('Error al procesar la foto principal.', 'error');
            if (imageFileInfo) imageFileInfo.textContent = 'Error al cargar imagen.';
        }
    });

    galleryFileInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            showToast(`Optimizando ${files.length} fotos para la galería...`, 'info');
            pendingGalleryBlobs = [];

            for (const file of files) {
                const blob = await compressImageToBlob(file, 900, 900, 0.75);
                pendingGalleryBlobs.push(blob);
            }

            renderGalleryPreviews();
            showToast('Fotos de galería listas.', 'success');
        } catch (err) {
            console.error("Error al procesar la galería:", err);
            showToast('Error al procesar fotos adicionales.', 'error');
        }
    });
}

function renderGalleryPreviews() {
    const container = document.getElementById('gallery-previews-container');
    if (!container) return;

    let html = '';

    existingGalleryUrls.forEach((url, idx) => {
        html += `
            <div class="relative group">
                <img src="${url}" class="w-10 h-10 rounded-lg object-cover border border-theme">
                <button type="button" onclick="window.removeExistingGalleryPhoto(${idx})" class="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold cursor-pointer shadow-md">&times;</button>
            </div>
        `;
    });

    pendingGalleryBlobs.forEach((blob) => {
        const tempUrl = URL.createObjectURL(blob);
        html += `
            <div class="relative group">
                <img src="${tempUrl}" class="w-10 h-10 rounded-lg object-cover border-2 border-[var(--accent)]">
            </div>
        `;
    });

    if (html) {
        container.innerHTML = html;
        container.classList.remove('hidden');
    } else {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
}

window.removeExistingGalleryPhoto = (idx) => {
    existingGalleryUrls.splice(idx, 1);
    renderGalleryPreviews();
};

function triggerAllCarFormValidations() {
    const brandInput = document.getElementById('form-brand');
    const modelInput = document.getElementById('form-model');
    const yearInput = document.getElementById('form-year');
    const priceInput = document.getElementById('form-price');
    const imageInput = document.getElementById('form-image-url');

    brandValidation = (brandInput?.value || '').trim().length >= 2;
    validateField(brandInput, brandValidation, 'error-form-brand');

    modelValidation = (modelInput?.value || '').trim().length >= 1;
    validateField(modelInput, modelValidation, 'error-form-model');

    yearValidation = YEAR_REGEX.test((yearInput?.value || '').trim());
    validateField(yearInput, yearValidation, 'error-form-year');

    priceValidation = PRICE_REGEX.test((priceInput?.value || '').trim());
    validateField(priceInput, priceValidation, 'error-form-price');

    imageValidation = pendingMainImageBlob !== null || URL_REGEX.test((imageInput?.value || '').trim());
    validateField(imageInput, imageValidation, 'error-form-image');
}

function initEditableAutocomplete(inputId, dropdownId, optionType, labelName, infoSpanId = null, onSelectCallback = null) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const infoSpan = infoSpanId ? document.getElementById(infoSpanId) : null;
    if (!input || !dropdown) return;

    const checkNewValueAlert = () => {
        if (!infoSpan) return;
        const query = input.value.trim();
        if (!query) {
            infoSpan.classList.add('hidden');
            return;
        }

        const exists = catalogOptions.some(o => o.type === optionType && o.value.toLowerCase() === query.toLowerCase());
        if (!exists) {
            infoSpan.classList.remove('hidden');
        } else {
            infoSpan.classList.add('hidden');
        }
    };

    const renderDropdown = () => {
        const query = input.value.trim().toLowerCase();

        const dbItems = catalogOptions
            .filter(o => o.type === optionType)
            .map(o => o.value);

        const matches = query ? dbItems.filter(item => item.toLowerCase().includes(query)) : dbItems;

        dropdown.innerHTML = '';

        if (matches.length > 0) {
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = `custom-select-option ${input.value === item ? 'selected' : ''}`;
                div.textContent = item;

                div.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = item;
                    dropdown.classList.add('hidden');
                    checkNewValueAlert();
                    
                    if (inputId === 'form-brand') {
                        brandValidation = true;
                        validateField(input, true, 'error-form-brand');
                    } else if (inputId === 'form-model') {
                        modelValidation = true;
                        validateField(input, true, 'error-form-model');
                    }

                    if (onSelectCallback) onSelectCallback(item);
                };
                dropdown.appendChild(div);
            });
        } else {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'custom-select-option text-muted italic cursor-default';
            emptyDiv.textContent = 'Sin coincidencias maestras...';
            dropdown.appendChild(emptyDiv);
        }

        const createBtn = document.createElement('div');
        createBtn.className = 'custom-select-option create-btn';
        createBtn.textContent = `+ ${labelName}...`;
        createBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.add('hidden');
            document.getElementById('car-modal')?.classList.add('hidden');
            document.getElementById('options-modal')?.classList.remove('hidden');

            const optionTypeSelect = document.getElementById('new-option-type');
            if (optionTypeSelect) {
                setCustomSelectValue('new-option-type', optionType);
                updateMasterModalDatalist();
            }
        };
        dropdown.appendChild(createBtn);

        closeAllDropdowns();
        dropdown.classList.remove('hidden');
    };

    input.onclick = (e) => { e.stopPropagation(); renderDropdown(); checkNewValueAlert(); };
    input.onfocus = (e) => { e.stopPropagation(); renderDropdown(); checkNewValueAlert(); };
    input.oninput = () => { renderDropdown(); checkNewValueAlert(); };
}

function initCustomSelect(fieldId, optionsArray = [], onChangeCallback = null) {
    const hiddenInput = document.getElementById(fieldId);
    const trigger = document.getElementById(`trigger-${fieldId}`);
    const dropdown = document.getElementById(`dropdown-${fieldId}`);

    if (!hiddenInput || !trigger || !dropdown) return;

    if (optionsArray.length > 0) {
        dropdown.innerHTML = optionsArray.map(opt => `
            <div class="custom-select-option ${hiddenInput.value === opt ? 'selected' : ''}" data-value="${opt}">
                ${opt}
            </div>
        `).join('');

        if (!hiddenInput.value && optionsArray[0]) {
            hiddenInput.value = optionsArray[0];
            trigger.querySelector('span').textContent = optionsArray[0];
        }
    }

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
            trigger.querySelector('span').textContent = text;

            dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optEl.classList.add('selected');

            dropdown.classList.add('hidden');
            trigger.classList.remove('active');

            if (onChangeCallback) onChangeCallback(val);
        };
    });
}

function setCustomSelectValue(fieldId, value) {
    const hiddenInput = document.getElementById(fieldId);
    const trigger = document.getElementById(`trigger-${fieldId}`);
    const dropdown = document.getElementById(`dropdown-${fieldId}`);

    if (!hiddenInput) return;

    hiddenInput.value = value;

    if (trigger && dropdown) {
        trigger.querySelector('span').textContent = value || 'Seleccionar...';
        dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
            if (optEl.getAttribute('data-value') === value) {
                optEl.classList.add('selected');
            } else {
                optEl.classList.remove('selected');
            }
        });
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.custom-select-trigger').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[id^="role-cell-"]').forEach(c => {
        c.style.zIndex = 'auto';
        if (c.parentElement) c.parentElement.style.zIndex = 'auto';
    });
}

document.addEventListener('click', closeAllDropdowns);

function renderVehiclePlansForm() {
    const container = document.getElementById('plans-list-container');
    if (!container) return;

    if (currentVehiclePlans.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-muted italic py-1 text-center">No hay planes agregados. Haz clic en "+ Añadir Plan".</p>`;
        return;
    }

    container.innerHTML = currentVehiclePlans.map((plan, index) => `
        <div class="flex items-center gap-2 bg-surface p-2 rounded-lg border border-theme relative overflow-visible">
            <div class="w-1/3">
                <input type="number" min="1" max="120" id="plan-count-input-${index}" value="${plan.count}" placeholder="Cuotas" class="w-full px-2 py-1 rounded-md bg-surface-hover border border-theme text-main text-xs focus:outline-none focus:border-[var(--accent)]">
            </div>
            <div class="w-1/2 custom-select-wrapper">
                <input type="text" id="plan-freq-input-${index}" value="${plan.frequency}" placeholder="mensual" autocomplete="off" class="w-full px-2 py-1 rounded-md bg-surface-hover border border-theme text-main text-xs focus:outline-none focus:border-[var(--accent)]">
                <div class="custom-select-dropdown hidden" id="dropdown-plan-freq-${index}"></div>
            </div>
            <button type="button" onclick="window.removeVehiclePlan(${index})" class="px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer">
                &times;
            </button>
        </div>
    `).join('');

    currentVehiclePlans.forEach((_, index) => {
        const countInp = document.getElementById(`plan-count-input-${index}`);
        const freqInp = document.getElementById(`plan-freq-input-${index}`);

        if (countInp) {
            countInp.oninput = (e) => {
                currentVehiclePlans[index].count = Number(e.target.value) || 1;
            };
        }

        if (freqInp) {
            freqInp.oninput = (e) => {
                currentVehiclePlans[index].frequency = e.target.value.trim().toLowerCase();
            };

            initEditableAutocomplete(
                `plan-freq-input-${index}`,
                `dropdown-plan-freq-${index}`,
                'frequency',
                'Frecuencia',
                null,
                (selectedVal) => {
                    currentVehiclePlans[index].frequency = selectedVal.trim().toLowerCase();
                }
            );
        }
    });
}

window.removeVehiclePlan = (index) => {
    currentVehiclePlans.splice(index, 1);
    renderVehiclePlansForm();
};

function setupStaticCustomSelects() {
    initCustomSelect('form-condition');
    initCustomSelect('form-payment-type', [], (val) => {
        const plansSection = document.getElementById('financing-plans-section');
        if (val === 'cuotas') {
            plansSection?.classList.remove('hidden');
            if (currentVehiclePlans.length === 0) {
                currentVehiclePlans = [{ count: 12, frequency: 'mensual' }];
            }
            renderVehiclePlansForm();
        } else {
            plansSection?.classList.add('hidden');
        }
    });

    initCustomSelect('new-option-type', [], () => {
        updateMasterModalDatalist();
    });
}

async function loadMasterOptions() {
    const { data, error } = await supabase
        .from('catalog_options')
        .select('*')
        .order('value', { ascending: true });

    if (!error && data) {
        catalogOptions = data;
        setupCustomAutocompletes();
    }
}

function setupCustomAutocompletes() {
    initEditableAutocomplete('form-brand', 'dropdown-form-brand', 'brand', 'Marca', 'info-brand-new');
    initEditableAutocomplete('form-model', 'dropdown-form-model', 'model', 'Modelo', 'info-model-new');

    updateMasterModalDatalist();
}

function updateMasterModalDatalist() {
    const selectedType = document.getElementById('new-option-type')?.value || 'brand';
    const inputVal = document.getElementById('new-option-value');

    if (inputVal) {
        const placeholders = {
            brand: 'Nombre (ej. Mazda)',
            model: 'Nombre (ej. Corolla)',
            frequency: 'Nombre (ej. trimestral)'
        };
        inputVal.placeholder = placeholders[selectedType] || 'Nombre...';
    }

    renderOptionsTable();
}

async function loadInventory() {
    const tbody = document.getElementById('admin-cars-table-body');
    if (!tbody) return;

    showTableSkeleton('admin-cars-table-body', 5, 4);

    const { data: cars, error } = await supabase
        .from('cars')
        .select('*, car_financing_plans(*)')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 font-semibold">Error al conectar con la base de datos.</td></tr>`;
        return;
    }

    allCars = cars || [];

    if (allCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-muted">No hay vehículos registrados en el inventario.</td></tr>`;
        renderCarsPaginationControls(0);
        return;
    }

    renderPaginatedCars();
}

function renderPaginatedCars() {
    const tbody = document.getElementById('admin-cars-table-body');
    if (!tbody) return;

    const totalPages = Math.ceil(allCars.length / CARS_PER_PAGE);
    if (currentCarsPage > totalPages) currentCarsPage = totalPages;
    if (currentCarsPage < 1) currentCarsPage = 1;

    const startIndex = (currentCarsPage - 1) * CARS_PER_PAGE;
    const paginatedCars = allCars.slice(startIndex, startIndex + CARS_PER_PAGE);

    tbody.innerHTML = paginatedCars.map(car => {
        const plansList = car.car_financing_plans || [];
        const galleryCount = (car.gallery_urls || []).length;

        return `
            <tr class="hover:bg-surface-hover transition-colors">
                <td class="p-3 text-left whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        <img src="${car.image_url}" alt="${car.brand}" class="w-10 h-10 rounded-lg object-cover border border-theme flex-shrink-0">
                        <div>
                            <strong class="text-main block font-bold text-xs sm:text-sm">${car.brand} ${car.model}</strong>
                            <span class="text-[9px] text-accent font-semibold">${galleryCount} foto(s) de galería</span>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-center text-muted text-xs whitespace-nowrap">
                    <span class="text-main font-bold">${car.year}</span> &middot; ${car.condition || 'Usado'}
                </td>
                <td class="p-3 text-center font-extrabold text-main text-xs whitespace-nowrap">
                    $${Number(car.price_usd).toLocaleString('en-US')}
                </td>
                <td class="p-3 text-center text-xs whitespace-nowrap">
                    ${car.payment_type === 'cuotas' ? `
                        <span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-accent font-bold inline-block text-[11px]">
                            ${plansList.length} Plan(es) de Cuotas
                        </span>
                    ` : `
                        <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold inline-block text-[11px]">
                            Pago Único
                        </span>
                    `}
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="window.editCar('${car.id}')" class="px-2.5 py-1 text-xs font-bold rounded-lg border border-theme text-main hover:bg-[var(--border-color)] transition-all cursor-pointer">
                            Editar
                        </button>
                        <button onclick="window.deleteCar('${car.id}')" class="px-2.5 py-1 text-xs font-bold rounded-lg text-main bg-[var(--bg-main)] hover:bg-[var(--accent-hover)] border-1 border-[var(--accent)] text-[var(--text-main)] transition-all cursor-pointer">
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderCarsPaginationControls(totalPages);
}

function renderCarsPaginationControls(totalPages) {
    let container = document.getElementById('cars-pagination-container');
    const tableEl = document.getElementById('admin-cars-table-body')?.closest('table');

    if (!container && tableEl) {
        container = document.createElement('div');
        container.id = 'cars-pagination-container';
        container.className = 'flex items-center justify-between pt-3 mt-2 border-t border-theme text-xs';
        tableEl.parentNode.appendChild(container);
    }

    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = `<span class="text-[11px] text-muted font-semibold">Total: ${allCars.length} vehículo(s)</span>`;
        return;
    }

    const startIndex = (currentCarsPage - 1) * CARS_PER_PAGE;
    const endIndex = Math.min(startIndex + CARS_PER_PAGE, allCars.length);

    container.innerHTML = `
        <span class="text-muted font-semibold text-[11px]">Mostrando ${startIndex + 1}-${endIndex} de ${allCars.length} vehículos</span>
        <div class="flex items-center gap-2">
            <button id="cars-prev-page" ${currentCarsPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg border border-theme text-muted"' : 'class="px-2.5 py-1 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer"'}>
                &laquo; Anterior
            </button>
            <span class="font-bold text-accent px-1 text-xs">${currentCarsPage} / ${totalPages}</span>
            <button id="cars-next-page" ${currentCarsPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg border border-theme text-muted"' : 'class="px-2.5 py-1 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer"'}>
                Siguiente &raquo;
            </button>
        </div>
    `;

    document.getElementById('cars-prev-page')?.addEventListener('click', () => {
        if (currentCarsPage > 1) {
            currentCarsPage--;
            renderPaginatedCars();
        }
    });

    document.getElementById('cars-next-page')?.addEventListener('click', () => {
        if (currentCarsPage < totalPages) {
            currentCarsPage++;
            renderPaginatedCars();
        }
    });
}

async function renderOptionsTable() {
    const tbody = document.getElementById('admin-options-table-body');
    const selectedType = document.getElementById('new-option-type')?.value || 'brand';
    if (!tbody) return;

    const filteredOptions = catalogOptions.filter(opt => opt.type === selectedType);

    if (filteredOptions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-muted">No hay elementos registrados en este tipo.</td></tr>`;
        return;
    }

    const typeLabels = { brand: 'Marca', model: 'Modelo', frequency: 'Frecuencia' };

    tbody.innerHTML = filteredOptions.map(opt => `
        <tr class="hover:bg-surface-hover transition-colors">
            <td class="p-2.5 font-bold text-accent text-xs">${typeLabels[opt.type] || opt.type}</td>
            <td class="p-2.5 text-main font-semibold text-xs">${opt.value}</td>
            <td class="p-2.5 text-right">
                <button onclick="window.deleteOption('${opt.id}')" class="px-2.5 py-1 text-xs font-bold rounded-lg border border-theme text-main hover:bg-[var(--border-color)] transition-all cursor-pointer">
                    Eliminar
                </button>
            </td>
        </tr>
    `).join('');
}

async function autoCreateMissingMasterOptions(brandVal, modelVal, plansArr) {
    const newOptionsToInsert = [];

    if (brandVal && !catalogOptions.some(o => o.type === 'brand' && o.value.toLowerCase() === brandVal.toLowerCase())) {
        newOptionsToInsert.push({ type: 'brand', value: brandVal, empresa_id: currentAdminEmpresaId });
    }

    if (modelVal && !catalogOptions.some(o => o.type === 'model' && o.value.toLowerCase() === modelVal.toLowerCase())) {
        newOptionsToInsert.push({ type: 'model', value: modelVal, empresa_id: currentAdminEmpresaId });
    }

    plansArr.forEach(p => {
        if (p.frequency && !catalogOptions.some(o => o.type === 'frequency' && o.value.toLowerCase() === p.frequency.toLowerCase())) {
            newOptionsToInsert.push({ type: 'frequency', value: p.frequency, empresa_id: currentAdminEmpresaId });
        }
    });

    if (newOptionsToInsert.length > 0) {
        await supabase.from('catalog_options').insert(newOptionsToInsert);
        await loadMasterOptions();
    }
}

function setupEventListeners() {
    const carModal = document.getElementById('car-modal');
    const usersModal = document.getElementById('users-modal');
    const optionsModal = document.getElementById('options-modal');
    const form = document.getElementById('car-form');
    const addOptionForm = document.getElementById('add-option-form');

    document.getElementById('add-plan-btn')?.addEventListener('click', () => {
        currentVehiclePlans.push({ count: 12, frequency: 'mensual' });
        renderVehiclePlansForm();
    });

    document.getElementById('open-create-modal-btn')?.addEventListener('click', () => {
        form.reset();
        document.getElementById('car-id').value = '';
        document.getElementById('modal-title').textContent = 'Agregar Nuevo Vehículo';

        document.getElementById('form-brand').value = '';
        document.getElementById('form-model').value = '';
        document.getElementById('form-year').value = '';
        document.getElementById('form-price').value = '';
        document.getElementById('form-image-url').value = '';
        document.getElementById('form-image-file').value = '';
        const galleryFilesInput = document.getElementById('form-gallery-files');
        if (galleryFilesInput) galleryFilesInput.value = '';
        document.getElementById('form-description').value = '';
        
        pendingMainImageBlob = null;
        pendingGalleryBlobs = [];
        existingGalleryUrls = [];

        renderGalleryPreviews();

        const imagePreview = document.getElementById('form-image-preview');
        if (imagePreview) { imagePreview.src = ''; imagePreview.classList.add('hidden'); }
        const imageFileInfo = document.getElementById('image-file-info');
        if (imageFileInfo) imageFileInfo.textContent = 'Sube la foto de portada.';

        document.getElementById('info-brand-new')?.classList.add('hidden');
        document.getElementById('info-model-new')?.classList.add('hidden');

        currentVehiclePlans = [];
        setCustomSelectValue('form-condition', 'Usado');
        setCustomSelectValue('form-payment-type', 'unico');
        document.getElementById('financing-plans-section')?.classList.add('hidden');

        triggerAllCarFormValidations();

        carModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    });

    const closeCarModal = () => {
        carModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    };
    document.getElementById('close-modal-btn')?.addEventListener('click', closeCarModal);
    document.getElementById('cancel-modal-btn')?.addEventListener('click', closeCarModal);

    document.getElementById('open-options-modal-btn')?.addEventListener('click', async () => {
        optionsModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        updateMasterModalDatalist();
    });

    const closeOptionsModal = () => {
        optionsModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    };
    document.getElementById('close-options-modal-btn')?.addEventListener('click', closeOptionsModal);
    document.getElementById('done-options-modal-btn')?.addEventListener('click', closeOptionsModal);

    document.getElementById('open-users-modal-btn')?.addEventListener('click', async () => {
        usersModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        currentUsersPage = 1;
        await loadUsers();
    });

    const closeUsersModal = () => {
        usersModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    };
    document.getElementById('close-users-modal-btn')?.addEventListener('click', closeUsersModal);
    document.getElementById('done-users-modal-btn')?.addEventListener('click', closeUsersModal);

    addOptionForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('new-option-type').value;
        const value = document.getElementById('new-option-value').value.trim();

        if (!value) return;

        const { error } = await supabase.from('catalog_options').insert([{ 
            type, 
            value,
            empresa_id: currentAdminEmpresaId 
        }]);

        if (error) {
            await showConfirmModal({
                title: 'Error al agregar opción',
                message: error.message,
                confirmText: 'Entendido',
                cancelText: null,
                type: 'danger'
            });
        } else {
            document.getElementById('new-option-value').value = '';
            await loadMasterOptions();
        }
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        triggerAllCarFormValidations();
        if (!brandValidation || !modelValidation || !yearValidation || !priceValidation || !imageValidation) {
            showToast('Por favor completa todos los campos requeridos adecuadamente.', 'error');
            return;
        }

        setButtonLoading('submit-car-form-btn', true);

        try {
            const id = document.getElementById('car-id').value;
            const paymentType = document.getElementById('form-payment-type').value;
            const brandVal = document.getElementById('form-brand').value.trim();
            const modelVal = document.getElementById('form-model').value.trim();

            let finalMainImageUrl = document.getElementById('form-image-url').value.trim();

            // 1. Subir portada si existe un archivo seleccionado
            if (pendingMainImageBlob) {
                try {
                    finalMainImageUrl = await uploadCarImageToStorage(pendingMainImageBlob);
                } catch (uploadError) {
                    console.error("Error al subir portada a Storage:", uploadError);
                    showToast('Error al subir la imagen principal a Supabase Storage.', 'error');
                    setButtonLoading('submit-car-form-btn', false, 'Guardar');
                    return;
                }
            }

            // 2. Subir imágenes secundarias de galería a Storage
            const uploadedGalleryUrls = [];
            for (const blob of pendingGalleryBlobs) {
                try {
                    const url = await uploadCarImageToStorage(blob);
                    uploadedGalleryUrls.push(url);
                } catch (err) {
                    console.error("Error subiendo foto de galería:", err);
                }
            }

            const finalGalleryUrls = [...existingGalleryUrls, ...uploadedGalleryUrls];

            await autoCreateMissingMasterOptions(brandVal, modelVal, paymentType === 'cuotas' ? currentVehiclePlans : []);

            const carPayload = {
                brand: brandVal,
                model: modelVal,
                year: Number(document.getElementById('form-year').value),
                condition: document.getElementById('form-condition').value,
                price_usd: Number(document.getElementById('form-price').value),
                payment_type: paymentType,
                image_url: finalMainImageUrl,
                gallery_urls: finalGalleryUrls,
                description: document.getElementById('form-description').value.trim(),
                empresa_id: currentAdminEmpresaId
            };

            let savedCarId = id;

            if (id) {
                const { error } = await supabase.from('cars').update(carPayload).eq('id', id);
                if (error) {
                    await showConfirmModal({
                        title: 'Error al actualizar vehículo',
                        message: error.message,
                        confirmText: 'Entendido',
                        cancelText: null,
                        type: 'danger'
                    });
                    return;
                }
            } else {
                const { data, error } = await supabase.from('cars').insert([carPayload]).select();
                if (error) {
                    await showConfirmModal({
                        title: 'Error al crear vehículo',
                        message: error.message,
                        confirmText: 'Entendido',
                        cancelText: null,
                        type: 'danger'
                    });
                    return;
                }
                if (data && data[0]) savedCarId = data[0].id;
            }

            if (savedCarId) {
                await supabase.from('car_financing_plans').delete().eq('car_id', savedCarId);

                if (paymentType === 'cuotas' && currentVehiclePlans.length > 0) {
                    const plansToInsert = currentVehiclePlans.map(p => ({
                        car_id: savedCarId,
                        installments_count: p.count,
                        frequency: p.frequency,
                        empresa_id: currentAdminEmpresaId
                    }));
                    await supabase.from('car_financing_plans').insert(plansToInsert);
                }
            }

            pendingMainImageBlob = null;
            pendingGalleryBlobs = [];
            existingGalleryUrls = [];
            closeCarModal();
            await loadInventory();
            showToast('Vehículo guardado correctamente', 'success');
        } finally {
            setButtonLoading('submit-car-form-btn', false, 'Guardar');
        }
    });
}

window.deleteOption = async (optionId) => {
    const confirmed = await showConfirmModal({
        title: '¿Eliminar opción maestra?',
        message: 'Esta opción ya no aparecerá sugerida en los desplegables de creación ni filtros.',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
    });

    if (confirmed) {
        const { error } = await supabase.from('catalog_options').delete().eq('id', optionId);
        if (error) {
            await showConfirmModal({
                title: 'Error al eliminar',
                message: error.message,
                confirmText: 'Entendido',
                cancelText: null,
                type: 'danger'
            });
        } else {
            await loadMasterOptions();
        }
    }
};

window.editCar = (id) => {
    const car = allCars.find(c => String(c.id) === String(id));
    if (!car) return;

    pendingMainImageBlob = null;
    pendingGalleryBlobs = [];
    existingGalleryUrls = car.gallery_urls || [];

    document.getElementById('car-id').value = car.id;
    document.getElementById('form-brand').value = car.brand || '';
    document.getElementById('form-model').value = car.model || '';
    document.getElementById('form-year').value = car.year || new Date().getFullYear();
    setCustomSelectValue('form-condition', car.condition || 'Usado');
    document.getElementById('form-price').value = car.price_usd || 0;
    
    document.getElementById('form-image-url').value = car.image_url || '';
    document.getElementById('form-image-file').value = '';
    const galleryFilesInput = document.getElementById('form-gallery-files');
    if (galleryFilesInput) galleryFilesInput.value = '';

    const imagePreview = document.getElementById('form-image-preview');
    if (imagePreview && car.image_url) {
        imagePreview.src = car.image_url;
        imagePreview.classList.remove('hidden');
    }
    const imageFileInfo = document.getElementById('image-file-info');
    if (imageFileInfo) imageFileInfo.textContent = 'Foto principal cargada.';

    renderGalleryPreviews();

    document.getElementById('form-description').value = car.description || '';

    const pType = car.payment_type || 'unico';
    setCustomSelectValue('form-payment-type', pType);

    if (pType === 'cuotas' && car.car_financing_plans && car.car_financing_plans.length > 0) {
        currentVehiclePlans = car.car_financing_plans.map(p => ({
            count: p.installments_count,
            frequency: p.frequency
        }));
    } else {
        currentVehiclePlans = [];
    }

    const plansSection = document.getElementById('financing-plans-section');
    if (pType === 'cuotas') {
        plansSection?.classList.remove('hidden');
        renderVehiclePlansForm();
    } else {
        plansSection?.classList.add('hidden');
    }

    document.getElementById('info-brand-new')?.classList.add('hidden');
    document.getElementById('info-model-new')?.classList.add('hidden');

    triggerAllCarFormValidations();

    document.getElementById('modal-title').textContent = 'Editar Vehículo';
    document.getElementById('car-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
};

window.deleteCar = async (id) => {
    const car = allCars.find(c => String(c.id) === String(id));
    const carName = car ? `${car.brand} ${car.model}` : 'este vehículo';

    const confirmed = await showConfirmModal({
        title: `¿Eliminar ${carName}?`,
        message: 'Se borrarán el vehículo y todos sus planes de financiamiento asociados del catálogo.',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
    });

    if (confirmed) {
        const { error } = await supabase.from('cars').delete().eq('id', id);
        if (error) {
            await showConfirmModal({
                title: 'Error al eliminar',
                message: error.message,
                confirmText: 'Entendido',
                cancelText: null,
                type: 'danger'
            });
        } else {
            await loadInventory();
        }
    }
};

async function loadUsers() {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    showTableSkeleton('admin-users-table-body', 3, 3);

    const tableContainer = tbody.closest('.overflow-hidden, .overflow-y-auto, .overflow-x-auto');
    if (tableContainer) {
        tableContainer.classList.remove('overflow-hidden', 'overflow-y-auto', 'overflow-x-auto');
        tableContainer.classList.add('overflow-visible');
    }

    const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error al obtener usuarios.</td></tr>`;
        return;
    }

    allUsers = users || [];

    if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-muted">No se encontraron perfiles.</td></tr>`;
        renderUsersPaginationControls(0);
        return;
    }

    renderPaginatedUsers();
}

function renderPaginatedUsers() {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
    if (currentUsersPage > totalPages) currentUsersPage = totalPages;
    if (currentUsersPage < 1) currentUsersPage = 1;

    const startIndex = (currentUsersPage - 1) * USERS_PER_PAGE;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
    const pageTotal = paginatedUsers.length;

    tbody.innerHTML = paginatedUsers.map((u, index) => {
        const userDisplay = u.email || u.username || u.full_name || `Usuario (${u.id.slice(0, 8)}...)`;
        const isCurrent = currentAdminUser && u.id === currentAdminUser.id;
        
        const currentRole = (u.role || 'client').toLowerCase();
        const roleLabel = currentRole === 'admin' ? 'Admin' : 'Cliente';

        const openUpward = index > 0 && index === pageTotal - 1;
        const dropdownPositionClass = openUpward ? 'bottom-full mb-1' : 'top-full mt-1';

        return `
            <tr class="hover:bg-surface-hover transition-colors relative">
                <td class="p-2 sm:p-2.5 text-left max-w-[120px] sm:max-w-none truncate">
                    <span class="text-main font-semibold block text-xs truncate" title="${userDisplay}">${userDisplay}</span>
                    <span class="text-[9px] text-muted block">${u.id.slice(0, 10)}...</span>
                </td>
                <td class="p-2 sm:p-2.5 text-center relative" id="role-cell-${u.id}">
                    ${isCurrent ? `
                        <span class="px-2 py-1 rounded-lg bg-surface border border-theme text-muted font-bold text-[11px] inline-block opacity-60">
                            ${roleLabel}
                        </span>
                    ` : `
                        <div class="custom-select-wrapper inline-block w-24 sm:w-28 text-left relative">
                            <div class="custom-select-trigger px-2 py-1 text-[11px] font-bold rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main flex items-center justify-between cursor-pointer" id="trigger-role-${u.id}">
                                <span>${roleLabel}</span>
                                <svg class="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                            <div class="custom-select-dropdown hidden absolute left-0 right-0 ${dropdownPositionClass} bg-surface border border-theme rounded-xl shadow-2xl z-50 py-1" id="dropdown-role-${u.id}">
                                <div class="custom-select-option px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors ${currentRole === 'client' ? 'text-accent font-extrabold' : 'text-main'}" data-value="client">
                                    Cliente
                                </div>
                                <div class="custom-select-option px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors ${currentRole === 'admin' ? 'text-accent font-extrabold' : 'text-main'}" data-value="admin">
                                    Admin
                                </div>
                            </div>
                        </div>
                    `}
                </td>
                <td class="p-2 sm:p-2.5 text-right">
                    <div class="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1">
                        <button onclick="window.openManageUserFinancing('${u.id}', '${userDisplay}')" class="px-2 py-1 text-[11px] font-bold rounded-lg border border-theme text-accent hover:bg-surface transition-all cursor-pointer whitespace-nowrap">
                            Crédito
                        </button>
                        ${!isCurrent ? `
                            <button onclick="window.deleteUser('${u.id}')" class="px-2 py-1 text-[11px] font-bold rounded-lg border border-theme text-muted hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer whitespace-nowrap">
                                Eliminar
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    paginatedUsers.forEach(u => {
        const isCurrent = currentAdminUser && u.id === currentAdminUser.id;
        if (!isCurrent) {
            setupRoleDropdownHandler(u.id);
        }
    });

    renderUsersPaginationControls(totalPages);
}

function renderUsersPaginationControls(totalPages) {
    let container = document.getElementById('users-pagination-container');
    const tableEl = document.getElementById('admin-users-table-body')?.closest('table');

    if (!container && tableEl) {
        container = document.createElement('div');
        container.id = 'users-pagination-container';
        container.className = 'flex items-center justify-between pt-3 mt-2 border-t border-theme text-xs';
        tableEl.parentNode.appendChild(container);
    }

    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = `<span class="text-[11px] text-muted font-semibold">Total: ${allUsers.length} usuario(s)</span>`;
        return;
    }

    const startIndex = (currentUsersPage - 1) * USERS_PER_PAGE;
    const endIndex = Math.min(startIndex + USERS_PER_PAGE, allUsers.length);

    container.innerHTML = `
        <span class="text-muted font-semibold text-[11px]">Mostrando ${startIndex + 1}-${endIndex} de ${allUsers.length} usuarios</span>
        <div class="flex items-center gap-2">
            <button id="users-prev-page" ${currentUsersPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg border border-theme text-muted"' : 'class="px-2.5 py-1 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer"'}>
                &laquo; Anterior
            </button>
            <span class="font-bold text-accent px-1 text-xs">${currentUsersPage} / ${totalPages}</span>
            <button id="users-next-page" ${currentUsersPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg border border-theme text-muted"' : 'class="px-2.5 py-1 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer"'}>
                Siguiente &raquo;
            </button>
        </div>
    `;

    document.getElementById('users-prev-page')?.addEventListener('click', () => {
        if (currentUsersPage > 1) {
            currentUsersPage--;
            renderPaginatedUsers();
        }
    });

    document.getElementById('users-next-page')?.addEventListener('click', () => {
        if (currentUsersPage < totalPages) {
            currentUsersPage++;
            renderPaginatedUsers();
        }
    });
}

function setupRoleDropdownHandler(userId) {
    const trigger = document.getElementById(`trigger-role-${userId}`);
    const dropdown = document.getElementById(`dropdown-role-${userId}`);
    const cell = document.getElementById(`role-cell-${userId}`);
    if (!trigger || !dropdown) return;

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        closeAllDropdowns();

        if (isHidden) {
            dropdown.classList.remove('hidden');
            trigger.classList.add('active');
            if (cell) {
                cell.style.zIndex = '999';
                if (cell.parentElement) cell.parentElement.style.zIndex = '999';
            }
        }
    };

    dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
        optEl.onclick = async (e) => {
            e.stopPropagation();
            const val = optEl.getAttribute('data-value');
            dropdown.classList.add('hidden');
            trigger.classList.remove('active');
            if (cell) {
                cell.style.zIndex = 'auto';
                if (cell.parentElement) cell.parentElement.style.zIndex = 'auto';
            }

            await window.changeUserRole(userId, val);
        };
    });
}

window.changeUserRole = async (userId, selectedRole) => {
    const cleanRole = String(selectedRole).trim().toLowerCase();

    const { error } = await supabase
        .from('profiles')
        .update({ role: cleanRole })
        .eq('id', userId);

    if (error) {
        showToast(`Error al cambiar rol: ${error.message}`, 'error');
    } else {
        showToast(`Rol actualizado correctamente`, 'success');
        await loadUsers();
    }
};

window.deleteUser = async (userId) => {
    const confirmed = await showConfirmModal({
        title: '¿Eliminar perfil de usuario?',
        message: 'El usuario perderá sus accesos y privilegios guardados.',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
    });

    if (confirmed) {
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) {
            showToast(error.message, 'error');
        } else {
            await loadUsers();
        }
    }
};

window.openManageUserFinancing = async (userId, userName) => {
    let modal = document.getElementById('admin-financing-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'admin-financing-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs overflow-y-auto';

    modal.innerHTML = `
        <div class="bg-surface border border-theme rounded-2xl max-w-2xl w-full p-5 relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
            <button id="close-admin-fin-modal" class="absolute top-3 right-3 text-muted hover:text-main text-lg font-bold cursor-pointer">&times;</button>
            
            <div>
                <span class="text-[10px] font-bold text-accent uppercase tracking-wider block">Administración de Crédito</span>
                <h2 class="text-base font-extrabold text-main">Cliente: ${userName}</h2>
            </div>

            <div class="p-3 bg-surface-hover rounded-xl border border-theme space-y-3">
                <h3 class="text-xs font-bold text-main">Asignar Vehículo a Cuotas</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div class="custom-select-wrapper">
                        <input type="hidden" id="admin-assign-car-id" value="">
                        <input type="text" id="admin-assign-car-input" placeholder="Buscar vehículo..." autocomplete="off" class="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-theme text-main text-xs focus:outline-none focus:border-[var(--accent)]">
                        <div class="custom-select-dropdown hidden" id="dropdown-admin-assign-car"></div>
                    </div>

                    <div class="custom-select-wrapper">
                        <input type="hidden" id="admin-assign-plan-count" value="12">
                        <div class="custom-select-trigger" id="trigger-admin-assign-plan">
                            <span>Seleccionar plan...</span>
                            <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                        <div class="custom-select-dropdown hidden" id="dropdown-admin-assign-plan">
                            <div class="custom-select-option text-muted italic">Primero selecciona un vehículo</div>
                        </div>
                    </div>

                    <button type="button" id="admin-assign-btn" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--bg-main)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] text-main transition-all cursor-pointer">
                        Asignar Crédito
                    </button>
                </div>
            </div>

            <div id="admin-user-financings-list" class="space-y-3">
                <p class="text-xs text-muted text-center py-4">Cargando financiamientos del usuario...</p>
            </div>

            <div class="flex justify-end pt-2 border-t border-theme">
                <button type="button" id="done-admin-fin-modal" class="px-4 py-1.5 text-xs font-bold rounded-lg border border-theme text-muted hover:text-main">Cerrar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const closeModal = () => {
        document.body.classList.remove('modal-open');
        modal.remove();
    };

    document.getElementById('close-admin-fin-modal').onclick = closeModal;
    document.getElementById('done-admin-fin-modal').onclick = closeModal;

    setupAdminCarAutocomplete();
    await loadAdminUserFinancings(userId);

    document.getElementById('admin-assign-btn').onclick = async () => {
        const carId = document.getElementById('admin-assign-car-id').value;
        const totalInstallments = parseInt(document.getElementById('admin-assign-plan-count').value) || 12;

        if (!carId) {
            showToast('Selecciona un vehículo válido del inventario.', 'error');
            return;
        }

        const carObj = allCars.find(c => c.id === carId);
        const carName = carObj ? `${carObj.brand} ${carObj.model}` : 'Vehículo';
        const installmentAmount = carObj ? (Number(carObj.price_usd) / totalInstallments).toFixed(2) : '100.00';

        const { data: finData, error: finError } = await supabase
            .from('user_car_financings')
            .insert([{ 
                user_id: userId, 
                car_id: carId, 
                total_installments: totalInstallments,
                empresa_id: currentAdminEmpresaId 
            }])
            .select()
            .single();

        if (finError) {
            showToast(finError.message, 'error');
            return;
        }

        const paymentsToInsert = [];
        const today = new Date();

        for (let i = 1; i <= totalInstallments; i++) {
            const dueDate = new Date(today.getFullYear(), today.getMonth() + i, today.getDate()).toISOString().split('T')[0];
            paymentsToInsert.push({
                financing_id: finData.id,
                installment_number: i,
                due_date: dueDate,
                amount_usd: installmentAmount,
                status: 'sin_pagar',
                empresa_id: currentAdminEmpresaId
            });
        }

        const { error: payError } = await supabase.from('financing_payments').insert(paymentsToInsert);

        if (payError) {
            showToast(payError.message, 'error');
        } else {
            showToast('¡Financiamiento y cuotas generadas con éxito!', 'success');
            await notifyClientCreditAssigned(userId, carName, totalInstallments);
            await loadAdminUserFinancings(userId);
        }
    };
};

function setupAdminCarAutocomplete() {
    const input = document.getElementById('admin-assign-car-input');
    const dropdown = document.getElementById('dropdown-admin-assign-car');
    const hiddenId = document.getElementById('admin-assign-car-id');
    if (!input || !dropdown || !hiddenId) return;

    dropdown.className = 'custom-select-dropdown hidden max-h-40 overflow-y-auto absolute z-50 w-full mt-1 bg-surface border border-theme rounded-xl shadow-lg';

    const renderDropdown = () => {
        const query = input.value.trim().toLowerCase();
        const matches = query ? allCars.filter(c => `${c.brand} ${c.model} (${c.year})`.toLowerCase().includes(query)) : allCars;

        dropdown.innerHTML = '';

        if (matches.length > 0) {
            matches.forEach(car => {
                const div = document.createElement('div');
                div.className = 'custom-select-option px-3 py-2 text-xs cursor-pointer hover:bg-surface-hover';
                div.textContent = `${car.brand} ${car.model} - $${car.price_usd} (${car.year})`;

                div.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = `${car.brand} ${car.model} (${car.year})`;
                    hiddenId.value = car.id;
                    dropdown.classList.add('hidden');

                    updateAdminPlansDropdown(car);
                };
                dropdown.appendChild(div);
            });
        } else {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'custom-select-option px-3 py-2 text-xs text-muted italic cursor-default';
            emptyDiv.textContent = 'No se encontraron vehículos...';
            dropdown.appendChild(emptyDiv);
        }

        closeAllDropdowns();
        dropdown.classList.remove('hidden');
    };

    input.onclick = (e) => { e.stopPropagation(); renderDropdown(); checkNewValueAlert(); };
    input.onfocus = (e) => { e.stopPropagation(); renderDropdown(); checkNewValueAlert(); };
    input.oninput = () => {
        hiddenId.value = '';
        renderDropdown();
    };
}

function updateAdminPlansDropdown(car) {
    const plans = car.car_financing_plans || [];
    const trigger = document.getElementById('trigger-admin-assign-plan');
    const dropdown = document.getElementById('dropdown-admin-assign-plan');
    const hiddenInput = document.getElementById('admin-assign-plan-count');

    if (!trigger || !dropdown || !hiddenInput) return;

    dropdown.className = 'custom-select-dropdown hidden absolute left-0 right-0 mt-1 max-h-[105px] overflow-y-auto bg-surface border border-theme rounded-xl shadow-xl z-50';

    if (plans.length === 0) {
        dropdown.innerHTML = `<div class="custom-select-option px-3 py-2 text-xs text-muted italic">Este carro no tiene planes de cuotas configurados</div>`;
        trigger.querySelector('span').textContent = 'Sin planes de cuotas';
        hiddenInput.value = '';
        return;
    }

    dropdown.innerHTML = plans.map(p => `
        <div class="custom-select-option px-3 py-2 text-xs cursor-pointer hover:bg-surface-hover transition-colors" data-value="${p.installments_count}">
            ${p.installments_count} cuotas (${p.frequency})
        </div>
    `).join('');

    hiddenInput.value = plans[0].installments_count;
    trigger.querySelector('span').textContent = `${plans[0].installments_count} cuotas (${plans[0].frequency})`;

    dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
        optEl.onclick = (e) => {
            e.stopPropagation();
            const val = optEl.getAttribute('data-value');
            const text = optEl.textContent.trim();

            hiddenInput.value = val;
            trigger.querySelector('span').textContent = text;
            dropdown.classList.add('hidden');
            trigger.classList.remove('active');
        };
    });

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        closeAllDropdowns();
        if (isHidden) {
            dropdown.classList.remove('hidden');
            trigger.classList.add('active');
        }
    };
}

async function loadAdminUserFinancings(userId) {
    const listContainer = document.getElementById('admin-user-financings-list');
    if (!listContainer) return;

    const { data: financings, error } = await supabase
        .from('user_car_financings')
        .select('*, cars(*), financing_payments(*)')
        .eq('user_id', userId);

    if (error || !financings || financings.length === 0) {
        listContainer.innerHTML = `<p class="text-xs text-muted text-center py-3">Este usuario no tiene vehículos financiados asignados.</p>`;
        return;
    }

    let html = `
        <div class="flex items-center gap-2 mb-2 pb-2 border-b border-theme flex-wrap">
            <span class="text-[11px] font-bold text-muted mr-1">Filtrar cuotas admin:</span>
            <button onclick="window.setAdminFilter('todos', '${userId}')" class="px-2.5 py-0.5 text-[10px] font-bold rounded border border-theme bg-surface text-main cursor-pointer">Todos</button>
            <button onclick="window.setAdminFilter('pagados', '${userId}')" class="px-2.5 py-0.5 text-[10px] font-bold rounded border border-theme bg-surface text-main cursor-pointer">Pagados</button>
            <button onclick="window.setAdminFilter('no_pagados', '${userId}')" class="px-2.5 py-0.5 text-[10px] font-bold rounded border border-theme bg-surface text-main cursor-pointer">No Pagados</button>
        </div>
    `;

    financings.forEach(fin => {
        adminPaymentsCache[fin.id] = fin.financing_payments || [];

        html += `
            <div class="bg-surface border border-theme rounded-xl p-3 space-y-2">
                <div class="flex justify-between items-center border-b border-theme pb-2">
                    <span class="text-xs font-bold text-main">${fin.cars?.brand || ''} ${fin.cars?.model || ''} (${fin.cars?.year || ''})</span>
                    <div class="flex items-center gap-2">
                        <button onclick="window.toggleAdminCollapse('${fin.id}')" class="text-[10px] text-accent underline cursor-pointer">Minimizar</button>
                        <button onclick="window.deleteFinancing('${fin.id}', '${userId}')" class="text-[10px] text-red-400 hover:underline cursor-pointer">Eliminar</button>
                    </div>
                </div>

                <div id="admin-grid-${fin.id}" class="grid grid-cols-1 sm:grid-cols-2 gap-2 min-h-[100px]"></div>
                <div id="admin-pagination-${fin.id}" class="flex items-center justify-between pt-2 border-t border-theme/60 text-[11px]"></div>
            </div>
        `;
    });

    listContainer.innerHTML = html;

    window.changeAdminFinancingPage = (fId, newPage, uId) => {
        adminFinancingPages[fId] = newPage;
        renderPaginatedAdminPayments(fId, uId);
    };

    financings.forEach(fin => {
        adminFinancingPages[fin.id] = 1;
        renderPaginatedAdminPayments(fin.id, userId);
    });
}

function renderPaginatedAdminPayments(financingId, userId) {
    const gridContainer = document.getElementById(`admin-grid-${financingId}`);
    const paginationContainer = document.getElementById(`admin-pagination-${financingId}`);
    if (!gridContainer) return;

    const rawPayments = adminPaymentsCache[financingId] || [];
    const payments = [...rawPayments].sort((a, b) => a.installment_number - b.installment_number);

    const filterStatus = window.currentAdminFilter || 'todos';
    const filteredPayments = payments.filter(p => {
        if (filterStatus === 'pagados') return p.status === 'aprobado';
        if (filterStatus === 'no_pagados') return p.status !== 'aprobado';
        return true;
    });

    if (filteredPayments.length === 0) {
        gridContainer.innerHTML = `<p class="text-xs text-muted col-span-full text-center py-2">Sin cuotas en este filtro.</p>`;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const itemsPerPage = 4;
    if (!adminFinancingPages[financingId]) {
        adminFinancingPages[financingId] = 1;
    }

    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    let currentPage = adminFinancingPages[financingId];

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSlice = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

    gridContainer.innerHTML = paginatedSlice.map(p => `
        <div id="admin-pay-card-${p.id}" class="p-2.5 rounded-lg bg-surface-hover border border-theme flex justify-between items-center text-xs transition-all duration-300">
            <div>
                <span class="font-bold text-main">Cuota ${p.installment_number}</span> &middot; $${p.amount_usd}<br>
                <span class="text-[9px] text-muted">Estado: <strong>${p.status}</strong>${p.payment_method ? ` (${p.payment_method}:${p.reference_or_details})` : ''}</span>
            </div>
            <div class="flex items-center gap-1">
                ${p.status === 'en_revision' ? `
                    <button onclick="window.approvePayment('${p.id}', '${userId}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] cursor-pointer">Aprobar</button>
                    <button onclick="window.rejectPayment('${p.id}', '${userId}')" class="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[10px] cursor-pointer">Rechazar</button>
                ` : p.status === 'aprobado' ? `
                    <span class="text-[10px] text-emerald-400 font-bold">Aprobado</span>
                ` : `
                    <span class="text-[10px] text-muted">Pendiente</span>
                `}
            </div>
        </div>
    `).join('');

    if (paginationContainer && totalPages > 1) {
        paginationContainer.innerHTML = `
            <span class="text-muted text-[10px] font-semibold">Cuotas ${startIndex + 1}-${Math.min(startIndex + itemsPerPage, filteredPayments.length)} de ${filteredPayments.length}</span>
            <div class="flex items-center gap-1.5">
                <button ${currentPage === 1 ? 'disabled class="opacity-30 cursor-not-allowed text-muted px-2 py-0.5 rounded border border-theme"' : `onclick="window.changeAdminFinancingPage('${financingId}', ${currentPage - 1}, '${userId}')"`} class="px-2 py-0.5 rounded border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer text-[10px]">
                    &laquo; Ant.
                </button>
                <span class="font-bold text-accent text-[10px]">${currentPage}/${totalPages}</span>
                <button ${currentPage === totalPages ? 'disabled class="opacity-30 cursor-not-allowed text-muted px-2 py-0.5 rounded border border-theme"' : `onclick="window.changeAdminFinancingPage('${financingId}', ${currentPage + 1}, '${userId}')"`} class="px-2 py-0.5 rounded border border-theme bg-surface hover:bg-surface-hover text-main font-bold cursor-pointer text-[10px]">
                    Sig. &raquo;
                </button>
            </div>
        `;
    } else if (paginationContainer) {
        paginationContainer.innerHTML = `<span class="text-muted text-[10px] font-semibold">Total: ${filteredPayments.length} cuota(s)</span>`;
    }
}

window.setAdminFilter = (status, userId) => {
    window.currentAdminFilter = status;
    loadAdminUserFinancings(userId);
};

window.toggleAdminCollapse = (finId) => {
    const grid = document.getElementById(`admin-grid-${finId}`);
    const pagination = document.getElementById(`admin-pagination-${finId}`);
    if (grid) grid.classList.toggle('hidden');
    if (pagination) pagination.classList.toggle('hidden');
};

window.approvePayment = async (paymentId, userId) => {
    const { error } = await supabase
        .from('financing_payments')
        .update({ status: 'aprobado' })
        .eq('id', paymentId);

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('¡Pago aprobado correctamente!', 'success');
        await notifyClientPaymentApproved(userId, paymentId);
        await loadAdminUserFinancings(userId);
    }
};

window.rejectPayment = async (paymentId, userId) => {
    const reason = await showPromptModal({
        title: 'Rechazar Pago',
        message: 'Indica el motivo del rechazo para informar al cliente en su notificación:',
        placeholder: 'Ej: El número de referencia no coincide con la transferencia...',
        confirmText: 'Rechazar Pago',
        cancelText: 'Cancelar'
    });

    if (reason === null) return;

    const { error } = await supabase
        .from('financing_payments')
        .update({ status: 'sin_pagar', payment_method: null, reference_or_details: null })
        .eq('id', paymentId);

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('El pago ha sido rechazado y devuelto a estado sin pagar.', 'info');
        await notifyClientPaymentRejected(userId, paymentId, reason);
        await loadAdminUserFinancings(userId);
    }
};

window.deleteFinancing = async (financingId, userId) => {
    const confirmed = await showConfirmModal({
        title: '¿Desanclar / Cancelar financiamiento?',
        message: 'Las cuotas pendientes serán eliminadas, pero las cuotas pagadas se conservarán en el historial.',
        confirmText: 'Sí, desanclar',
        cancelText: 'Cancelar',
        type: 'danger'
    });

    if (confirmed) {
        const { error: finErr } = await supabase
            .from('user_car_financings')
            .update({ status: 'cancelado' })
            .eq('id', financingId);

        const { error: payErr } = await supabase
            .from('financing_payments')
            .delete()
            .eq('financing_id', financingId)
            .neq('status', 'aprobado');

        if (finErr || payErr) {
            showToast('Error al desanclar financiamiento.', 'error');
        } else {
            showToast('Financiamiento desanclado correctamente.', 'success');
            await loadAdminUserFinancings(userId);
        }
    }
};