import { useEffect, useState } from "react";
import type { CSSProperties, HTMLAttributes, MouseEvent, Ref } from "react";

type DropCardMode = "feed" | "panel";

type DropCardMedia = {
  type: "image" | "video";
  src: string;
  alt?: string;
  poster?: string;
};

type DropCardPost = {
  id?: string | number;
  author?: string;
  handle?: string;
  avatar?: string;
  description?: string;
  media?: DropCardMedia | null;
  accent?: string;
};

type DropCardProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
  post?: DropCardPost;
  style?: CSSProperties;
  isFocused?: boolean;
  onClose?: () => void;
  onRef?: Ref<HTMLDivElement>;
  index?: number;
  mode?: DropCardMode;
  interactiveTilt?: boolean;
  disableEntryAnimation?: boolean;
  showCloseButton?: boolean;
};

const DEFAULT_AVATAR = "https://avatar.iran.liara.run/public";

const mergeClasses = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const DropCard = ({
  post,
  style,
  isFocused = false,
  onClose,
  onRef,
  index = 0,
  mode = "feed",
  interactiveTilt = true,
  disableEntryAnimation = false,
  showCloseButton,
  className,
  children,
  onClick,
  onMouseMove,
  onMouseLeave,
  tabIndex,
  ...rest
}: DropCardProps) => {
  const shouldAnimateEntry = mode === "feed" && !disableEntryAnimation;
  const author = post?.author ?? "Suivre";
  const handle = post?.handle ?? "@suivre";
  const avatar = post?.avatar ?? DEFAULT_AVATAR;
  const description = post?.description ?? "";
  const media = post?.media ?? null;

  const [hasAppeared, setHasAppeared] = useState(!shouldAnimateEntry);
  const [entryComplete, setEntryComplete] = useState(!shouldAnimateEntry);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!shouldAnimateEntry) return;

    const delay = index * 50;
    const timer = window.setTimeout(() => {
      setHasAppeared(true);
    }, delay);
    const endTimer = window.setTimeout(() => setEntryComplete(true), delay + 800);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(endTimer);
    };
  }, [index, shouldAnimateEntry]);

  const allowTilt = mode === "feed" && interactiveTilt && !isFocused;

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (allowTilt && entryComplete) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: -y * 8, y: x * 8 });
    }
    onMouseMove?.(event);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
    setTilt({ x: 0, y: 0 });
    onMouseLeave?.(event);
  };

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (mode === "feed" && isFocused) return;
    onClick?.(event);
  };

  const shouldRenderDefaultContent = children === undefined || children === null;
  const shouldShowCloseButton = (showCloseButton ?? mode === "feed") && typeof onClose === "function";

  const wrapperClassName = mergeClasses(
    mode === "feed"
      ? "absolute flex flex-col overflow-visible origin-center select-none transition-[box-shadow,opacity,transform,border-radius,filter] duration-300 ease-out"
      : "relative flex flex-col overflow-visible origin-center",
    mode === "feed" && (isFocused ? "z-50 cursor-default shadow-2xl scale-100" : "hover:shadow-xl cursor-pointer"),
    mode === "feed" && !isFocused && "rounded-[var(--radius-base)]",
    mode === "panel" && onClick && "cursor-pointer",
    className
  );

  const innerStyle: CSSProperties =
    mode === "feed"
      ? {
          transition: `transform ${entryComplete ? "0.1s" : "0.8s"} cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.8s ease-out`,
          opacity: hasAppeared ? 1 : 0,
          transform: hasAppeared
            ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1, 1, 1)`
            : "translateY(100px) scale3d(0.95, 0.95, 0.95)",
          borderRadius: "inherit",
        }
      : {
          borderRadius: "inherit",
        };

  return (
    <div
      ref={onRef}
      className={wrapperClassName}
      style={style}
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={tabIndex ?? (mode === "feed" ? 0 : undefined)}
      {...rest}
    >
      <div
        className={mergeClasses(
          "w-full h-full flex flex-col overflow-hidden bg-[rgba(10,16,23,0.96)] border border-[rgba(243,244,246,0.2)]",
          mode === "panel" && "text-slate-100"
        )}
        style={innerStyle}
      >
        <div className="absolute inset-0 z-10 pointer-events-none border border-[rgba(243,244,246,0.14)] rounded-[inherit]" />

        {shouldRenderDefaultContent && media && (
          <div className={mergeClasses("relative bg-[#080b10]", isFocused ? "flex-1 min-h-0" : "flex-[0_0_62%] min-h-0")}>
            {media.type === "video" ? (
              <video
                src={media.src}
                poster={media.poster}
                autoPlay
                muted
                loop
                playsInline
                className="block object-cover w-full h-full"
              />
            ) : (
              <img src={media.src} alt={media.alt ?? "media"} className="block object-cover w-full h-full" />
            )}

            <div className="absolute inset-0 flex items-end p-3 bg-gradient-to-t from-[rgba(8,12,18,0.95)] to-transparent" />
          </div>
        )}

        <div
          className={mergeClasses(
            "relative z-20 flex-1 flex flex-col gap-2 p-3",
            shouldRenderDefaultContent
              ? "bg-gradient-to-b from-[rgba(11,15,20,0.7)] to-[rgba(11,15,20,0.98)]"
              : "bg-transparent p-0"
          )}
        >
          {shouldShowCloseButton && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onClose?.();
              }}
              className={mergeClasses(
                "absolute top-3 right-3 z-30 w-8 h-8 rounded-full border border-[rgba(243,244,246,0.3)] bg-[rgba(8,12,18,0.66)] text-[#f3f4f6] flex items-center justify-center transition-all duration-200 hover:bg-[rgba(8,12,18,0.84)]",
                isFocused ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
              )}
              aria-label="Close card"
            >
              x
            </button>
          )}

          {shouldRenderDefaultContent ? (
            <>
              <div className="flex items-center gap-2 min-w-0 font-sans">
                <img
                  src={avatar}
                  alt={handle}
                  className="w-8 h-8 rounded-full border border-[rgba(243,244,246,0.24)] bg-gray-800 object-cover shrink-0"
                />
                <div className="grid gap-0.5 min-w-0">
                  <span className="text-sm font-bold tracking-wide truncate text-[var(--paper)]">{author}</span>
                  <span className="text-xs text-[var(--muted)] truncate">{handle}</span>
                </div>
              </div>

              <p className="m-0 font-serif text-[0.98rem] leading-snug text-[rgba(243,244,246,0.95)] line-clamp-4 text-pretty">
                {description}
              </p>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};

export default DropCard;
