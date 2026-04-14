/** Normalized content after HTML extraction */
export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'img'; src: string }
  | { type: 'commentDivider' }
  | { type: 'commentMeta'; text: string }
  | { type: 'commentMain'; text: string };
