import { createRoot } from 'react-dom/client'
import './index.css'
import './knights/KnightsApp.css'
import KnightsApp from './knights/KnightsApp.jsx'

createRoot(document.getElementById('root')).render(<KnightsApp />)
