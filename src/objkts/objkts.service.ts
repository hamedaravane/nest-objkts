import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Objkt } from './entities/objkt.entity';
import { Repository } from 'typeorm';
import { firstValueFrom, map } from 'rxjs';
import {
  EventType,
  MarketplaceEventType,
  SortDirection,
} from './models/objkt.model';

@Injectable()
export class ObjktsService {
  private readonly url: string = 'https://data.objkt.com/v3/graphql';
  private readonly headers: Record<string, string> = {
    'content-type': 'application/json',
    'Accept-Encoding': '*',
  };
  private readonly minimumListToken = 1;
  private readonly maximumListToken = 100;
  private readonly minimumSoldToken = 2;

  constructor(
    @InjectRepository(Objkt)
    private objktRepository: Repository<Objkt>,
    private readonly httpService: HttpService,
  ) {}

  async saveObjkt() {
    await this.objktRepository.save({});
  }

  async getData() {
    const tokens = await this.getTokens();
    const details = [];

    for (const token of tokens) {
      const tokenEvents = await this.getTokenEvents(token);
      details.push(this.collectRate(tokenEvents));
    }

    return details;
  }

  async getTokens(): Promise<number[]> {
    const query = `
      query GetTokens($limit: Int!, $order_by: [event_order_by!], $where: event_bool_exp!) {
      event(
        order_by: $order_by
        limit: $limit
        where: $where
        ) {
        token_pk
      }
    }`;

    const variables = {
      limit: 30,
      order_by: [
        { id: SortDirection.DESCENDING },
        { timestamp: SortDirection.DESCENDING },
      ],
      where: { marketplace_event_type: { _eq: MarketplaceEventType.LIST_BUY } },
    };

    return await firstValueFrom(
      this.httpService
        .post(this.url, { query, variables }, { headers: this.headers })
        .pipe(
          map((response) => {
            if (response.data.errors) {
              console.log(response.data.errors);
            }
            return response.data.data.event.map((item) => item.token_pk);
          }),
        ),
    );
  }

  async getTokenEvents(tokenPk: number): Promise<any> {
    const query = `
          query GetTokenEvents($where: event_bool_exp!, $order_by: [event_order_by!]) {
            event(
              where: $where
              order_by: $order_by
            ) {
            event_type
            creator_address
            marketplace_event_type
            amount
            fa_contract
            id
            price
            recipient_address
            timestamp
            token {
              name
              token_id
              royalties {
                amount
                decimals
              }
            }
          }
        }`;

    const variables = {
      where: {
        timestamp: { _is_null: false },
        reverted: { _neq: true },
        token_pk: { _eq: tokenPk },
      },
      order_by: [
        { id: SortDirection.ASCENDING },
        { timestamp: SortDirection.ASCENDING },
      ],
    };

    return await firstValueFrom(
      this.httpService
        .post(this.url, { query, variables }, { headers: this.headers })
        .pipe(
          map((response) => {
            if (response.data.errors) {
              console.log(response.data.errors);
            }
            return response.data.data.event;
          }),
        ),
    );
  }

