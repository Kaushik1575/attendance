import { supabase } from './supabase'


export function subscribeToAttendance(sessionId, onInsert) {
    if (!supabase) {
        // Local mode: no realtime, caller must poll
        return () => { }
    }

    const channel = supabase
        .channel(`attendance-${sessionId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'attendance_records',
                filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
                onInsert(payload.new)
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}



export function subscribeToSession(sessionId, onChange) {
    if (!supabase) return () => { }

    const channel = supabase
        .channel(`session-${sessionId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'sessions',
                filter: `id=eq.${sessionId}`,
            },
            (payload) => {
                onChange(payload.new)
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}


export function subscribeToAllSessions(onChange) {
    if (!supabase) return () => { }

    const channel = supabase
        .channel('all-sessions')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' },
            (payload) => onChange(payload.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' },
            (payload) => onChange(payload.new))
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
