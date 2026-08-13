export enum CardStatus {
  UNASSIGNED = 'UNASSIGNED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
  LOST = 'LOST',
}

export enum CardTemplate {
  DROGBA = 'DROGBA',
  LUFFY = 'LUFFY',
  NARUTO = 'NARUTO',
  ZORO = 'ZORO',
}

/** QR code foreground color matching each template's brand color, sampled from the card art. */
export const CARD_TEMPLATE_QR_COLOR: Record<CardTemplate, string> = {
  [CardTemplate.DROGBA]: '#EF8539',
  [CardTemplate.LUFFY]: '#8A478B',
  [CardTemplate.NARUTO]: '#EF8539',
  [CardTemplate.ZORO]: '#3E612C',
};
