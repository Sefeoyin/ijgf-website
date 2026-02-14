import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function ProfilePage({ isSetup = false }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profileImage, setProfileImage] = useState(null)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        navigate('/login')
        return
      }

      setUser(user)
      setEmail(user.email)
      console.log('User loaded:', user.id)

      // Load profile data
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
        console.log('Profile loaded:', profile)
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setProfileImageUrl(profile.profile_image || '')
      } else {
        console.log('No profile found, will create one')
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    // Check file type
    if (!file.type.match(/image\/(png|jpeg|jpg|gif)/)) {
      alert('Please upload a PNG, JPEG, or GIF image')
      return
    }

    try {
      setUploading(true)

      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(data.path)

      console.log('Image uploaded:', publicUrl)
      setProfileImageUrl(publicUrl)
      setProfileImage(file)
    } catch (err) {
      console.error('Error uploading image:', err)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (profileImageUrl && user) {
      try {
        // Extract path from URL
        const path = profileImageUrl.split('/profile-images/').pop()
        
        // Delete from storage
        await supabase.storage
          .from('profile-images')
          .remove([path])
        
        console.log('Image removed from storage')
      } catch (err) {
        console.error('Error removing image:', err)
      }
    }
    
    setProfileImage(null)
    setProfileImageUrl('')
  }

  const handleSave = async () => {
    if (!user) {
      alert('Not logged in')
      return
    }

    if (!firstName.trim() || !lastName.trim()) {
      alert('Please enter your first and last name')
      return
    }

    setLoading(true)

    try {
      console.log('Saving profile for user:', user.id)
      console.log('Data:', { firstName, lastName, profileImageUrl })

      // Update profile in database
      const { data, error } = await supabase
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

      console.log('Profile saved successfully:', data)
      alert('Profile saved!')

      // Navigate to dashboard
      navigate('/dashboard')
    } catch (err) {
      console.error('Error saving profile:', err)
      alert(`Failed to save profile: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (isSetup) {
      // If it's setup and they cancel, log them out
      await supabase.auth.signOut()
      navigate('/')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="profile-page">
      {/* Logo Header for Profile Setup */}
      {isSetup && (
        <div className="auth-logo-header">
          <a href="/" className="auth-logo-link">
            <img src="/images/logo-icon.png" alt="IJGF" className="auth-logo-icon" />
            <span className="auth-logo-text">IJGF</span>
          </a>
        </div>
      )}
      
      <div className="profile-container">
        <h1 className="profile-title">Setup your profile</h1>

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
              <p className="profile-input-note">Manage your password settings</p>
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