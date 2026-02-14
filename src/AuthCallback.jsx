import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      // Get the session from the URL hash
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) throw error

      if (session) {
        console.log('Auth callback - session found:', session.user.id)

        // Check if profile exists and is complete
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError)
        }

        console.log('Profile data:', profile)

        // If no profile or incomplete, go to setup; otherwise go to dashboard
        if (!profile || !profile.first_name || !profile.last_name) {
          console.log('Profile incomplete, redirecting to setup')
          navigate('/profile-setup')
        } else {
          console.log('Profile complete, redirecting to dashboard')
          navigate('/dashboard')
        }
      } else {
        // No session, redirect to login
        console.log('No session found, redirecting to login')
        navigate('/login')
      }
    } catch (err) {
      console.error('Auth callback error:', err)
      navigate('/login')
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        border: '4px solid #f3f4f6', 
        borderTop: '4px solid #7c3aed',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ color: 'var(--text-secondary)' }}>Completing sign in...</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default AuthCallback
