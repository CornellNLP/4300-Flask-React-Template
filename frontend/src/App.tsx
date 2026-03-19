import SearchPage from './SearchPage'
import './App.css'

function App(): JSX.Element {
  const handleBack = () => {
    // Do nothing - no landing page
  }
  
  return <SearchPage onBack={handleBack} />
}

export default App
