import { useEffect, useState } from 'react'
import './LoadingScreen.css'
import LoadingImg1 from './assets/loading_flat.jpeg'
import LoadingImg2 from './assets/loading_jump.jpeg'

interface LoadingScreenProps {
  isVisible: boolean
}

function LoadingScreen({ isVisible }: LoadingScreenProps): JSX.Element {
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setImageIndex(prev => (prev + 1) % 2)
    }, 600) // Switch images every 600ms

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return <></>

  const images = [LoadingImg1, LoadingImg2]

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <img src={images[imageIndex]} alt="Loading..." className="loading-image" />
        {/* <p className="loading-text">loading...</p> */}
      </div>
    </div>
  )
}

export default LoadingScreen
