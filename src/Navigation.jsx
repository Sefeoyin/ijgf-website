import { useNavigate } from 'react-router-dom'

function Navigation() {
  const navigate = useNavigate()

  return (
    <nav className="nav">
      <div className="nav-container">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/images/logo.png" alt="IJGF" className="logo-img" />
        </div>
        <button className="join-btn-nav" onClick={() => navigate('/waitlist')}>
          Join Waitlist
        </button>
      </div>
    </nav>
  )
}

export default Navigation
