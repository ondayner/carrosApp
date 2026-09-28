import { supabase } from '../config/supabase.js';

export async function renderNav(user = null) {
    const header = document.getElementById('nav-container');
    if (!header) return;

    let profileData = null;
    let hasFinancing = false;
    let notifications = [];

    if (user) {
        // Petición totalmente paralelizada
        const [profileRes, financingCountRes, notifsRes] = await Promise.all([
            supabase.from('profiles').select('first_name, last_name, role, avatar_url').eq('id', user.id).single(),
            supabase.from('user_car_financings').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
        ]);

        profileData = profileRes.data;
        hasFinancing = financingCountRes.count && financingCountRes.count > 0;
        notifications = notifsRes.data || [];
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const firstName = profileData?.first_name || user?.user_metadata?.first_name || 'Usuario';
    const displayName = profileData?.first_name 
        ? `${profileData.first_name} ${profileData.last_name || ''}`.trim()
        : (user?.email?.split('@')[0] || 'Usuario');

    const isAdmin = profileData?.role === 'admin' || user?.user_metadata?.role === 'admin';
    const avatarUrl = profileData?.avatar_url || user?.user_metadata?.avatar_url || null;
    const initialLetter = firstName.charAt(0).toUpperCase();

    const isInViews = window.location.pathname.includes('/views/');
    const pathToRoot = isInViews ? '../' : './';
    const pathToViews = isInViews ? './' : './views/';
    const isPaymentsPage = window.location.pathname.includes('payments.html');

    header.innerHTML = `
        <nav class="w-full bg-surface border-b border-theme sticky top-0 z-40 transition-colors">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                
                <a href="${pathToRoot}index.html" class="flex items-center gap-3 group cursor-pointer">
                    <div class="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center font-black text-white text-lg shadow-md group-hover:scale-105 transition-transform">
                        CV
                    </div>
                    <div>
                        <span class="text-main font-extrabold text-base tracking-tight block leading-none">Carros venta</span>
                        <span class="text-muted text-[10px] tracking-wider uppercase font-semibold">Concesionario Premium</span>
                    </div>
                </a>

                <div class="hidden md:flex items-center gap-8 text-sm text-[var(--text-main)] font-semibold">
                    <a href="${pathToRoot}index.html" class="hover:text-[var(--accent)] transition-all">Inicio</a>
                    <a href="${pathToRoot}index.html#catalogo" class="hover:text-[var(--accent)] transition-all">Catalogo</a>
                    ${hasFinancing ? `<a href="${pathToViews}payments.html" class="${isPaymentsPage ? 'text-accent font-extrabold' : 'hover:text-[var(--accent)]'} transition-all">Mis Pagos</a>` : ''}
                    <a href="#footer" class="hover:text-[var(--accent)] transition-all">Contáctanos</a>
                </div>

                <div class="hidden md:flex items-center gap-3 relative">
                    ${user ? renderNotificationsHtml('desktop', unreadCount, notifications, hasFinancing, pathToViews, isAdmin, avatarUrl, displayName, initialLetter) : '<button onclick="window.openAuthModal()" class="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--bg-main)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] text-main shadow-md transition-all cursor-pointer">Login</button>'}
                </div>

                <div class="md:hidden flex items-center gap-2">
                    ${user ? renderNotificationsHtml('mobile', unreadCount, notifications, hasFinancing, pathToViews, isAdmin, avatarUrl, displayName, initialLetter) : ''}
                    <button id="mobile-menu-btn" type="button" class="p-2 rounded-xl text-main hover:bg-surface-hover transition-colors cursor-pointer">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                </div>
            </div>

            <div id="mobile-menu" class="hidden md:hidden bg-surface border-b border-theme px-4 pt-2 pb-6 space-y-4 shadow-xl transition-all">
                <div class="flex flex-col space-y-3">
                    <a href="${pathToRoot}index.html" class="block py-2 text-base font-semibold text-main hover:text-[var(--accent)] transition-colors">Inicio</a>
                    <a href="${pathToRoot}index.html#catalogo" class="block py-2 text-base font-semibold text-main hover:text-[var(--accent)] transition-colors">Catalogo</a>
                    ${hasFinancing ? `<a href="${pathToViews}payments.html" class="block py-2 text-base font-semibold text-accent transition-colors">Mis Pagos</a>` : ''}
                    <a href="#footer" class="block py-2 text-base font-semibold text-main hover:text-[var(--accent)] transition-colors">Contáctanos</a>
                </div>

                <div class="pt-4 border-t border-theme flex flex-col gap-3">
                    ${user ? `
                        <div class="flex flex-col gap-2">
                            <span class="text-xs text-muted">Hola, <strong class="text-main">${displayName}</strong></span>${isAdmin ? `<a href="${pathToViews}adminPanel.html" class="w-full py-2 text-center text-xs font-bold rounded-xl bg-[var(--accent)] text-white">Dashboard / Admin</a>` : ''}
                            <button id="logout-btn-mobile" class="w-full py-2.5 text-xs font-bold rounded-xl border border-theme text-red-400 hover:border-red-500 transition-all cursor-pointer">Cerrar Sesión</button>
                        </div>
                    ` : `
                        <button onclick="window.openAuthModal()" class="w-full py-2.5 text-xs font-bold rounded-xl bg-[var(--bg-main)] border border-[var(--accent)] text-main cursor-pointer">Login</button>
                    `}
                </div>
            </div>
        </nav>
    `;

    function renderNotificationsHtml(device, count, notifs, hasFinanc, viewsPath, adminCheck, avatar, name, initial) {
        const idSuffix = device === 'mobile' ? 'mob' : 'desk';
        return `
            <div class="relative">
                <button id="notif-bell-btn-${idSuffix}" type="button" class="relative p-2 rounded-xl bg-surface-hover border border-theme text-main hover:border-[var(--accent)] transition-all cursor-pointer shadow-xs">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    <span id="notif-badge-${idSuffix}" class="${count > 0 ? '' : 'hidden'} absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">${count}</span>
                </button>

                <div id="notif-dropdown-${idSuffix}" class="hidden absolute ${device === 'mobile' ? '-right-12' : 'right-0'} mt-2 w-80 bg-surface border border-theme rounded-2xl shadow-2xl py-2 z-50 text-xs">
                    <div class="px-4 py-2 border-b border-theme flex justify-between items-center gap-2">
                        <span class="font-extrabold text-main">Notificaciones</span>
                        <div class="flex items-center gap-2">
                            <button id="mark-all-read-${idSuffix}" class="text-[10px] text-accent hover:underline cursor-pointer font-semibold">Leídas</button>
                            <span class="text-muted text-[10px]">&middot;</span>
                            <button id="delete-all-notifs-${idSuffix}" class="text-[10px] text-red-400 hover:text-red-500 font-semibold cursor-pointer">Borrar todas</button>
                        </div>
                    </div>
                    <div id="notif-list-container-${idSuffix}" class="max-h-72 overflow-y-auto divide-y divide-theme">
                        ${renderNotifListItems(notifs)}
                    </div>
                </div>
            </div>

            ${device === 'desktop' ? `
                <div class="relative">
                    <button id="user-menu-btn" type="button" class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-hover border border-theme text-main text-xs font-bold hover:border-[var(--accent)] transition-all cursor-pointer shadow-xs">
                        ${avatar ? `<img src="${avatar}" alt="${name}" class="w-6 h-6 rounded-full object-cover border border-theme">` : `<div class="w-6 h-6 rounded-full bg-[var(--accent)] text-white text-[11px] font-extrabold flex items-center justify-center">${initial}</div>`}
                        <span>${name}</span>
                        <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>

                    <div id="user-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-surface border border-theme rounded-xl shadow-2xl py-1.5 z-50 text-xs font-semibold">
                        ${hasFinanc ? `<a href="${viewsPath}payments.html" class="flex items-center gap-2 px-4 py-2 text-main hover:bg-surface-hover hover:text-[var(--accent)] transition-colors">Mis Pagos</a><div class="border-t border-theme my-1"></div>` : ''}
                        ${adminCheck ? `<a href="${viewsPath}adminPanel.html" class="flex items-center gap-2 px-4 py-2 text-main hover:bg-surface-hover hover:text-[var(--accent)] transition-colors">Dashboard / Admin</a><div class="border-t border-theme my-1"></div>` : ''}
                        <button id="logout-btn" type="button" class="w-full text-left flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-surface-hover transition-colors cursor-pointer">Cerrar Sesión</button>
                    </div>
                </div>
            ` : ''}
        `;
    }

    function renderNotifListItems(notifs) {
        if (!notifs || notifs.length === 0) {
            return '<p class="p-6 text-center text-muted italic">No tienes notificaciones pendientes.</p>';
        }

        return notifs.map(n => `
            <div id="notif-item-${n.id}" onclick="window.handleNotificationClick('${n.id}', '${n.type}', '${n.target_url || ''}')" class="p-3 hover:bg-surface-hover transition-all cursor-pointer relative group ${n.is_read ? 'opacity-60' : 'bg-surface-hover/50'}">
                <div class="pr-5">
                    <p class="font-bold text-main flex items-center justify-between">
                        <span>${n.title}</span>${!n.is_read ? '<span id="unread-dot-' + n.id + '" class="w-2 h-2 rounded-full bg-accent"></span>' : ''}
                    </p>
                    <p class="text-[11px] text-muted mt-0.5 leading-tight">${n.message}</p>
                    <span class="text-[9px] text-muted block mt-1">${new Date(n.created_at).toLocaleString()}</span>
                </div>
                <button onclick="window.deleteSingleNotification(event, '${n.id}')" title="Eliminar notificación" class="absolute top-2.5 right-2 text-muted hover:text-red-400 text-sm font-bold p-1 rounded-md transition-colors cursor-pointer">
                    &times;
                </button>
            </div>
        `).join('');
    }

    // TOGGLES DE MENÚS Y EVENTO DEL BOTÓN HAMBURGUESA
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.onclick = (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
            document.getElementById('notif-dropdown-mob')?.classList.add('hidden');
        };

        // Evita que clicks dentro del propio menú móvil lo cierren por accidente (salvo al pulsar enlaces)
        mobileMenu.onclick = (e) => {
            e.stopPropagation();
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                mobileMenu.classList.add('hidden');
            }
        };
    }

    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuBtn && userDropdown) {
        userMenuBtn.onclick = (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
            document.getElementById('notif-dropdown-desk')?.classList.add('hidden');
        };
    }

    const bellDesk = document.getElementById('notif-bell-btn-desk');
    const dropDesk = document.getElementById('notif-dropdown-desk');
    if (bellDesk && dropDesk) {
        bellDesk.onclick = (e) => {
            e.stopPropagation();
            dropDesk.classList.toggle('hidden');
            userDropdown?.classList.add('hidden');
        };
    }

    const bellMob = document.getElementById('notif-bell-btn-mob');
    const dropMob = document.getElementById('notif-dropdown-mob');
    if (bellMob && dropMob) {
        bellMob.onclick = (e) => {
            e.stopPropagation();
            dropMob.classList.toggle('hidden');
            mobileMenu?.classList.add('hidden');
        };
    }

    // Cierre global al hacer click fuera
    document.addEventListener('click', () => {
        userDropdown?.classList.add('hidden');
        dropDesk?.classList.add('hidden');
        dropMob?.classList.add('hidden');
        mobileMenu?.classList.add('hidden');
    });

    function refreshNotifsUI() {
        const unread = notifications.filter(n => !n.is_read).length;
        ['desk', 'mob'].forEach(suf => {
            const badge = document.getElementById(`notif-badge-${suf}`);
            const list = document.getElementById(`notif-list-container-${suf}`);
            if (badge) {
                badge.textContent = unread;
                if (unread > 0) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }
            if (list) list.innerHTML = renderNotifListItems(notifications);
        });
    }

    const markAllRead = async () => {
        notifications.forEach(n => n.is_read = true);
        refreshNotifsUI();
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    };
    document.getElementById('mark-all-read-desk')?.addEventListener('click', markAllRead);
    document.getElementById('mark-all-read-mob')?.addEventListener('click', markAllRead);

    const deleteAllNotifs = async () => {
        notifications = [];
        refreshNotifsUI();
        await supabase.from('notifications').delete().eq('user_id', user.id);
    };
    document.getElementById('delete-all-notifs-desk')?.addEventListener('click', deleteAllNotifs);
    document.getElementById('delete-all-notifs-mob')?.addEventListener('click', deleteAllNotifs);

    window.deleteSingleNotification = async (event, notifId) => {
        event.stopPropagation();
        notifications = notifications.filter(n => n.id !== notifId);
        refreshNotifsUI();
        await supabase.from('notifications').delete().eq('id', notifId);
    };

    window.handleNotificationClick = async (notifId, type, targetUrl) => {
        const notif = notifications.find(n => n.id === notifId);
        if (notif) notif.is_read = true;
        refreshNotifsUI();

        await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);

        if (targetUrl) {
            const cleanPath = targetUrl.replace(/^\.\//, '').replace(/^views\//, '');
            window.location.href = pathToViews + cleanPath;
        } else if (type === 'admin_alert') {
            window.location.href = `${pathToViews}adminPanel.html`;
        } else {
            window.location.href = `${pathToViews}payments.html`;
        }
    };

    if (user) {
        supabase
            .channel(`notifs-user-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    notifications.unshift(payload.new);
                    refreshNotifsUI();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    notifications = notifications.filter(n => n.id !== payload.old.id);
                    refreshNotifsUI();
                }
            )
            .subscribe();
    }

    const handleLogout = async () => { 
        await supabase.auth.signOut(); 
        window.location.href = `${pathToRoot}index.html`; 
    };
    
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('logout-btn-mobile')?.addEventListener('click', handleLogout);
}