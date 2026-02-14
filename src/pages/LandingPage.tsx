import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent, Button } from "@ui";
import { useGetAllCreators } from "@hooks/useGetAllCreators";

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

function TypewriterText({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const typeSpeed = isDeleting ? 50 : 100;
    const holdTime = 2000;

    if (!isDeleting && displayText === text) {
      // Finished typing, wait then delete
      timeout = setTimeout(() => setIsDeleting(true), holdTime);
    } else if (isDeleting && displayText === "") {
      // Finished deleting, stay empty (or could trigger next video externally, but we rely on video time)
    } else {
      // Typing or deleting
      timeout = setTimeout(() => {
        const nextTarget = isDeleting 
          ? text.substring(0, displayText.length - 1)
          : text.substring(0, displayText.length + 1);
        setDisplayText(nextTarget);
      }, typeSpeed);
    }
    
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, text]);

  // Reset when text prop changes (new video)
  useEffect(() => {
    setDisplayText("");
    setIsDeleting(false);
  }, [text]);

  // Split only for display, but keep typing logic on the full string so it flows naturally?
  const words = displayText.split(" ");
  
  return (
    <span className="whitespace-pre-line">
      {words.map((word, i) => (
        <span key={i}>
          {word}
          {i < words.length - 1 ? (text.includes(" ") ? <br /> : " ") : ""} 
        </span>
      ))}
    </span>
  );
}

function CreatorShowcase() {
  const { data: creators = [], isLoading } = useGetAllCreators();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (creators.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % creators.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [creators.length]);

  if (isLoading) {
    return (
      <div className="w-full max-w-sm">
        <Card className="border-white/5 bg-slate-800/50 animate-pulse h-[200px]">
           <CardContent className="h-full flex items-center justify-center">
             <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
           </CardContent>
        </Card>
      </div>
    );
  }
  
  const validCreators = creators.length > 0 ? creators : [];

  if (validCreators.length === 0) {
      return (
        <div className="w-full max-w-sm">
             <Card className="border-white/5 bg-slate-800/50">
               <CardContent className="pt-6 text-center text-slate-400">
                  Join our growing community of creators.
               </CardContent>
             </Card>
        </div>
      );
  }

  const creator = validCreators[currentIndex];

  return (
    <div className="w-full max-w-sm">
       <Card
            key={creator.id} 
            className="transition-all duration-500 bg-slate-800/80 backdrop-blur border-white/10 hover:border-indigo-500/30 group shadow-2xl relative overflow-hidden"
        >
            <CardContent className="pt-6 space-y-4 relative z-10">
              <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-14 h-14 overflow-hidden rounded-full bg-slate-700 ring-2 ring-white/10 group-hover:ring-indigo-500/50 transition-all">
                  <img
                      src={creator.image_url || "https://avatar.iran.liara.run/public"}
                      alt={creator.pseudo}
                      className="object-cover w-full h-full"
                  />
                  </div>
                  <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold truncate text-white group-hover:text-indigo-300 transition-colors">
                      {creator.pseudo}
                  </h3>
                  <p className="text-xs truncate text-slate-400 font-mono">{creator.owner}</p>
                  </div>
              </div>
              
              <p className="text-sm leading-relaxed text-slate-300 line-clamp-3 min-h-[4.5em]">
                  {creator.description || "No description provided."}
              </p>
              
              <Link to="/app" className="block w-full">
                  <Button
                  variant="outline"
                  className="w-full mt-2 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all"
                  >
                  View Profile
                  </Button>
              </Link>
            </CardContent>
        </Card>
    </div>
  );
}

function HeroSection() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const handleVideoEnded = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % VIDEOS.length);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
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
        <div className="absolute inset-0 bg-slate-900/40" />
      </div>

      {/* Content Layer */}
      <div className="absolute inset-0 z-10 flex flex-col">
        
        {/* Header */}
        <header className="w-full p-6 md:p-8 flex items-center justify-between z-20">
          {/* Left: Nav links */}
          <nav className="hidden md:flex gap-8">
            <button onClick={() => scrollToSection('creators')} className="text-white hover:text-gray-300 font-medium transition-colors">Creators</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-white hover:text-gray-300 font-medium transition-colors">How it works</button>
          </nav>
          
          {/* Center: Title */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img 
              src="/images/dark_suivre.png" 
              alt="Suivre" 
              className="h-24" 
            />
          </div>

          {/* Right: CTA */}
          <div className="ml-auto md:ml-0">
            <Link to="/app" className="px-6 py-2 rounded-full border border-white text-white hover:bg-white/10 transition-colors font-medium">
              Open Application
            </Link>
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-between px-8 md:px-16 pb-8 md:pb-12 pt-0">
          {/* Bottom Left Messages */}
          <div className="mt-auto text-left">
               <h2 className="text-6xl md:text-8xl font-oracle font-black tracking-tighter text-white drop-shadow-lg leading-tight min-h-[1.2em]">
                  <TypewriterText text={MESSAGES[currentVideoIndex]} />
               </h2>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="bg-slate-950 text-white overflow-x-hidden">
      <HeroSection />

      {/* Creators Section */}
      <section id="creators" className="py-24 px-8 md:px-16 bg-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Empowering Creators</h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              Suivre ensures fair and transparent remuneration for all creators. By leveraging blockchain technology, we guarantee that you remain in full control of your content and your revenue streams, without opaque algorithms or hidden fees.
            </p>
          </div>
          <div className="flex-1 flex justify-center items-center">
            <CreatorShowcase />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 px-8 md:px-16 bg-slate-900">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center md:max-w-3xl md:mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">How It Works</h2>
            <p className="text-lg text-gray-300">
              Built on the principles of privacy and decentralization.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors">
               <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
                 <span className="text-indigo-400 font-bold text-xl">1</span>
               </div>
               <h3 className="text-xl font-bold mb-4">Decentralized Foundations</h3>
               <p className="text-gray-400">
                 Powered by blockchain technology, our platform operates on decentralized systems that ensure resilience and censorship resistance.
               </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors">
               <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-6">
                <span className="text-purple-400 font-bold text-xl">2</span>
               </div>
               <h3 className="text-xl font-bold mb-4">Encrypted Security</h3>
               <p className="text-gray-400">
                 All data is securely encrypted. We cannot access your private content or personal information—your data belongs to you alone.
               </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors">
               <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <span className="text-emerald-400 font-bold text-xl">3</span>
               </div>
               <h3 className="text-xl font-bold mb-4">Privacy First</h3>
               <p className="text-gray-400">
                 We do not access your accounts. Our architecture guarantees that only you and your subscribers can view your exclusive content.
               </p>
            </div>
          </div>

          <div className="w-full flex justify-center mt-12">
             <img 
               src="/images/illustration.jpg" 
               alt="Architecture Illustration" 
               className="w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-700"
             />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-8 text-center bg-slate-950 border-t border-slate-800">
         <h2 className="text-3xl md:text-4xl font-bold mb-8">Ready to start?</h2>
         <Link to="/app" className="inline-block px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:bg-gray-200 transition-colors">
            Launch Application
         </Link>
      </section>
    </div>
  );
}
