import { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredContainerWidth, setMeasuredContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const node = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (!nextWidth || Number.isNaN(nextWidth)) return;
      setMeasuredContainerWidth(nextWidth);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fallbackWidth = Math.min(windowWidth, maxWidth);
  const inferredWidth = measuredContainerWidth ? Math.min(measuredContainerWidth, maxWidth) : fallbackWidth;
  const activeWidth = userContainerWidth || inferredWidth;
  const safePosts = posts.length > 0 ? posts : [];
  const { slots, sceneHeight } = useMasonry(safePosts, { containerWidth: activeWidth });
  const [activeFocus, setActiveFocus] = useState<{ id: number; scrollTop: number; mainTop: number } | null>(null);
  const lastScrollTopRef = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const activeId = activeFocus?.id ?? null;

  const isFocusActive = enableFocus && activeId !== null;

  useEffect(() => {
    if (!enableFocus) return;

    if (activeFocus !== null) {
      document.body.style.position = "fixed";
      document.body.style.top = `-${activeFocus.scrollTop}px`;
      document.body.style.width = "100%";
      return;
    }

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, lastScrollTopRef.current);
  }, [activeFocus, enableFocus]);

  useEffect(() => {
    if (!enableFocus) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeId !== null) {
        setActiveFocus(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId, enableFocus]);

  if (safePosts.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full">
      <div
        className={`fixed inset-0 z-40 bg-[rgba(8,12,18,0.62)] transition-opacity duration-300 ${
          isFocusActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setActiveFocus(null)}
        aria-hidden="true"
      />

      <main ref={mainRef} className="relative mx-auto" style={{ height: sceneHeight, width: activeWidth }}>
        {slots.map((slot, index) => {
          const isFocused = enableFocus && activeId === slot.index;
          const isDimmed = enableFocus && activeId !== null && !isFocused;

          const style: CSSProperties = isFocused
            ? {
                ...slot.style,
                position: "absolute",
                top: `${(activeFocus?.scrollTop ?? 0) + window.innerHeight / 2 - (activeFocus?.mainTop ?? 0)}px`,
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
                const currentScrollTop = window.scrollY;
                const mainTop = mainRef.current
                  ? mainRef.current.getBoundingClientRect().top + currentScrollTop
                  : 0;
                lastScrollTopRef.current = currentScrollTop;
                setActiveFocus({ id: slot.index, scrollTop: currentScrollTop, mainTop });
              }}
              onClose={() => setActiveFocus(null)}
            />
          );
        })}
      </main>

      {showHint && enableFocus && (
        <div className="fixed left-5 bottom-5 z-30 font-sans font-medium text-xs md:text-sm tracking-wide text-[rgba(243,244,246,0.72)] pointer-events-none md:left-6 md:bottom-6">
          Click a post to bring it forward. Press Esc to close.
        </div>
      )}
    </div>
  );
};

export default GoutteFeed;
