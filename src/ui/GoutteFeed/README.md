# GoutteFeed Component Usage

## Overview
`GoutteFeed` is a reusable React component that creates a "masonry-style" feed of cards with organic positioning, staggered entry animations, and interactive expansion.

## Installation / Requirements

Ensure your project has the following dependencies installed:

```bash
npm install react react-dom
npm install -D tailwindcss postcss autoprefixer
```

*Note: This component relies on Tailwind CSS for styling.*

## Files Required
To use `GoutteFeed`, you simply need the `src/components/GoutteFeed` folder which contains:

1.  `index.tsx` (The main component)
2.  `DropCard.tsx` (The individual card component)
3.  `useMasonry.js` (The layout logic hook)


## Basic Usage

Import the component and pass an array of post objects to it.

```jsx
import GoutteFeed from './components/GoutteFeed';

const myPosts = [
  {
    id: 1,
    author: "Jane Doe",
    handle: "@janedoe",
    avatar: "https://via.placeholder.com/150",
    description: "This is a post description.",
    media: {
      type: "image", // or 'video'
      src: "https://via.placeholder.com/600x800",
      alt: "Image alt text"
    }
  },
  // ... more posts
];

function MyApp() {
  return (
    <div>
      <header>My Awesome Header</header>

      {/* Just drop it in! */}
      <GoutteFeed posts={myPosts} />
      
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `posts` | `Array` | **Required** | Array of data objects for the cards. |
| `maxWidth` | `Number` | `1200` | The maximum width of the feed container in pixels. |
| `containerWidth` | `Number` | `undefined` | Optional. If set, forces the feed to be exactly this width, overriding the responsive logic. |

## Customization

-   **Styling**: The component uses Tailwind classes. You can modify `src/components/DropCard.tsx` to change the look of individual cards.
-   **Layout**: Adjust `src/hooks/useMasonry.js` to change the number of columns, gaps, or randomness.
