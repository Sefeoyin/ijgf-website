import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Processing...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from the URL query params
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
          console.error('OAuth error:', error, errorDescription)
          setStatus('Authentication failed. Redirecting...')
          setTimeout(() => navigate('/login'), 2000)
          return
        }

        if (code) {
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.error('Exchange error:', exchangeError)
            setStatus('Session error. Redirecting...')
            setTimeout(() => navigate('/login'), 2000)
            return
          }

          if (data?.user) {
            // Check if the user has a profile set up
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', data.user.id)
              .single()

            if (!profile?.first_name || !profile?.last_name) {
              navigate('/profile-setup')
            } else {
              navigate('/dashboard')
            }
            return
          }
        }

        // If no code, try to get existing session (hash-based flow fallback)
        const { data: sessionData } = await supabase.auth.getSession()

        if (sessionData?.session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', sessionData.session.user.id)
            .single()

          if (!profile?.first_name || !profile?.last_name) {
            navigate('/profile-setup')
          } else {
            navigate('/dashboard')
          }
          return
        }

        // Nothing worked, send back to login
        setStatus('Could not verify session. Redirecting...')
        setTimeout(() => navigate('/login'), 2000)

      } catch (err) {
        console.error('Callback error:', err)
        setStatus('Unexpected error. Redirecting...')
        setTimeout(() => navigate('/login'), 2000)
      }
    }

    handleCallback()
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