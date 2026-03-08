import { useState, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeContext } from './ThemeContext'

// Password rules — must match Supabase auth settings
const validatePassword = (pwd) => ({
  length:    pwd.length >= 8 && pwd.length <= 30,
  uppercase: /[A-Z]/.test(pwd),
  number:    /[0-9]/.test(pwd),
  symbol:    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd),
})

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  const { theme } = useContext(ThemeContext)
  const dark = theme === 'night'

  // Theme-aware tokens for inline styles
  const toggleColor      = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'
  const checklistBg     = dark ? 'rgba(13,15,20,0.98)'    : '#ffffff'
  const checklistBorder = 'rgba(124,58,237,0.3)'
  const checkUnmetCircle = dark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.18)'
  const checkUnmetLabel  = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isLogin && !termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to continue.')
      return
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!isLogin) {
      const pwdCheck = validatePassword(password)
      if (!pwdCheck.length) {
        setError('Password must be between 8 and 30 characters')
        return
      }
      if (!pwdCheck.uppercase) {
        setError('Password must contain at least one uppercase letter')
        return
      }
      if (!pwdCheck.number) {
        setError('Password must contain at least one number')
        return
      }
      if (!pwdCheck.symbol) {
        setError('Password must contain at least one special character')
        return
      }
    } else {
      // Login: keep the minimal check so existing short passwords still work
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password,
        })

        if (error) throw error

        // Check if user has completed profile setup
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          console.error('Error fetching profile:', profileError)
        }

        if (!profile?.first_name || !profile?.last_name) {
          navigate('/profile-setup')
        } else {
          navigate('/dashboard')
        }
      } else {
        // NOTE: Email confirmations are OFF in Supabase Auth settings while a
        // custom domain is pending. Supabase returns an active session immediately.
        // TODO: when domain is ready, re-add emailRedirectTo + the emailSent screen,
        //       then re-enable "Confirm email" in Supabase Auth > Settings.
        const { data, error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password: password,
        })

        if (error) throw error

        if (data?.user) {
          navigate('/profile-setup')
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 'https://ijgf-website-one.vercel.app'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) throw error
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google')
    }
  }

  return (