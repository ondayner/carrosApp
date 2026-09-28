import { supabase } from '../config/supabase.js';

export async function protectAdminRoute() {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Si no está logueado, redirige al inicio
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Consulta el rol en la tabla profiles
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // 3. Si no es admin, bloquea el acceso y redirige a sus pagos
    if (error || profile?.role !== 'admin') {
        window.location.href = 'payments.html';
    }
}

export async function protectClientRoute() {
    const { data: { user } } = await supabase.auth.getUser();

    // Si no está logueado, redirige al inicio
    if (!user) {
        window.location.href = 'index.html';
    }
}