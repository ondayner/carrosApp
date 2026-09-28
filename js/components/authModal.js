import { supabase } from '../config/supabase.js';
import { showToast } from './notifications.js';

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VZLA_PHONE_REGEX = /^(?:\+58|0)?(?:412|414|424|416|426)\d{7}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,24}$/;

function translateAuthError(errorMessage) {
    if (!errorMessage) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    const msg = errorMessage.toLowerCase();

    if (msg.includes('invalid login credentials')) return 'Usuario no existe o contraseña incorrecta. Crea una cuenta.';
    if (msg.includes('user already registered') || msg.includes('already exists')) return 'Este correo ya está registrado. Por favor inicia sesión.';
    if (msg.includes('rate limit')) return 'Demasiados intentos seguidos. Por favor espera unos minutos.';

    return errorMessage;
}

export function renderAuthModal() {
    let modal = document.getElementById('auth-modal');
    if (modal) modal.remove();

    document.body.classList.add('modal-open');

    modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs overflow-y-auto';
    
    modal.innerHTML = `
        <div class="bg-surface border border-theme rounded-2xl p-4 sm:p-5 w-full max-w-sm relative shadow-2xl my-auto">
            <button id="close-auth-modal" class="absolute top-3 right-3 text-muted hover:text-main text-lg font-bold cursor-pointer z-10">&times;</button>
            
            <div id="auth-tabs" class="flex gap-4 border-b border-theme pb-2.5 mb-3">
                <button id="tab-login" type="button" class="text-accent font-bold text-sm border-b-2 border-[var(--accent)] pb-1 cursor-pointer">Iniciar Sesión</button>
                <button id="tab-register" type="button" class="text-muted font-bold text-sm hover:text-main pb-1 cursor-pointer">Crear Cuenta</button>
            </div>

            <div id="auth-error" class="hidden mb-3 p-2.5 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-[11px] font-semibold leading-relaxed"></div>

            <button id="google-auth-btn" type="button" class="w-full mb-2.5 py-2 px-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 text-xs cursor-pointer shadow-xs">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                Continuar con Google
            </button>

            <div class="relative flex py-1 items-center">
                <div class="flex-grow border-t border-theme"></div>
                <span class="flex-shrink mx-3 text-muted text-[10px]">o con correo</span>
                <div class="flex-grow border-t border-theme"></div>
            </div>

            <form id="auth-form" class="flex flex-col gap-2 mt-1">
                <div id="register-fields" class="hidden space-y-2">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-muted mb-0.5">Nombre *</label>
                            <input type="text" id="auth-name" class="w-full bg-surface-hover border border-theme rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none transition-colors" placeholder="Juan">
                            <span class="text-[9px] text-red-400 font-semibold mt-0.5 hidden input-info">Solo letras (2 a 30)</span>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-muted mb-0.5">Apellido *</label>
                            <input type="text" id="auth-lastname" class="w-full bg-surface-hover border border-theme rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none transition-colors" placeholder="Pérez">
                            <span class="text-[9px] text-red-400 font-semibold mt-0.5 hidden input-info">Solo letras (2 a 30)</span>
                        </div>
                    </div>
                </div>

                <div id="email-phone-wrapper" class="space-y-2">
                    <div id="phone-container" class="hidden">
                        <label class="block text-[10px] font-bold text-muted mb-0.5">Teléfono *</label>
                        <input type="tel" id="auth-phone" class="w-full bg-surface-hover border border-theme rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none transition-colors" placeholder="04121234567">
                        <span class="text-[9px] text-red-400 font-semibold mt-0.5 hidden input-info">Ej: 04121234567</span>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-muted mb-0.5">Correo Electrónico *</label>
                        <input type="email" id="auth-email" required class="w-full bg-surface-hover border border-theme rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none transition-colors" placeholder="tu@email.com">
                        <span class="text-[9px] text-red-400 font-semibold mt-0.5 hidden input-info">Correo inválido</span>
                    </div>
                </div>

                <div id="password-wrapper">
                    <div class="flex justify-between items-center mb-0.5">
                        <label class="block text-[10px] font-bold text-muted">Contraseña *</label>
                        <button type="button" id="forgot-password-link" class="text-[9px] text-accent font-semibold hover:underline cursor-pointer">¿Olvidaste tu contraseña?</button>
                    </div>
                    <div class="relative flex items-center">
                        <input type="password" id="auth-password" required minlength="6" class="w-full bg-surface-hover border border-theme rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-main focus:outline-none transition-colors" placeholder="••••••••">
                        <button type="button" class="toggle-password-btn absolute right-2 text-muted hover:text-main cursor-pointer p-0.5" data-target="auth-password">
                            <svg class="w-3.5 h-3.5 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                    </div>
                    <span class="text-[9px] text-red-400 font-semibold mt-0.5 hidden input-info">Min. 6 letras, debe incluir Mayúscula, Minúscula y Número</span>
                </div>

                <div id="confirm-password-wrapper" class="hidden">
                    <label class="block text-[10px] font-bold text-muted mb-0.5">Repetir Contraseña *</label>
                    <div class="relative flex items-center">
                        <input type="password" id="auth-confirm-password" minlength="6" class="w-full bg-surface-hover border border-theme rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-main focus:outline-none transition-colors" placeholder="••••••••">
                        <button type="button" class="toggle-password-btn absolute right-2 text-muted hover:text-main cursor-pointer p-0.5" data-target="auth-confirm-password">
                            <svg class="w-3.5 h-3.5 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                    </div>
                    <span class="text-[9px] text-red-400 font-semibold mt-0.5 hidden input-info">Las contraseñas no coinciden</span>
                </div>

                <button type="submit" id="auth-submit-btn" class="mt-1.5 w-full py-2 bg-[var(--bg-main)] hover:bg-[var(--accent-hover)] border-1 border-[var(--accent)] text-[var(--text-main)] font-bold rounded-xl transition-all shadow-xs text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    Ingresar
                </button>
            </form>

            <div id="recovery-section" class="hidden space-y-2.5 mt-2">
                <p class="text-[11px] text-muted leading-relaxed">Ingresa tu correo registrado y te enviaremos un enlace para restablecer tu contraseña.</p>
                <div>
                    <label class="block text-[10px] font-bold text-muted mb-0.5">Correo Electrónico</label>
                    <input type="email" id="recovery-email" class="w-full bg-surface-hover border border-theme rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none" placeholder="tu@email.com">
                </div>
                <div class="flex gap-2 pt-1">
                    <button type="button" id="cancel-recovery-btn" class="w-1/2 py-1.5 text-xs font-bold rounded-lg border border-theme text-muted hover:text-main cursor-pointer">Volver</button>
                    <button type="button" id="send-recovery-btn" class="w-1/2 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] cursor-pointer">Enviar Enlace</button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        document.body.classList.remove('modal-open');
        modal.remove();
    };

    let currentMode = 'login';

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authForm = document.getElementById('auth-form');
    const recoverySection = document.getElementById('recovery-section');
    const registerFields = document.getElementById('register-fields');
    const phoneContainer = document.getElementById('phone-container');
    const confirmPassWrapper = document.getElementById('confirm-password-wrapper');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const submitBtn = document.getElementById('auth-submit-btn');
    const googleBtn = document.getElementById('google-auth-btn');
    const authError = document.getElementById('auth-error');

    const nameInp = document.getElementById('auth-name');
    const lastnameInp = document.getElementById('auth-lastname');
    const phoneInp = document.getElementById('auth-phone');
    const emailInp = document.getElementById('auth-email');
    const passInp = document.getElementById('auth-password');
    const confirmPassInp = document.getElementById('auth-confirm-password');

    const validState = { name: false, lastname: false, phone: false, email: false, password: false, confirmPassword: false };

    const validateField = (input, isValid) => {
        const infoEl = input.parentElement.parentElement.querySelector('.input-info') || input.parentElement.querySelector('.input-info');
        if (input.value.trim() === '') {
            input.classList.remove('border-emerald-500', 'border-red-500');
            input.classList.add('border-theme');
            if (infoEl) infoEl.classList.add('hidden');
            return false;
        }

        if (isValid) {
            input.classList.remove('border-theme', 'border-red-500');
            input.classList.add('border-emerald-500');
            if (infoEl) infoEl.classList.add('hidden');
        } else {
            input.classList.remove('border-theme', 'border-emerald-500');
            input.classList.add('border-red-500');
            if (infoEl) infoEl.classList.remove('hidden');
        }
        return isValid;
    };

    const checkOverallForm = () => {
        if (currentMode === 'login') {
            submitBtn.disabled = !(EMAIL_REGEX.test(emailInp.value.trim()) && passInp.value.length >= 6);
        } else if (currentMode === 'register') {
            submitBtn.disabled = !(validState.name && validState.lastname && validState.phone && validState.email && validState.password && validState.confirmPassword);
        }
    };

    nameInp.addEventListener('input', (e) => { validState.name = validateField(nameInp, NAME_REGEX.test(e.target.value.trim())); checkOverallForm(); });
    lastnameInp.addEventListener('input', (e) => { validState.lastname = validateField(lastnameInp, NAME_REGEX.test(e.target.value.trim())); checkOverallForm(); });
    phoneInp.addEventListener('input', (e) => { validState.phone = validateField(phoneInp, VZLA_PHONE_REGEX.test(e.target.value.trim().replace(/\s+/g, ''))); checkOverallForm(); });
    emailInp.addEventListener('input', (e) => { validState.email = validateField(emailInp, EMAIL_REGEX.test(e.target.value.trim())); checkOverallForm(); });
    passInp.addEventListener('input', (e) => {
        validState.password = validateField(passInp, PASSWORD_REGEX.test(e.target.value));
        if (confirmPassInp.value) validState.confirmPassword = validateField(confirmPassInp, confirmPassInp.value === passInp.value);
        checkOverallForm();
    });
    confirmPassInp.addEventListener('input', (e) => {
        validState.confirmPassword = validateField(confirmPassInp, e.target.value === passInp.value && validState.password);
        checkOverallForm();
    });

    modal.querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const input = document.getElementById(btn.getAttribute('data-target'));
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = `<svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 0110.122 1.933 9.97 9.97 0 013.542 4.004c-1.274 4.057-5.064 7-9.542 7a9.97 9.97 0 01-1.39-.097M3 3l18 18"/></svg>`;
            } else {
                input.type = 'password';
                btn.innerHTML = `<svg class="w-3.5 h-3.5 text-muted hover:text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
            }
        };
    });

    const setMode = (mode) => {
        currentMode = mode;
        authError.classList.add('hidden');

        [nameInp, lastnameInp, phoneInp, emailInp, passInp, confirmPassInp].forEach(inp => {
            if (inp) {
                inp.classList.remove('border-emerald-500', 'border-red-500');
                inp.classList.add('border-theme');
            }
        });
        modal.querySelectorAll('.input-info').forEach(el => el.classList.add('hidden'));

        if (mode === 'login') {
            tabLogin.className = 'text-accent font-bold text-sm border-b-2 border-[var(--accent)] pb-1 cursor-pointer';
            tabRegister.className = 'text-muted font-bold text-sm hover:text-main pb-1 cursor-pointer';
            authForm.classList.remove('hidden');
            recoverySection.classList.add('hidden');
            registerFields.classList.add('hidden');
            phoneContainer.classList.add('hidden');
            confirmPassWrapper.classList.add('hidden');
            forgotPasswordLink.classList.remove('hidden');
            googleBtn.classList.remove('hidden');
            submitBtn.textContent = 'Ingresar';

            nameInp.removeAttribute('required');
            lastnameInp.removeAttribute('required');
            phoneInp.removeAttribute('required');
            confirmPassInp.removeAttribute('required');
            checkOverallForm();
        } else if (mode === 'register') {
            tabRegister.className = 'text-accent font-bold text-sm border-b-2 border-[var(--accent)] pb-1 cursor-pointer';
            tabLogin.className = 'text-muted font-bold text-sm hover:text-main pb-1 cursor-pointer';
            authForm.classList.remove('hidden');
            recoverySection.classList.add('hidden');
            registerFields.classList.remove('hidden');
            phoneContainer.classList.remove('hidden');
            confirmPassWrapper.classList.remove('hidden');
            forgotPasswordLink.classList.add('hidden');
            googleBtn.classList.remove('hidden');
            submitBtn.textContent = 'Registrarse';

            nameInp.setAttribute('required', 'true');
            lastnameInp.setAttribute('required', 'true');
            phoneInp.setAttribute('required', 'true');
            confirmPassInp.setAttribute('required', 'true');
            checkOverallForm();
        } else if (mode === 'recovery') {
            authForm.classList.add('hidden');
            googleBtn.classList.add('hidden');
            recoverySection.classList.remove('hidden');
        }
    };

    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));
    forgotPasswordLink.addEventListener('click', () => setMode('recovery'));
    document.getElementById('cancel-recovery-btn').addEventListener('click', () => setMode('login'));
    document.getElementById('close-auth-modal').addEventListener('click', closeModal);

    // BINDING CORREGIDO PARA REDIRECCIÓN EN GITHUB PAGES
    googleBtn.addEventListener('click', async () => {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: redirectUrl }
        });
        if (error) {
            const translatedMsg = translateAuthError(error.message);
            authError.textContent = translatedMsg;
            authError.classList.remove('hidden');
            showToast(translatedMsg, 'error');
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');

        const email = emailInp.value.trim();
        const password = passInp.value;

        try {
            if (currentMode === 'login') {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;

                const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', data.user.id).single();
                const userName = profile?.first_name || email.split('@')[0];

                showToast(`¡Bienvenido de nuevo, ${userName}!`, 'success');
                closeModal();
                setTimeout(() => window.location.reload(), 4500);

            } else if (currentMode === 'register') {
                const firstName = nameInp.value.trim();
                const lastName = lastnameInp.value.trim();
                const phone = phoneInp.value.trim();

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName,
                            last_name: lastName,
                            phone: phone,
                            role: 'cliente'
                        }
                    }
                });

                if (error) throw error;

                showToast(`¡Bienvenido, ${firstName}! Tu cuenta fue creada con éxito.`, 'success');
                closeModal();
                setTimeout(() => window.location.reload(), 4500);
            }
        } catch (err) {
            const translatedMsg = translateAuthError(err.message);
            authError.textContent = translatedMsg;
            authError.classList.remove('hidden');
            showToast(translatedMsg, 'error');
        }
    });

    setMode('login');
}