import { useState } from "react";
import { Link } from "react-router-dom";

const VIDEOS = [
  "/videos/Background1.mp4",
  "/videos/Background2.mp4",
  "/videos/Background3.mp4",
  "/videos/Background4.mp4",
];

const MESSAGES = [
  "Follow adventurers",
  "Power athletes",
  "Encourage artists",
  "Support podcasts",
];

export function LandingPage() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const handleVideoEnded = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % VIDEOS.length);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white overflow-hidden">
      
      {/* Background Video Layer */}
      <div className="absolute inset-0 z-0">
        <video
          key={VIDEOS[currentVideoIndex]}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          onEnded={handleVideoEnded}
        >
          <source src={VIDEOS[currentVideoIndex]} type="video/mp4" />
        </video>
        {/* Dark Overlay to make text readable */}
        <div className="absolute inset-0 bg-slate-900/70" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <p className="mb-8 text-5xl md:text-7xl font-oracle font-semibold tracking-tight text-white drop-shadow-2xl h-24 flex items-center justify-center">
            {MESSAGES[currentVideoIndex]}
        </p>
        <Link to="/app" className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors font-medium text-lg">
          Launch App
        </Link>
      </div>
    </div>
  );
}
