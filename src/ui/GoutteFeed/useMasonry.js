import { useState, useEffect, useCallback } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rand = (min, max) => min + Math.random() * (max - min);

function getProfile(width) {
    // Dynamic column count based on available width (approx 300px per column)
    // This prevents the "always 4 columns" issue on large screens
    const dynamicColumns = Math.max(1, Math.floor(width / 320));

    if (width < 700) {
        return {
            kind: 'mobile',
            count: 10,
            columnCount: 2,
            columnGap: 14,
            rowGap: 40,
            marginX: 14,
            marginY: 18,
            cardWidthMin: 152,
            cardWidthMax: 188,
            rotationMax: 2.1,
            radiusBase: 20,
            focusMaxScale: 1.22
        };
    }
    if (width < 1080) {
        return {
            kind: 'tablet',
            count: 15,
            columnCount: Math.max(2, Math.floor(width / 340)), // More dynamic
            columnGap: 18,
            rowGap: 60,
            marginX: 24,
            marginY: 24,
            cardWidthMin: 174,
            cardWidthMax: 222,
            rotationMax: 2.6,
            radiusBase: 22,
            focusMaxScale: 1.2
        };
    }

    // Desktop: purely dynamic now
    return {
        kind: 'desktop',
        count: clamp(Math.round(width / 120), 15, 25),
        columnCount: dynamicColumns,
        columnGap: 20,
        rowGap: 80,
        marginX: 34,
        marginY: 30,
        cardWidthMin: 220,
        cardWidthMax: 300,
        rotationMax: 2.8,
        radiusBase: 24,
        focusMaxScale: 1.16
    };
}

export function useMasonry(posts = [], config = {}) {
    const [layout, setLayout] = useState({ slots: [], sceneHeight: 0 });
    const containerWidth = config.containerWidth;

    const calculateLayout = useCallback(() => {
        if (!posts.length) return;

        // Use containerWidth if provided, otherwise window width
        const width = containerWidth || window.innerWidth;
        const profile = getProfile(width);

        // Prepare display posts list
        const displayPosts = [];
        for (let i = 0; i < profile.count; i += 1) {
            const base = posts[i % posts.length];
            displayPosts.push({
                ...base,
                uniqueId: `${base.id}-feed-${i}`,
                description: i < posts.length ? base.description : `${base.description} / iter ${i + 1}`,
                media: base.media ? { ...base.media } : undefined
            });
        }

        const slots = [];
        // Ensure accurate max columns based on profile
        const maxColumns = Math.max(1, profile.columnCount);

        const availableWidth = Math.max(1, width - profile.marginX * 2 - profile.columnGap * (maxColumns - 1));
        const columnWidth = Math.floor(availableWidth / maxColumns);

        // Initialize column heights with organic offsets
        const columnHeights = new Array(maxColumns).fill(0).map(() => profile.marginY + rand(0, 100));

        displayPosts.forEach((post, index) => {
            // Find shortest column
            const column = columnHeights.indexOf(Math.min(...columnHeights));

            // Variable aspect ratio for true masonry look (0.85 to 1.5)
            // This ensures cards are not all same height, preventing row alignment
            // const aspectRatio = rand(0.85, 1.5);
            const cardWidth = Math.min(columnWidth, clamp(rand(profile.cardWidthMin, profile.cardWidthMax), profile.cardWidthMin, columnWidth));

            // Content-aware height calculation
            const baseHeight = 100; // Header + Padding approx
            const mediaHeight = post.media ? cardWidth * rand(0.8, 1.3) : 0; // Media usually takes width * aspect

            const approxCharsPerLine = cardWidth / 7; // Estimate
            const textLines = Math.ceil((post.description?.length || 0) / approxCharsPerLine);
            const textHeight = textLines * 22; // Line height approx

            const contentHeight = baseHeight + mediaHeight + textHeight;

            // Semi-random "breathing room" or tightness (0.95x to 1.1x)
            const randomness = rand(0.95, 1.15);

            const cardHeight = contentHeight * randomness;

            const centerOffset = (columnWidth - cardWidth) / 2;

            // Constrain jitter to keep card strictly within its column (no overlap)
            const maxJitter = Math.max(0, (columnWidth - cardWidth) / 2);
            const jitter = rand(-maxJitter, maxJitter);

            // Calculate position relative to column start
            const xPos = profile.marginX + column * (columnWidth + profile.columnGap) + centerOffset + jitter;
            const yPos = columnHeights[column];

            const cx = xPos + cardWidth / 2;
            const cy = yPos + cardHeight / 2;

            const scale = rand(0.99, 1.01);
            const rotation = rand(-profile.rotationMax, profile.rotationMax);

            slots.push({
                post,
                style: {
                    left: `${cx}px`,
                    top: `${cy}px`,
                    width: `${cardWidth}px`,
                    height: `${cardHeight}px`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`
                },
                index
            });

            const extraGap = rand(0, 40);
            columnHeights[column] += cardHeight + profile.rowGap + extraGap;
        });

        const sceneHeight = Math.max(window.innerHeight, Math.max(...columnHeights) + profile.marginY);

        setLayout({ slots, sceneHeight });
    }, [posts, containerWidth]);

    useEffect(() => {
        calculateLayout();

        let timeout;
        const onResize = () => {
            clearTimeout(timeout);
            timeout = setTimeout(calculateLayout, 100);
        };

        // Only listen to resize if we are NOT using a fixed containerWidth
        if (!containerWidth) {
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
        }
    }, [calculateLayout, containerWidth]);

    return layout;
}
