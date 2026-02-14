export type GoutteFeedMedia = {
  type: "image" | "video";
  src: string;
  alt?: string;
  poster?: string;
};

export type GoutteFeedPost = {
  id: string | number;
  author: string;
  handle: string;
  avatar?: string;
  description: string;
  media?: GoutteFeedMedia;
  accent?: string;
  [key: string]: unknown;
};
