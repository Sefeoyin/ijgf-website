import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Signing you in...')

  useEffect(() => {
    // Supabase PKCE flow handles the code exchange automatically.
    // We just need to wait for the SIGNED_IN event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single()

        if (!profile?.first_name || !profile?.last_name) {
          navigate('/profile-setup', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      }
    })

    // Fallback: session may already exist (e.g. page reload)
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single()

        if (!profile?.first_name || !profile?.last_name) {
          navigate('/profile-setup', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      }
    }

    checkExistingSession()

    // Safety timeout — redirect to login if stuck for 10s
    const timeout = setTimeout(() => {
      setStatus('Taking too long. Redirecting...')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: 'rgba(255,255,255,0.7)',
      gap: '1rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(124,58,237,0.3)',
        borderTop: '3px solid #7C3AED',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ fontSize: '0.95rem' }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default AuthCallback