import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeContext } from './ThemeContext'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Belarus','Belgium','Belize',
  'Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei',
  'Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti',
  'Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea',
  'Estonia','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany',
  'Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives',
  'Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia',
  'Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman','Pakistan','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia',
  'Sierra Leone','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Taiwan',
  'Tajikistan','Tanzania','Thailand','Togo','Trinidad and Tobago','Tunisia','Turkey',
  'Turkmenistan','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
]

const LANGUAGES = [
  'English','Arabic','Chinese (Simplified)','Chinese (Traditional)','Dutch','French',
  'German','Hindi','Indonesian','Italian','Japanese','Korean','Malay','Persian',
  'Polish','Portuguese','Russian','Spanish','Swahili','Thai','Turkish','Ukrainian',
  'Urdu','Vietnamese'
]

const INSTRUMENTS = ['Spot', 'Futures', 'Forex', 'Stocks', 'Options']

const EXPERIENCE_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 year' },
  { value: '1_to_3',      label: '1 – 3 years'      },
  { value: '3_to_5',      label: '3 – 5 years'      },
  { value: '5_plus',      label: '5+ years'          },
]

function ProfilePage({ isSetup = false }) {
  const navigate   = useNavigate()
  const { theme, toggleTheme } = useContext(ThemeContext)
  const [user,      setUser]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  const [profileImageUrl,   setProfileImageUrl]   = useState('')
  const [firstName,         setFirstName]         = useState('')
  const [lastName,          setLastName]          = useState('')
  const [username,          setUsername]          = useState('')
  const [email,             setEmail]             = useState('')
  const [country,           setCountry]           = useState('')
  const [dateOfBirth,       setDateOfBirth]       = useState('')
  const [phone,             setPhone]             = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState('English')
  const [yearsExperience,   setYearsExperience]   = useState('')
  const [instrumentsTraded, setInstrumentsTraded] = useState([])
  const [payoutCurrency,    setPayoutCurrency]    = useState('USDC')
  const [payoutNetwork,     setPayoutNetwork]     = useState('TRC-20')
  const [walletAddress,     setWalletAddress]     = useState('')

  useEffect(() => { loadUserData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)
      setEmail(user.email)

      const { data: profile, error } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (error && error.code !== 'PGRST116') { console.error('Error loading profile:', error); return }

      if (profile) {
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setUsername(profile.username || '')
        setProfileImageUrl(profile.profile_image || '')
        setCountry(profile.country || '')
        setDateOfBirth(profile.date_of_birth || '')
        setPhone(profile.phone || '')
        setPreferredLanguage(profile.preferred_language || 'English')
        setYearsExperience(profile.years_experience || '')
        setInstrumentsTraded(profile.instruments_traded || [])
        setPayoutCurrency(profile.payout_currency || 'USDC')
        setPayoutNetwork(profile.payout_network || 'TRC-20')
        setWalletAddress(profile.wallet_address || '')
      }
    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }

  const handleInstrumentToggle = (inst) =>
    setInstrumentsTraded(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    )

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return
    setError(''); setSuccess('')
    if (file.size > MAX_FILE_SIZE_BYTES) { setError('File size must be less than 10MB'); return }
    if (!file.type.match(/image\/(png|jpeg|jpg|gif)/)) { setError('Please upload a PNG, JPEG, or GIF image'); return }
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const { data, error: uploadError } = await supabase.storage
        .from('profile-images').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)
      const { data: { publicUrl } } = supabase.storage.from('profile-images').getPublicUrl(data.path)
      setProfileImageUrl(publicUrl)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateError) throw new Error(`Database update failed: ${updateError.message}`)
      setSuccess('Profile image uploaded!')
    } catch (err) {
      setError(
        err.message.includes('Bucket not found')
          ? 'Storage bucket "profile-images" not found. Please create it in Supabase.'
          : `Failed to upload image: ${err.message}`
      )
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!user) return
    setError(''); setSuccess('')
    try {
      setUploading(true)
      if (profileImageUrl) {
        const path = profileImageUrl.split('/profile-images/').pop()
        if (path) await supabase.storage.from('profile-images').remove([path])
      }
      setProfileImageUrl('')
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image: null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateError) throw updateError
      setSuccess('Profile image removed.')
    } catch (err) {
      setError('Failed to remove image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!user)             { setError('Not logged in'); return }
    if (!firstName.trim()) { setError('First name is required'); return }
    if (!lastName.trim())  { setError('Last name is required'); return }
    if (!username.trim())  { setError('Username is required'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return }
    if (!country)          { setError('Please select your country'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.from('profiles').upsert({
        id:                 user.id,
        email,
        first_name:         firstName.trim(),
        last_name:          lastName.trim(),
        username:           username.trim().toLowerCase(),
        profile_image:      profileImageUrl || null,
        country,
        date_of_birth:      dateOfBirth     || null,
        phone:              phone.trim()    || null,
        preferred_language: preferredLanguage,
        years_experience:   yearsExperience || null,
        instruments_traded: instrumentsTraded,
        payout_currency:    payoutCurrency,
        payout_network:     payoutNetwork,
        wallet_address:     walletAddress.trim() || null,
        updated_at:         new Date().toISOString()
      }, { onConflict: 'id' }).select()
      if (error) throw error
      setSuccess('Profile saved successfully!')
      if (isSetup) navigate('/dashboard')
    } catch (err) {
      if (err.code === '23505' || err.message?.includes('unique') || err.message?.includes('duplicate')) {
        setError('That username is already taken. Please choose another.')
      } else {
        setError(`Failed to save profile: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (isSetup) { await supabase.auth.signOut(); navigate('/') }
  }

  const maxDob = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : 'Your Name'

  // ── Shared form blocks ────────────────────────────────────────────────────
  const FormBasicInfo = () => (
    <>
      <div className="profile-form-row">
        <div className="profile-input-group">
          <label>First Name <span className="required">*</span></label>
          <input type="text" placeholder="Dexter" value={firstName} onChange={e => setFirstName(e.target.value)} className="profile-input" />
        </div>
        <div className="profile-input-group">
          <label>Last Name <span className="required">*</span></label>
          <input type="text" placeholder="Ho" value={lastName} onChange={e => setLastName(e.target.value)} className="profile-input" />
        </div>
      </div>
      <div className="profile-form-row">
        <div className="profile-input-group" style={{ marginBottom: 0 }}>
          <label>Username <span className="required">*</span></label>
          <input type="text" placeholder="dexterho" value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            className="profile-input" maxLength={30} />
          <p className="profile-input-note">Shown on leaderboards. Lowercase, min. 3 chars.</p>
        </div>
        <div className="profile-input-group" style={{ marginBottom: 0 }}>
          <label>Email</label>
          <input type="email" value={email} className="profile-input" readOnly />
          <p className="profile-input-note">Cannot be changed here.</p>
        </div>
      </div>
    </>
  )

  const FormPersonalDetails = () => (
    <>
      <div className="profile-form-row">
        <div className="profile-input-group">
          <label>Country <span className="required">*</span></label>
          <select value={country} onChange={e => setCountry(e.target.value)} className="profile-input profile-select">
            <option value="">Select country</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="profile-input-group">
          <label>Date of Birth</label>
          <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="profile-input" max={maxDob} />
          <p className="profile-input-note">Must be 18 or older.</p>
        </div>
      </div>
      <div className="profile-form-row">
        <div className="profile-input-group" style={{ marginBottom: 0 }}>
          <label>Phone Number</label>
          <input type="tel" placeholder="+1 234 567 8900" value={phone} onChange={e => setPhone(e.target.value)} className="profile-input" />
        </div>
        <div className="profile-input-group" style={{ marginBottom: 0 }}>
          <label>Preferred Language</label>
          <select value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)} className="profile-input profile-select">
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </>
  )

  const FormTrading = () => (
    <>
      <div className="profile-input-group">
        <label>Years of Experience</label>
        <select value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} className="profile-input profile-select" style={{ maxWidth: 300 }}>
          <option value="">Select level</option>
          {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="profile-input-group" style={{ marginBottom: 0 }}>
        <label>Instruments Previously Traded</label>
        <div className="profile-checkbox-group">
          {INSTRUMENTS.map(inst => (
            <label key={inst} className="profile-checkbox-item">
              <input type="checkbox" checked={instrumentsTraded.includes(inst)} onChange={() => handleInstrumentToggle(inst)} className="profile-checkbox" />
              <span>{inst}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  )

  const FormPayout = () => (
    <>
      <div className="profile-form-row">
        <div className="profile-input-group">
          <label>Payout Currency</label>
          <select value={payoutCurrency} onChange={e => setPayoutCurrency(e.target.value)} className="profile-input profile-select">
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
        <div className="profile-input-group">
          <label>Network</label>
          <select value={payoutNetwork} onChange={e => setPayoutNetwork(e.target.value)} className="profile-input profile-select">
            <option value="TRC-20">TRC-20 (Tron)</option>
            <option value="ERC-20">ERC-20 (Ethereum)</option>
            <option value="BEP-20">BEP-20 (BSC)</option>
          </select>
        </div>
      </div>
      <div className="profile-input-group" style={{ marginBottom: 0 }}>
        <label>Wallet Address</label>
        <input type="text" placeholder="Your USDC / USDT wallet address" value={walletAddress} onChange={e => setWalletAddress(e.target.value)} className="profile-input" />
        <p className="profile-input-note">Double-check — payouts sent here cannot be recovered.</p>
      </div>
    </>
  )

  // ── Setup view (standalone page, centered) ───────────────────────────────
  if (isSetup) {
    return (
      <div className="profile-setup-page">
        <div className="auth-logo-header">
          <a href="/" className="auth-logo-link">
            <img src="/images/logo-icon.png" alt="IJGF" className="auth-logo-icon" />
          </a>
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'night'
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            }
          </button>
        </div>

        <div className="psetup-wrapper">
          <div className="psetup-heading">
            <h1>Set up your profile</h1>
            <p>Fill in your details to get started. Fields marked <span className="required">*</span> are required.</p>
          </div>

          {error   && <div className="auth-error-message">{error}</div>}
          {success && <div className="success-message">&#10003; {success}</div>}

          {/* Avatar row */}
          <div className="psetup-avatar-row">
            <div className="psetup-avatar">
              {profileImageUrl
                ? <img src={profileImageUrl} alt="Profile" />
                : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
              }
            </div>
            <div>
              <p className="psetup-avatar-name">{displayName}</p>
              <div className="profile-picture-actions" style={{ marginBottom: '0.5rem' }}>
                <label className="btn-upload-image">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {uploading ? 'Uploading...' : 'Upload photo'}
                  <input type="file" accept="image/png,image/jpeg,image/gif" onChange={handleImageUpload} disabled={uploading} hidden />
                </label>
                {profileImageUrl && (
                  <button className="btn-remove-image" onClick={handleRemoveImage} disabled={uploading}>Remove</button>
                )}
              </div>
              <p className="profile-picture-note">PNG, JPEG, or GIF under 10MB</p>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="psetup-grid">
            <div className="psetup-col">
              <div className="psetup-card">
                <h3 className="psetup-card-title">Basic Information</h3>
                <FormBasicInfo />
              </div>
              <div className="psetup-card">
                <h3 className="psetup-card-title">Trading Background</h3>
                <FormTrading />
              </div>
            </div>
            <div className="psetup-col">
              <div className="psetup-card">
                <h3 className="psetup-card-title">Personal Details</h3>
                <FormPersonalDetails />
              </div>
              <div className="psetup-card">
                <h3 className="psetup-card-title">Payout Information</h3>
                <p className="profile-input-note" style={{ marginBottom: '1.25rem', marginTop: '-0.5rem' }}>Required before your first withdrawal.</p>
                <FormPayout />
              </div>
            </div>
          </div>

          <div className="psetup-actions">
            <button className="btn-cancel" onClick={handleCancel} disabled={loading}>Cancel</button>
            <button className="btn-save" onClick={handleSave} disabled={loading || uploading}>
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard profile view (full width, two-column) ───────────────────────
  return (
    <div className="profile-dash-page">

      {error   && <div className="auth-error-message profile-alert">{error}</div>}
      {success && <div className="success-message profile-alert">&#10003; {success}</div>}

      <div className="profile-dash-layout">

        {/* Left panel */}
        <aside className="profile-dash-sidebar">
          <div className="profile-dash-avatar-wrap">
            <div className="profile-dash-avatar">
              {profileImageUrl
                ? <img src={profileImageUrl} alt={displayName} />
                : <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
              }
              <label className="profile-dash-avatar-overlay" title="Change photo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <input type="file" accept="image/png,image/jpeg,image/gif" onChange={handleImageUpload} disabled={uploading} hidden />
              </label>
            </div>
            <h2 className="profile-dash-name">{displayName}</h2>
            {username && <p className="profile-dash-username">@{username}</p>}
            {country && (
              <p className="profile-dash-country">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {country}
              </p>
            )}
            {profileImageUrl && (
              <button className="profile-dash-remove-photo" onClick={handleRemoveImage} disabled={uploading}>
                Remove photo
              </button>
            )}
          </div>

          <div className="profile-dash-meta">
            <div className="profile-dash-meta-item">
              <span className="profile-dash-meta-label">Email</span>
              <span className="profile-dash-meta-val">{email}</span>
            </div>
            {preferredLanguage && (
              <div className="profile-dash-meta-item">
                <span className="profile-dash-meta-label">Language</span>
                <span className="profile-dash-meta-val">{preferredLanguage}</span>
              </div>
            )}
            {yearsExperience && (
              <div className="profile-dash-meta-item">
                <span className="profile-dash-meta-label">Experience</span>
                <span className="profile-dash-meta-val">
                  {EXPERIENCE_OPTIONS.find(o => o.value === yearsExperience)?.label || yearsExperience}
                </span>
              </div>
            )}
            {payoutCurrency && (
              <div className="profile-dash-meta-item">
                <span className="profile-dash-meta-label">Payout</span>
                <span className="profile-dash-meta-val">{payoutCurrency} · {payoutNetwork}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Right form area */}
        <div className="profile-dash-form">
          <div className="profile-dash-card">
            <h3 className="profile-dash-card-title">Basic Information</h3>
            <FormBasicInfo />
          </div>

          <div className="profile-dash-card">
            <h3 className="profile-dash-card-title">Personal Details</h3>
            <FormPersonalDetails />
          </div>

          <div className="profile-dash-card">
            <h3 className="profile-dash-card-title">Trading Background</h3>
            <FormTrading />
          </div>

          <div className="profile-dash-card">
            <h3 className="profile-dash-card-title">Payout Information</h3>
            <p className="profile-input-note" style={{ marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
              Required before your first withdrawal request.
            </p>
            <FormPayout />
          </div>

          <div className="profile-dash-card">
            <h3 className="profile-dash-card-title">Security</h3>
            <div className="profile-password-section" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
              <div className="profile-password-header">
                <div>
                  <label>Password</label>
                  <p className="profile-input-note">Log in with your password instead of temporary codes.</p>
                </div>
                <button className="btn-change-password" onClick={() => navigate('/reset-password')}>
                  Change Password
                </button>
              </div>
              <input type="password" value="••••••••" className="profile-input" readOnly />
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn-save" onClick={handleSave} disabled={loading || uploading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
