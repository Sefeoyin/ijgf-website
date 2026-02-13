import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function ProfilePage({ isSetup = false }) {
  const navigate = useNavigate()
  const [profileImage, setProfileImage] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('********')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load user data from localStorage
    const userEmail = localStorage.getItem('userEmail') || ''
    setEmail(userEmail)
  }, [])

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.size < 10 * 1024 * 1024) { // 10MB limit
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfileImage(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setProfileImage(null)
  }

  const handleSave = () => {
    setLoading(true)
    
    // Save user data
    localStorage.setItem('userFirstName', firstName)
    localStorage.setItem('userLastName', lastName)
    localStorage.setItem('profileImage', profileImage || '')
    localStorage.setItem('isNewUser', 'false')
    
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 1000)
  }

  const handleCancel = () => {
    if (isSetup) {
      // If it's setup and they cancel, log them out
      localStorage.clear()
      navigate('/')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="profile-title">Setup your profile</h1>

        {/* Profile Picture */}
        <div className="profile-picture-section">
          <div className="profile-avatar">
            {profileImage ? (
              <img src={profileImage} alt="Profile" />
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
                Upload image
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/gif"
                  onChange={handleImageUpload}
                  hidden
                />
              </label>
              <button className="btn-remove-image" onClick={handleRemoveImage}>
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
            />
          </div>
        </div>

        {/* Email */}
        <div className="profile-input-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="profile-input"
            readOnly
          />
          <p className="profile-input-note">Used to log in to your account</p>
        </div>

        {/* Password */}
        <div className="profile-password-section">
          <div className="profile-password-header">
            <div>
              <label>Password</label>
              <p className="profile-input-note">Log in with your password instead of using temporary login codes</p>
            </div>
            <button 
              className="btn-change-password"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
            >
              Change Password
            </button>
          </div>
          <input
            type="password"
            value={password}
            className="profile-input"
            readOnly
          />
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          <button className="btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
