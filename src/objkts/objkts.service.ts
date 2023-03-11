import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Objkt } from './entities/objkt.entity';
import { Repository } from 'typeorm';
import { EventType, MarketplaceEventType, Event, Royalty, Creator } from "./models/token.model";
import { ObjktsApiService } from './objkts-api.service';

@Injectable()
export class ObjktsService {
  private readonly minimumListToken = 1;
  private readonly maximumListToken = 100;
  private readonly minimumSoldToken = 2;

  constructor(
    @InjectRepository(Objkt)
    private objktRepository: Repository<Objkt>,
    private objktApiService: ObjktsApiService,
  ) {}

  async saveObjkt() {
    await this.objktRepository.save({});
  }

  async getData() {
    const tokens = await this.objktApiService.getTokens();
    const tokensArray = [];
    let tokenDetail = {};

    for (const token of tokens) {
      const tokenEvents: Event[] = await this.objktApiService.getTokenEvents(token);
      if (this.checkIfIBought(tokenEvents)) {
        if (this.checkAvailability(tokenEvents)) {
          tokenDetail = {
            ...this.findArtist(tokenEvents),
            price: this.getPrice(tokenEvents),
            royalty: this.calculateRoyalty(tokenEvents),
            editions: this.amountOfListEdition(tokenEvents),
            sold_editions: this.amountOfPurchases(tokenEvents),
            token_pk: token,
            sold_rate: this.soldRate(tokenEvents),
            average_collect_actions: this.averagePurchaseActionsTime(tokenEvents),
          };
          tokensArray.push(tokenDetail);
        }
      }
    }
    return tokensArray;
  }

  /**
   * This function checks that I bought this token or not.
   * @param events - An array of token events.
   * @returns {boolean} The final result which is true if I already bought this token.
   */
  checkIfIBought(events: Event[]): boolean {
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
  getPrice(events: Event[]): number {
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
  calculateRoyalty(events: Event[]): number {
    let amount = 0;
    let decimal = 0;
    const royalties: Royalty[] = events[0].token.royalties;
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
  getListOfPurchaseTimestamps(events: Event[]): number[] {
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
  checkAvailability(events: Event[]): boolean {
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
  amountOfListEdition(events: Event[]): number {
    let amountOfList = 0;
    const artist = this.findArtist(events);
    for (const event of events) {
      if (
        event.marketplace_event_type === MarketplaceEventType.LIST_CREATE &&
        artist.address === event.creator.address
      ) {
        amountOfList += event.amount;
      }
      if (
        event.marketplace_event_type === MarketplaceEventType.LIST_CANCEL &&
        artist.address === event.creator.address
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
  amountOfPurchases(events: Event[]): number {
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
  amountOfTransfers(events: Event[]): number {
    let iterator = 0;
    for (const event of events) {
      if (event.event_type === EventType.TRANSFER) {
        if (event.creator.address === this.findArtist(events).address) {
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
  findArtist(events: Event[]): Creator {
    const firstEvent = events[0];
    let twitterUsername = null;
    if (firstEvent.creator.twitter) {
      twitterUsername = firstEvent.creator.twitter.split('/')[-1];
    }

    return {
      address: firstEvent.creator.address,
      profile_address: `https://objkt.com/profile/${firstEvent.creator.address}`,
      alias: firstEvent.creator.alias,
      twitter: twitterUsername,
      email: firstEvent.creator.email,
      facebook: firstEvent.creator.facebook,
      instagram: firstEvent.creator.instagram,
      tzdomain: firstEvent.creator.tzdomain
    }
  }

  /**
   * Calculates the average time (in seconds) between purchases in the given list of token events.
   * @param events - An array of token events.
   * @returns {number} The average time (in seconds) between purchases.
   */
  averagePurchaseActionsTime(events: Event[]): number {
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
  soldRate(events: Event[]) {
    const listEdition = this.amountOfListEdition(events);
    const purchase = this.amountOfPurchases(events);
    return purchase / listEdition;
  }
}
