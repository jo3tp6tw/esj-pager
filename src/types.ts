/** Normalized content after HTML extraction */
export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'img'; src: string };
