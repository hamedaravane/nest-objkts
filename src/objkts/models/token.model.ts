export enum SortDirection {
  ASCENDING = 'asc',
  DESCENDING = 'desc',
}

export enum MarketplaceEventType {
  NULL = 'null',
  LIST_BUY = 'list_buy',
  LIST_CREATE = 'list_create',
  LIST_CANCEL = 'list_cancel',
  OFFER_CREATE = 'offer_create'
}

export enum EventType {
  NULL = 'null',
  MINT = 'mint',
  TRANSFER = 'transfer',
}

export interface Creator {
  address: string;
  profile_address: string;
  alias?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tzdomain?: string;
}

export interface Event {
  amount: number;
  creator: Creator;
  event_type: EventType;
  fa_contract: string;
  marketplace: Marketplace;
  marketplace_contract: string;
  marketplace_event_type: MarketplaceEventType;
  price: number;
  recipient_address: string;
  timestamp: Date;
  token: Token;
}

export interface Marketplace {
  name: string;
  contract: string;
  group: string;
  subgroup: string;
}

export interface Token {
  name: string;
  mime: string;
  pk: number;
  average: number;
  lowest_ask: number;
  highest_offer: number;
  supply: number;
  token_id: number;
  royalties: Royalty[];
}

export interface Royalty {
  amount: number;
  decimals: number;
}