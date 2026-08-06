Pinch & Print – Gesture Photo Booth
A gesture‑only photo booth web application that lets users capture images using hand gestures detected by MediaPipe. The app features:

Two‑hand pinch to draw a live box around the area you want to capture.
Hold‑steady detection to lock the box.
Pinch‑Click or fist to trigger the shutter.
Film‑style effects (grayscale, contrast, grain, vignette).
Puzzle overlay – a 3×3 tile scramble that must be solved before the photo is saved to the strip.
Customizable strip themes (Retro, White, Wood, Noir).
Downloadable photo strip once three photos are captured.
Demo
Open index.html in a modern browser (Chrome/Edge) and allow camera access.

Project Structure
├── index.html      # Main HTML file – includes inline CSS and JS
├── style.css       # All styling extracted from the original page
├── README.md       # This document
Setup & Development
Clone the repository (or just open the folder).
Serve the files via a local web server (e.g., npx -y http-server ./ or any static file server).
Open the page in a browser and grant camera permissions.
