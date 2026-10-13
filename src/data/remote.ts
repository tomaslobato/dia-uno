import { supabase } from '@/lib/supabase';
import { decodeRecords, encodeMutation } from './records';
import type { Mutation } from './types';

export function remoteForUser(owner: string) {
  return { sync: async (pending: Mutation[]) => {
    const client = supabase;
    if (!client) throw new Error('Falta configurar Supabase.');
    const { data: auth } = await client.auth.getSession();
    if (auth.session?.user.id !== owner) throw new Error('La cuenta cambió. Los cambios siguen guardados para su usuario.');
    const { data, error } = await client.rpc('mejordia_sync', { operaciones: pending.map(encodeMutation) });
    if (error) {
      if (error.code === '23502' && error.message?.includes('lista_id')) throw new Error('Falta aplicar la actualización de listas opcionales en Supabase. Tus cambios siguen guardados aquí.');
      if (error.message?.includes('Acción inválida para listas')) throw new Error('Falta aplicar la actualización para renombrar y eliminar listas en Supabase. Tus cambios siguen guardados aquí.');
      if (pending.some((op) => op.entity === 'lists') && error.message?.includes('Cambio inválido')) throw new Error('Falta aplicar la actualización de listas en Supabase. Tus cambios siguen guardados aquí.');
      if (['PGRST202', '42P01', '42883'].includes(error.code)) throw new Error('El guardado en la nube aún no está disponible. Tus cambios siguen guardados en este dispositivo.');
      throw new Error('No pudimos sincronizar con Supabase. Tus cambios se conservan aquí y se enviarán al reconectar.');
    }
    const { data: current } = await client.auth.getSession();
    if (current.session?.user.id !== owner) throw new Error('La cuenta cambió durante la sincronización.');
    return decodeRecords(data, owner);
  } };
}
