import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Slide1() {
  return (
    <div className="h-screen w-screen bg-black relative flex flex-col items-center justify-center text-white overflow-hidden p-8">
      {/* Top Left: Logos */}
      <div className="absolute top-8 left-8 flex items-center gap-6 z-20">
        <img src="/images/suivre.png" alt="Suivre Logo" className="h-12 w-auto object-contain" />
        <div className="w-px h-8 bg-gray-700"></div>
        <img src="/images/partners.png" alt="Partners Logo" className="h-10 w-auto object-contain" />
      </div>

      {/* Top Right: Text */}
      <div className="absolute top-10 right-10 z-20">
        <span className="text-gray-500 font-bold text-lg tracking-wide">Suivre 2026</span>
      </div>

      {/* Top Center: Logo and Tagline */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4">
        <img src="/images/suivre.png" alt="Suivre Logo Center" className="h-[60px] w-auto object-contain" />
        <h2 className="text-2xl md:text-3xl font-normal text-gray-300 tracking-wide text-center">
          Fully support creators, avoid feeding the middleman.
        </h2>
      </div>

      {/* Center: Image with Blur */}
      <div className="relative group z-10 flex items-center justify-center mt-48">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-white/50 blur-[60px] rounded-full pointer-events-none opacity-90"></div>
        
        <img 
          src="/images/home.png" 
          alt="Home Illustration" 
          className="relative max-h-[50vh] w-auto object-contain drop-shadow-2xl brightness-110 contrast-110 hover:brightness-125 transition-all duration-700"
        />
      </div>
    </div>
  );
}

function Slide2() {
  return (
    <div className="h-screen w-screen bg-black relative flex flex-col items-start justify-center text-white overflow-hidden p-16">
      {/* Top Left: Logos */}
      <div className="absolute top-8 left-8 flex items-center gap-6 z-20">
        <img src="/images/suivre.png" alt="Suivre Logo" className="h-12 w-auto object-contain" />
        <div className="w-px h-8 bg-gray-700"></div>
        <img src="/images/partners.png" alt="Partners Logo" className="h-10 w-auto object-contain" />
      </div>

      {/* Top Right: Text */}
      <div className="absolute top-10 right-10 z-20">
        <span className="text-gray-500 font-bold text-lg tracking-wide">Suivre 2026</span>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-12 mt-20">
        <div className="md:col-span-1">
          <h2 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Goal
          </h2>
          <div className="h-1 w-20 bg-blue-600 mt-4"></div>
        </div>
        
        <div className="md:col-span-2 flex flex-col justify-center space-y-8 text-3xl font-light text-gray-300">
          <div className="flex items-start gap-4">
            <span className="text-blue-500 mt-1">01.</span>
            <p>Replicate the main functionality of the Patreon website</p>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-blue-500 mt-1">02.</span>
            <p>Use the Sui ecosystem to decentralize asset and resource management</p>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-blue-500 mt-1">03.</span>
            <p>Host the website online</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide3() {
  const techs = [
    "Mysten dApp Kit for React",
    "Walrus and Seal for encrypted storage",
    "Slush Wallet integration",
    "Move language"
  ];

  return (
    <div className="h-screen w-screen bg-black relative flex flex-col items-start justify-center text-white overflow-hidden p-16">
      {/* Top Left: Logos */}
      <div className="absolute top-8 left-8 flex items-center gap-6 z-20">
        <img src="/images/suivre.png" alt="Suivre Logo" className="h-12 w-auto object-contain" />
        <div className="w-px h-8 bg-gray-700"></div>
        <img src="/images/partners.png" alt="Partners Logo" className="h-10 w-auto object-contain" />
      </div>

      {/* Top Right: Text */}
      <div className="absolute top-10 right-10 z-20">
        <span className="text-gray-500 font-bold text-lg tracking-wide">Suivre 2026</span>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-12 gap-12 mt-10 items-center">
        {/* Title Section */}
        <div className="md:col-span-5">
          <h2 className="text-6xl font-bold text-white leading-tight">
            Used <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Technologies
            </span>
          </h2>
          <div className="h-1 w-24 bg-blue-500 mt-8 rounded-full"></div>
        </div>
        
        {/* List Section */}
        <div className="md:col-span-7 pl-8 border-l border-gray-800">
          <ul className="space-y-8">
            {techs.map((tech, index) => (
              <li key={index} className="flex items-center gap-6 group">
                <span className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-gray-900 border border-gray-800 text-blue-400 font-mono text-lg group-hover:border-blue-500/50 group-hover:bg-blue-500/10 transition-colors duration-300">
                  {index + 1}
                </span>
                <span className="text-3xl font-light text-gray-300 group-hover:text-white transition-colors duration-300">
                  {tech}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Slide4() {
  const steps = [
    "Connection with wallet",
    "Subscription to a creator",
    "Access to restricted content",
    "Content publication"
  ];

  return (
    <div className="h-screen w-screen bg-black relative flex flex-col items-start justify-center text-white overflow-hidden p-16">
      {/* Top Left: Logos */}
      <div className="absolute top-8 left-8 flex items-center gap-6 z-20">
        <img src="/images/suivre.png" alt="Suivre Logo" className="h-12 w-auto object-contain" />
        <div className="w-px h-8 bg-gray-700"></div>
        <img src="/images/partners.png" alt="Partners Logo" className="h-10 w-auto object-contain" />
      </div>

      {/* Top Right: Text */}
      <div className="absolute top-10 right-10 z-20">
        <span className="text-gray-500 font-bold text-lg tracking-wide">Suivre 2026</span>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-12 gap-12 mt-10 items-center">
        {/* Title Section */}
        <div className="md:col-span-5">
          <h2 className="text-6xl font-bold text-white leading-tight">
            Live <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              Demo
            </span>
          </h2>
          <div className="h-1 w-24 bg-green-500 mt-8 rounded-full"></div>
        </div>
        
        {/* List Section */}
        <div className="md:col-span-7 pl-8 border-l border-gray-800">
          <ul className="space-y-8">
            {steps.map((step, index) => (
              <li key={index} className="flex items-center gap-6 group">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 border border-gray-700 text-green-400 font-mono text-sm group-hover:border-green-500/50 group-hover:bg-green-500/10 transition-colors duration-300">
                  {index + 1}
                </span>
                <span className="text-3xl font-light text-gray-300 group-hover:text-white transition-colors duration-300">
                  {step}
                </span>
              </li>
            ))}
          </ul>
          
          <div className="mt-12">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/25"
            >
              Start Demo
              <span className="text-xl">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultSlide({ title, content, bgColor }: { title: string, content: string, bgColor: string }) {
  return (
    <div className={`h-screen w-screen flex flex-col items-center justify-center text-white transition-colors duration-500 ${bgColor}`}>
      <div className="max-w-4xl text-center p-8">
        <h1 className="text-6xl font-bold mb-8 drop-shadow-lg">{title}</h1>
        <p className="text-3xl leading-relaxed text-white/90 drop-shadow whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

export function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Using a component array allows us to mix custom complex slides with simple data-driven ones
  const slides = [
    <Slide1 key="intro" />,
    <Slide2 key="goals" />,
    <Slide3 key="tech" />,
    <Slide4 key="demo" />,
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
        setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "Backspace") {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]); // Dependency on slides.length is fine since slides is constant-ish

  return (
    <div className="relative h-screen w-screen overflow-hidden font-sans bg-black">
      {/* Slide Container */}
      <div className="absolute inset-0 transition-opacity duration-300 ease-in-out">
        {slides[currentSlide]}
      </div>
      
      {/* Navigation Controls / Indicators */}
      <div className="fixed bottom-8 right-8 text-xl font-mono text-white/50 mix-blend-difference z-50 select-none pointer-events-none">
        {currentSlide + 1} / {slides.length}
      </div>

      <div className="fixed bottom-8 left-8 flex gap-6 text-sm text-white/30 font-mono z-50 select-none">
        <button 
          onClick={() => setCurrentSlide(p => Math.max(0, p - 1))}
          className={`hover:text-white transition-opacity duration-300 ${currentSlide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          ← Previous
        </button>
        <button 
          onClick={() => setCurrentSlide(p => Math.min(slides.length - 1, p + 1))}
          className={`hover:text-white transition-opacity duration-300 ${currentSlide === slides.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
