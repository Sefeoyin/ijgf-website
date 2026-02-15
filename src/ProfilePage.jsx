import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeContext } from './ThemeContext'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function ProfilePage({ isSetup = false }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useContext(ThemeContext)
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
    setSuccess('')

    console.log('Starting image upload...', { fileName: file.name, fileSize: file.size })

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

      console.log('Uploading to Supabase storage...', { fileName })

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      console.log('Upload successful:', data)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(data.path)

      console.log('Public URL generated:', publicUrl)

      // Update state
      setProfileImageUrl(publicUrl)

      // Save to database immediately
      console.log('Saving to database...', { userId: user.id, publicUrl })

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_image: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Database update error:', updateError)
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      console.log('Profile image saved successfully!')
      setSuccess('Profile image uploaded successfully!')
    } catch (err) {
      console.error('Error uploading image:', err)
      
      // Provide specific error messages
      let errorMessage = 'Failed to upload image. '
      
      if (err.message.includes('Bucket not found')) {
        errorMessage += 'The storage bucket "profile-images" does not exist. Please create it in your Supabase dashboard.'
      } else if (err.message.includes('permission')) {
        errorMessage += 'Permission denied. Please check your storage policies in Supabase.'
      } else if (err.message.includes('profile_image')) {
        errorMessage += 'The "profile_image" column may not exist in your profiles table. Please add it.'
      } else {
        errorMessage += err.message
      }
      
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!user) return

    setError('')
    setSuccess('')

    try {
      setUploading(true)

      // Remove from storage if exists
      if (profileImageUrl) {
        const path = profileImageUrl.split('/profile-images/').pop()
        if (path) {
          await supabase.storage.from('profile-images').remove([path])
        }
      }

      // Update state
      setProfileImageUrl('')

      // Save to database immediately
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_image: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess('Profile image removed successfully!')
    } catch (err) {
      console.error('Error removing image:', err)
      setError('Failed to remove image. Please try again.')
    } finally {
      setUploading(false)
    }
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
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'night' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'night' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            )}
          </button>
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
