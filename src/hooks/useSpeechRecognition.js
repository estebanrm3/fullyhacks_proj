import {useState, useRef} from 'react'

export function useSpeechRecongnition() {
    const [listening, setListening] = useState(false)
    const [transcript, setTranscript] = useState("")
    const recRef = useRef(null)

    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecongnition' in window

    const startListening = () => {
        if(!supoprted) return
        const SR = window.SpeechRecongnition || window.webkitSpeechRecongnition
        recRef.current = new SR()
        recRef.current.lang = 'en-US'
        recRef.current.contin
    }
}