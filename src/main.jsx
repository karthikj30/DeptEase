import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'
 
// Initialize OneSignal
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function(OneSignal) {
  try {
    console.log("OneSignal: Initializing for DebtEase...");
    await OneSignal.init({
      appId: "a097dab5-fd1e-4601-8972-6b6b4b1b3c77",
      serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/push/onesignal/" },
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: true,
      },
    });

    const isSubscribed = await OneSignal.User.PushSubscription.optedIn;
    console.log("OneSignal: Subscribed Status:", isSubscribed);
    console.log("OneSignal: Notification Permission:", Notification.permission);

    if (!isSubscribed) {
      console.log("OneSignal: Not subscribed, attempting to show sliding prompt...");
      OneSignal.SlidingPrompt.show();
    }
  } catch (err) {
    console.error("OneSignal Initialization Error:", err);
  }
});

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