  /**
   * This function checks that I bought this token or not.
   * @param events - An array of token events.
   * @returns {boolean} The final result which is true if I already bought this token.
   */
  checkIfIBought(events): boolean {
    for (const event of events) {
      if (
        event.recipient_address === 'tz1ibW4sjBmVJEuCnaBzqRcvrU5mzNJfd9Ni' &&
        event.event_type === EventType.TRANSFER
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * This function returns the price of list token.
   * @param events - An array of token events.
   * @returns {number} The Price.
   */
  getPrice(events): number {
    for (const event of events) {
      if (event.marketplace_event_type === MarketplaceEventType.LIST_BUY) {
        return event.price / 1000000;
      }
    }
  }

  /**
   * This function gets An array of token events. and returns royalty percentage which goes to artist.
   * @param events - An array of token events.
   * @returns {number} The royalty percentage.
   */
  calculateRoyalty(events): number {
    let amount = 0;
    let decimal = 0;
    const royalties = events[0].token.royalties;
    for (const royalty of royalties) {
      amount += royalty.amount;
      decimal = royalty.decimals;
    }
    amount = (amount / Math.pow(10, decimal)) * 100;
    return amount;
  }

  /**
   * Returns an array of timestamps (in seconds) for every buy action in the given list of token events.
   * @param events - An array of token events.
   * @returns {number[]} An array of timestamps (in seconds) for every buy action in the events list.
   */
  getListOfPurchaseTimestamps(events): number[] {
    const purchaseTimestamps = [];
    for (const event of events) {
      if (event.marketplace_event_type === MarketplaceEventType.LIST_BUY) {
        const date = Math.floor(
          new Date(event.timestamp).getTime() / 1000 / 60,
        );
        purchaseTimestamps.push(date);
      }
    }
    return purchaseTimestamps;
  }

  /**
   * This function checks if token has available primary editions or not.
   * @param events - An array of token events.
   * @returns {boolean} The availability of token.
   */
  checkAvailability(events): boolean {
    const listEdition = this.amountOfListEdition(events);
    const soldEdition = this.amountOfPurchases(events);
    if (listEdition > this.minimumListToken) {
      if (listEdition < this.maximumListToken) {
        if (soldEdition > this.minimumSoldToken) {
          if (listEdition > soldEdition) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * This function returns the amount of editions which listed.
   * @param events - An array of token events.
   * @returns {number} The amount of editions which listed.
   */
  amountOfListEdition(events): number {
    let amountOfList = 0;
    const artist = this.findArtist(events);
    for (const event of events) {
      if (
        event.marketplace_event_type === MarketplaceEventType.LIST_CREATE &&
        artist === event.creator_address
      ) {
        amountOfList += event.amount;
      }
      if (
        event.marketplace_event_type === MarketplaceEventType.LIST_CANCEL &&
        artist === event.creator_address
      ) {
        amountOfList -= event.amount;
      }
    }
    return amountOfList;
  }

  /**
   * This function returns the amount of editions which has been sold.
   * @param events - An array of token events.
   * @returns {number} The amount of editions which has been sold.
   */
  amountOfPurchases(events): number {
    let amount = 0;
    for (const event of events) {
      if (event.marketplace_event_type === MarketplaceEventType.LIST_BUY) {
        amount++;
      }
    }
    return amount;
  }

  /**
   * This function returns the amount of editions which has been transferred.
   * @param events - An array of token events.
   * @returns {number} The amount of editions which has been transferred.
   */
  amountOfTransfers(events): number {
    let iterator = 0;
    for (const event of events) {
      if (event.event_type === EventType.TRANSFER) {
        if (event.creator_address === this.findArtist(events)) {
          iterator++;
        }
      }
    }
    return iterator;
  }

  /**
   * This function find the address of creator of the token.
   * @param events - An array of token events.
   * @returns {string} The address of creator of the token.
   */
  findArtist(events): string {
    let artist = '';
    for (const event of events) {
      if (event.marketplace_event_type === MarketplaceEventType.LIST_CREATE) {
        artist = event.creator_address;
        return artist;
      }
    }
  }

  /**
   * Calculates the average time (in seconds) between purchases in the given list of token events.
   * @param events - An array of token events.
   * @returns {number} The average time (in seconds) between purchases.
   */
  collectRate(events) {
    const purchaseTimestamps = this.getListOfPurchaseTimestamps(events);
    const differences = purchaseTimestamps
      .slice(1)
      .map((timestamp, i) => timestamp - purchaseTimestamps[i]);
    const averageDifference =
      differences.reduce((sum, difference) => sum + difference, 0) /
      differences.length;
    return Math.floor(averageDifference);
  }

  /**
   * Calculates the sold rate (the percentage of listed editions that have been sold) for the given list of token events.
   * @param events - An array of token events.
   * @returns {number} The sold rate (as a decimal) for the given list of token events.
   */
  soldRate(events) {
    const listEdition = this.amountOfListEdition(events);
    const purchase = this.amountOfPurchases(events);
    return purchase / listEdition;
  }
}
