import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import { Provider } from '@/components/ui/provider'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>,
)
