import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function ProfilePage({ isSetup = false }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate('/login')
        return
      }

      setUser(user)
      setEmail(user.email)

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
        return
      }

      if (profile) {
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setProfileImageUrl(profile.profile_image || '')
      }
    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return

    setError('')

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File size must be less than 10MB')
      return
    }

    if (!file.type.match(/image\/(png|jpeg|jpg|gif)/)) {
      setError('Please upload a PNG, JPEG, or GIF image')
      return
    }

    try {
      setUploading(true)

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(data.path)

      setProfileImageUrl(publicUrl)
    } catch (err) {
      console.error('Error uploading image:', err)
      setError('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (profileImageUrl && user) {
      try {
        const path = profileImageUrl.split('/profile-images/').pop()
        await supabase.storage.from('profile-images').remove([path])
      } catch (err) {
        console.error('Error removing image:', err)
      }
    }

    setProfileImageUrl('')
  }

  const handleSave = async () => {
    if (!user) {
      setError('Not logged in')
      return
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: email,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          profile_image: profileImageUrl || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()

      if (error) throw error

      setSuccess('Profile saved successfully!')
      navigate('/dashboard')
    } catch (err) {
      console.error('Error saving profile:', err)
      setError(`Failed to save profile: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (isSetup) {
      await supabase.auth.signOut()
      navigate('/')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="profile-page">
      {isSetup && (
        <div className="auth-logo-header">
          <a href="/" className="auth-logo-link">
            <img src="/images/logo-icon.png" alt="IJGF" className="auth-logo-icon" />
          </a>
        </div>
      )}

      <div className="profile-container">
        <h1 className="profile-title">Setup your profile</h1>

        {error && <div className="auth-error-message">{error}</div>}
        {success && <div className="success-message">&#10003; {success}</div>}

        {/* Profile Picture */}
        <div className="profile-picture-section">
          <div className="profile-avatar">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="Profile" />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </div>
          <div className="profile-picture-info">
            <h3>Profile Picture</h3>
            <div className="profile-picture-actions">
              <label className="btn-upload-image">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {uploading ? 'Uploading...' : 'Upload image'}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/gif"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  hidden
                />
              </label>
              <button
                className="btn-remove-image"
                onClick={handleRemoveImage}
                disabled={!profileImageUrl || uploading}
              >
                Remove
              </button>
            </div>
            <p className="profile-picture-note">We support PNGs, JPEGs, and GIFs under 10MB</p>
          </div>
        </div>

        {/* Name Fields */}
        <div className="profile-form-row">
          <div className="profile-input-group">
            <label>First Name</label>
            <input
              type="text"
              placeholder="Dexter"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="profile-input"
              required
            />
          </div>
          <div className="profile-input-group">
            <label>Last Name</label>
            <input
              type="text"
              placeholder="Ho"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="profile-input"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div className="profile-input-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            className="profile-input"
            readOnly
          />
          <p className="profile-input-note">Used to log in to your account</p>
        </div>

        {/* Password Section */}
        <div className="profile-password-section">
          <div className="profile-password-header">
            <div>
              <label>Password</label>
              <p className="profile-input-note">Log in with your password instead of using temporary login codes</p>
            </div>
            <button
              className="btn-change-password"
              onClick={() => navigate('/reset-password')}
            >
              Change Password
            </button>
          </div>
          <input
            type="password"
            value="********"
            className="profile-input"
            readOnly
          />
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          <button className="btn-cancel" onClick={handleCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave} disabled={loading || uploading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
