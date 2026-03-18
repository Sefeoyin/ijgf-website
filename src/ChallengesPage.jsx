import { useNavigate } from 'react-router-dom'
import { useScrollAnimation } from './useScrollAnimation'
import { ChallengeConfigPanel } from './ChallengeConfigPanel'

function ChallengesPage() {
  const navigate = useNavigate()
  useScrollAnimation()

  return (
    <section className="challenges-page">
      <div className="section-container">
        {/* Header */}
        <div className="challenges-header">
          <h1 className="challenges-title">Choose Your Challenge</h1>
          <p className="challenges-subtitle">
            Choose your path to becoming a funded trader. All challenges include the same core evaluation metrics with varying capital sizes.
          </p>
        </div>

        {/* Interactive challenge selector — toggle, size, phases, fee */}
        <ChallengeConfigPanel onStart={() => navigate('/signup')} />
      </div>
    </section>
  )
}

export default ChallengesPage
