import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  // Fail fast in dev if the key is missing so Clerk doesn't silently misconfigure
  // eslint-disable-next-line no-console
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is not set. Clerk will not be initialized.')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
