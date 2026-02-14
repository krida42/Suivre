import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useMasonry } from "./useMasonry";
import DropCard from "./DropCard";
import type { GoutteFeedPost } from "./types";

type GoutteFeedProps = {
  posts: GoutteFeedPost[];
  maxWidth?: number;
  containerWidth?: number;
  enableFocus?: boolean;
  showHint?: boolean;
  onPostClick?: (post: GoutteFeedPost, index: number) => void;
};

const GoutteFeed = ({
  posts,
  maxWidth = 1200,
  containerWidth: userContainerWidth,
  enableFocus = true,
  showHint = true,
  onPostClick,
}: GoutteFeedProps) => {
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeWidth = userContainerWidth || Math.min(windowWidth, maxWidth);
  const safePosts = posts.length > 0 ? posts : [];
  const { slots, sceneHeight } = useMasonry(safePosts, { containerWidth: activeWidth });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const isFocusActive = enableFocus && activeId !== null;

  useEffect(() => {
    if (!enableFocus) return;

    if (activeId !== null) {
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollTop}px`;
      document.body.style.width = "100%";
      return;
    }

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollTop);
  }, [activeId, enableFocus, scrollTop]);

  useEffect(() => {
    if (!enableFocus) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeId !== null) {
        setActiveId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId, enableFocus]);

  if (safePosts.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[rgba(8,12,18,0.62)] transition-opacity duration-300 ${
          isFocusActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setActiveId(null)}
        aria-hidden="true"
      />

      <main className="relative mx-auto" style={{ height: sceneHeight, width: activeWidth }}>
        {slots.map((slot, index) => {
          const isFocused = enableFocus && activeId === slot.index;
          const isDimmed = enableFocus && activeId !== null && !isFocused;

          const style: CSSProperties = isFocused
            ? {
                ...slot.style,
                position: "absolute",
                top: `${scrollTop + window.innerHeight / 2}px`,
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(600px, 90vw)",
                height: "min(80vh, 800px)",
                zIndex: 50,
                borderRadius: "24px",
                margin: 0,
                transition: "all 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                opacity: 1,
                pointerEvents: "auto",
              }
            : {
                ...slot.style,
                zIndex: 10,
                transition: "all 0.6s cubic-bezier(0.25, 1, 0.5, 1), z-index 0s linear 0.6s",
                opacity: isDimmed ? 0.2 : 1,
                pointerEvents: isDimmed ? "none" : "auto",
              };

          return (
            <DropCard
              key={slot.post.uniqueId || index}
              index={index}
              post={slot.post}
              style={style}
              isFocused={isFocused}
              onClick={() => {
                onPostClick?.(slot.post as GoutteFeedPost, index);
                if (!enableFocus) return;
                setScrollTop(window.scrollY);
                setActiveId(slot.index);
              }}
              onClose={() => setActiveId(null)}
            />
          );
        })}
      </main>

      {showHint && enableFocus && (
        <div className="fixed left-5 bottom-5 z-30 font-sans font-medium text-xs md:text-sm tracking-wide text-[rgba(243,244,246,0.72)] pointer-events-none md:left-6 md:bottom-6">
          Click a post to bring it forward. Press Esc to close.
        </div>
      )}
    </>
  );
};

export default GoutteFeed;
