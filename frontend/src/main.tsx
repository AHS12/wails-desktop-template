import React from 'react'
import {createRoot} from 'react-dom/client'
import './styles/app.css'
import {App} from './app/App'
import {FEATURES} from './features'
import {connectShell} from './platform/shell'
import {registerFeatures} from './shell/feature'

registerFeatures(FEATURES)

const container = document.getElementById('root')

// Inside the app, Go and the window are reached once the shell is connected, so
// nothing is drawn before then.
void connectShell().then(() => {
    createRoot(container!).render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    )
})
