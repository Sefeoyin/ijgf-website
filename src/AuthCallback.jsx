import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import LoadingAnimation from './LoadingAnimation'

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) throw error

        if (session) {
          // Check if profile exists and is complete
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', session.user.id)
            .single()

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError)
          }

          // If no profile or incomplete, go to setup; otherwise go to dashboard
          if (!profile || !profile.first_name || !profile.last_name) {
            navigate('/profile-setup')
          } else {
            navigate('/dashboard')
          }
        } else {
          navigate('/login')
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        navigate('/login')
      }
    }

    handleCallback()
  }, [navigate])

  return <LoadingAnimation />
}

export default AuthCallback