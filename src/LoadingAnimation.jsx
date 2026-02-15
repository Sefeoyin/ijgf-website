function LoadingAnimation({ message = 'Loading...' }) {
  return (
    <div className="loading-container">
      <div className="candlestick-chart">
        <div className="candlestick candlestick-1 green">
          <div className="wick"></div>
          <div className="body"></div>
        </div>
        <div className="candlestick candlestick-2 red">
          <div className="wick"></div>
          <div className="body"></div>
        </div>
        <div className="candlestick candlestick-3 green">
          <div className="wick"></div>
          <div className="body"></div>
        </div>
        <div className="candlestick candlestick-4 red">
          <div className="wick"></div>
          <div className="body"></div>
        </div>
        <div className="candlestick candlestick-5 green">
          <div className="wick"></div>
          <div className="body"></div>
        </div>
      </div>
      <p className="loading-message">{message}</p>
    </div>
  )
}

export default LoadingAnimation
