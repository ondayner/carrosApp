import { supabase } from '../config/supabase.js';

export async function sendUniqueNotification(userId, title, message, type, targetUrl = '') {
    try {
        const { error } = await supabase.from('notifications').insert([{
            user_id: userId,
            title,
            message,
            type,
            target_url: targetUrl,
            is_read: false
        }]);

        if (error) {
            console.error("🚨 Error al insertar notificación:", error.message);
        }
    } catch (err) {
        console.error("🚨 Excepción al insertar notificación:", err);
    }
}

/**
 * Notifica a los administradores sobre un nuevo pago reportado.
 */
export async function notifyAdminNewPayment(userName, paymentId, amountUsd, userId) {
    try {
        const { data: payData, error: payError } = await supabase
            .from('financing_payments')
            .select(`
                installment_number,
                user_car_financings (
                    cars ( brand, model, year )
                )
            `)
            .eq('id', paymentId)
            .single();

        if (payError || !payData) {
            console.error("Error al obtener detalles del pago:", payError);
            return;
        }

        const installmentNum = payData.installment_number || 'X';
        const carInfo = payData.user_car_financings?.cars;
        const carName = carInfo ? `${carInfo.brand} ${carInfo.model}` : 'vehículo';

        const { data: admins, error: adminError } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin');

        if (adminError || !admins || admins.length === 0) {
            console.warn("No se encontraron administradores.");
            return;
        }

        const adminTargetUrl = `adminPanel.html?userId=${userId}&payId=${paymentId}`;
        const title = 'Nuevo pago en revisión';
        const message = `El cliente ${userName} reportó el pago de la Cuota ${installmentNum} del ${carName} ($${amountUsd} USD).`;

        for (const admin of admins) {
            await sendUniqueNotification(
                admin.id,
                title,
                message,
                'admin_alert',
                adminTargetUrl
            );
        }
    } catch (err) {
        console.error("Excepción en notifyAdminNewPayment:", err);
    }
}

/**
 * Notifica anónimamente al cliente que su cuota fue aprobada.
 * Si es la última cuota del plan, envía también la notificación de crédito completado.
 */
export async function notifyClientPaymentApproved(userId, paymentId) {
    try {
        const { data: payData, error: payError } = await supabase
            .from('financing_payments')
            .select(`
                financing_id,
                installment_number,
                amount_usd,
                user_car_financings (
                    total_installments,
                    cars ( brand, model )
                )
            `)
            .eq('id', paymentId)
            .single();

        if (payError || !payData) {
            console.error("Error al obtener detalles para notificar aprobación:", payError);
            return;
        }

        const installmentNum = payData.installment_number || 'X';
        const carInfo = payData.user_car_financings?.cars;
        const carName = carInfo ? `${carInfo.brand} ${carInfo.model}` : 'tu vehículo';
        const amountUsd = payData.amount_usd || '0.00';

        const clientTargetUrl = `payments.html?payId=${paymentId}`;
        const title = '¡Pago Aprobado!';
        const message = `Tu pago de $${amountUsd} USD para la Cuota ${installmentNum} del ${carName} ha sido verificado y confirmado exitosamente.`;

        await sendUniqueNotification(
            userId,
            title,
            message,
            'client_update',
            clientTargetUrl
        );

        // Verificar si completó todas las cuotas del financiamiento
        const financingId = payData.financing_id;
        if (financingId) {
            const { count: pendingCount } = await supabase
                .from('financing_payments')
                .select('*', { count: 'exact', head: true })
                .eq('financing_id', financingId)
                .neq('status', 'aprobado');

            if (pendingCount === 0) {
                await notifyClientFinancingCompleted(userId, carName);
            }
        }
    } catch (err) {
        console.error("Excepción en notifyClientPaymentApproved:", err);
    }
}

/**
 * Notifica al cliente cuando se le asigna un nuevo vehículo a crédito.
 */
export async function notifyClientCreditAssigned(userId, carName, totalInstallments) {
    try {
        const title = '¡Crédito Aprobado y Asignado!';
        const message = `Se ha activado tu financiamiento para el ${carName} a ${totalInstallments} cuotas. Ya puedes revisar tu cronograma en el portal.`;
        const targetUrl = 'payments.html';

        await sendUniqueNotification(userId, title, message, 'credit_assigned', targetUrl);
    } catch (err) {
        console.error("Excepción en notifyClientCreditAssigned:", err);
    }
}

/**
 * Notifica al cliente en caso de que su pago reportado sea rechazado.
 */
export async function notifyClientPaymentRejected(userId, paymentId, reason = '') {
    try {
        const { data: payData } = await supabase
            .from('financing_payments')
            .select(`
                installment_number,
                user_car_financings ( cars ( brand, model ) )
            `)
            .eq('id', paymentId)
            .single();

        const installmentNum = payData?.installment_number || 'X';
        const carInfo = payData?.user_car_financings?.cars;
        const carName = carInfo ? `${carInfo.brand} ${carInfo.model}` : 'tu vehículo';

        const title = 'Pago no verificado';
        const reasonText = reason ? ` Motivo: ${reason}` : ' Por favor verifica el comprobante y vuelve a reportarlo.';
        const message = `Tu reporte de pago para la Cuota ${installmentNum} del ${carName} no pudo ser verificado.${reasonText}`;
        const targetUrl = `payments.html?payId=${paymentId}`;

        await sendUniqueNotification(userId, title, message, 'payment_rejected', targetUrl);
    } catch (err) {
        console.error("Excepción en notifyClientPaymentRejected:", err);
    }
}

/**
 * Notifica al cliente que ha culminado el pago de todas las cuotas de su vehículo.
 */
export async function notifyClientFinancingCompleted(userId, carName) {
    try {
        const title = '🎉 ¡Financiamiento Completado!';
        const message = `¡Enhorabuena! Has pagado el 100% de las cuotas de tu ${carName}. Gracias por tu responsabilidad y por confiar en nosotros.`;
        const targetUrl = 'payments.html';

        await sendUniqueNotification(userId, title, message, 'financing_completed', targetUrl);
    } catch (err) {
        console.error("Excepción en notifyClientFinancingCompleted:", err);
    }
}

/**
 * Función utilitaria/cron para verificar cuotas próximas a vencer o vencidas.
 * Puede ser invocada desde la carga de la app o un script programado.
 */
export async function checkAndNotifyPaymentDueDates() {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Notificar cuotas vencidas (estado sin_pagar y fecha anterior a hoy)
        const { data: overduePayments } = await supabase
            .from('financing_payments')
            .select(`
                id,
                amount_usd,
                installment_number,
                due_date,
                user_car_financings ( user_id, cars ( brand, model ) )
            `)
            .eq('status', 'sin_pagar')
            .lt('due_date', today);

        if (overduePayments && overduePayments.length > 0) {
            for (const pay of overduePayments) {
                const clientUserId = pay.user_car_financings?.user_id;
                const carInfo = pay.user_car_financings?.cars;
                const carName = carInfo ? `${carInfo.brand} ${carInfo.model}` : 'tu vehículo';

                if (clientUserId) {
                    await sendUniqueNotification(
                        clientUserId,
                        '⚠️ Cuota Vencida',
                        `Tu Cuota N° ${pay.installment_number} ($${pay.amount_usd} USD) del ${carName} venció el ${pay.due_date}. Por favor realiza y reporta tu pago lo antes posible.`,
                        'payment_overdue',
                        `payments.html?payId=${pay.id}`
                    );
                }
            }
        }
    } catch (err) {
        console.error("Excepción en checkAndNotifyPaymentDueDates:", err);
    }
}