import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Objkt } from './entities/objkt.entity';
import { Repository } from 'typeorm';
import { concatMap, forkJoin, map, mergeMap, Observable, tap } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MarketplaceEventType, SortDirection } from './models/objkt.model';

@Injectable()
export class ObjktsService {
  private readonly url: string = 'https://data.objkt.com/v3/graphql';
  private readonly headers: Record<string, string> = {
    'content-type': 'application/json',
    'Accept-Encoding': '*',
  };

  constructor(
    @InjectRepository(Objkt)
    private objktRepository: Repository<Objkt>,
    private readonly httpService: HttpService,
  ) {}

  async saveObjkt() {
    await this.objktRepository.save({});
  }

  getData(): Observable<any> {
    return this.getLatestBoughtObjktsTokenPk().pipe(
      map((latestObjkt) => {
        return latestObjkt;
      }),
    );
  }

  getLatestBoughtObjktsTokenPk(): Observable<AxiosResponse<number[]>> {
    const query = `
      query MyQuery($limit: Int!, $order_by: [event_order_by!], $where: event_bool_exp!) {
      event(
        order_by: $order_by
        limit: $limit
        where: $where
        ) {
        token_pk
      }
    }`;

    const variables = {
      limit: 3,
      order_by: [
        { id: SortDirection.DESCENDING },
        { timestamp: SortDirection.DESCENDING },
      ],
      where: { marketplace_event_type: { _eq: MarketplaceEventType.LIST_BUY } },
    };

    return this.httpService
      .post(this.url, { query, variables }, { headers: this.headers })
      .pipe(
        map((response) => {
          if (response.data.errors) {
            console.log(response.data.errors);
          }

          return response.data.data.event.map((i) => {
            return i.token_pk;
          });
        }),
      );
  }

  getObjktDetails(
    contract: string,
    tokenId: string,
  ): Observable<AxiosResponse<any>> {
    const query = `
          query getEvents($where: event_bool_exp!, $order_by: [event_order_by!]) {
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
        token_pk: { _eq: tokenId },
      },
      order_by: [
        { id: SortDirection.ASCENDING },
        { timestamp: SortDirection.ASCENDING },
      ],
    };

    return this.httpService
      .post(this.url, { query, variables }, { headers: this.headers })
      .pipe(
        map((response) => {
          if (response.data.errors) {
            console.log(response.data.errors);
          }

          return response.data.data.event;
        }),
      );
  }

  checkIfIBought(list): boolean {
    for (const listElement of list) {
      if (
        listElement.recipient_address ===
          'tz1ibW4sjBmVJEuCnaBzqRcvrU5mzNJfd9Ni' &&
        listElement.event_type === 'transfer'
      ) {
        return false;
      }
    }
    return true;
  }

  getPrice(history): number {
    for (const historyElement of history) {
      if (
        historyElement.marketplace_event_type === MarketplaceEventType.LIST_BUY
      ) {
        return historyElement.price / 1000000;
      }
    }
  }

  getRoyalty(royalties): number {
    let amount = 0;
    let decimal = 0;
    for (const royalty of royalties) {
      amount += royalty.amount;
      decimal = royalty.decimals;
    }
    amount = (amount / Math.pow(10, decimal)) * 100;
    return amount;
  }

  getListOfPurchaseTimestamps(history): string[] {
    const purchaseTimestamps = [];
    for (const historyElement of history) {
      if (
        historyElement.marketplace_event_type === MarketplaceEventType.LIST_BUY
      ) {
        const date = Math.round(
          new Date(historyElement.timestamp).getTime() / 1000 / 60,
        );
        purchaseTimestamps.push(date);
      }
    }
    return purchaseTimestamps;
  }

  checkAvailability(history): boolean {
    const listEdition = this.amountOfListEdition(history);
    const soldEdition = this.purchases(history);
    if (listEdition > 1) {
      if (listEdition < 100) {
        if (soldEdition > 2) {
          if (listEdition > soldEdition) {
            return true;
          }
        }
      }
    }
    return false;
  }

  amountOfListEdition(history): number {
    let amountOfList = 0;
    const artist = this.findArtist(history);
    for (const historyElement of history) {
      if (
        historyElement.marketplace_event_type === 'list' &&
        artist === historyElement.creator_address
      ) {
        amountOfList += historyElement.amount;
      }
      if (
        historyElement.marketplace_event_type === 'cancel_list' &&
        artist === historyElement.creator_address
      ) {
        amountOfList -= historyElement.amount;
      }
    }
    return amountOfList;
  }

  purchases(history): number {
    let amount = 0;
    for (const historyElement of history) {
      if (
        historyElement.marketplace_event_type === MarketplaceEventType.LIST_BUY
      ) {
        amount++;
      }
    }
    return amount;
  }

  amountOfTransfers(history): number {
    let iterator = 0;
    for (const historyElement of history) {
      if (
        historyElement.event_type === 'transfer' &&
        historyElement.marketplace_event_type === 'transfer'
      ) {
        if (historyElement.creator_address === this.findArtist(history)) {
          iterator++;
        }
      }
    }
    return iterator;
  }

  findArtist(history): string {
    let artist = '';
    for (const historyElement of history) {
      if (historyElement.marketplace_event_type === 'list') {
        artist = historyElement.creator_address;
        return artist;
      }
    }
  }

  collectRate(history) {
    const purchaseTimestamps: string[] =
      this.getListOfPurchaseTimestamps(history);
    let iterator = 1;
    let sum = 0;
    for (const purchaseTimestamp of purchaseTimestamps) {
      if (purchaseTimestamps[iterator]) {
        sum += Number(purchaseTimestamps[iterator]) - Number(purchaseTimestamp);
        iterator++;
      }
    }
    return Math.floor(sum / (purchaseTimestamps.length - 1));
  }

  soldRate(history) {
    const listEdition = this.amountOfListEdition(history);
    const purchase = this.purchases(history);
    return purchase / listEdition;
  }
}
